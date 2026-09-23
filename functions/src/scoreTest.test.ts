import { getDb } from './adminApp';
import { assembleTestForUser } from './assembleTest';
import { assembleMiniQuizForUser } from './assembleMiniQuiz';
import { startOrResumeBaselineForUser, CURRENT_BASELINE_VERSION } from './startOrResumeBaseline';
import { scoreTestForUser } from './scoreTest';

describe('scoreTestForUser', () => {
  const db = getDb();
  const uid = 'alice-uid';

  beforeEach(async () => {
    for (const collection of ['questions', 'baselineTests']) {
      const snap = await db.collection(collection).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
    }
    const userRef = db.collection('users').doc(uid);
    for (const sub of ['testAssignments', 'testAttempts', 'baseline']) {
      const snap = await userRef.collection(sub).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
    }
  });

  async function seedQuestion(id: string, chunkId: string, correctAnswer: string) {
    await db
      .collection('questions')
      .doc(id)
      .set({
        conceptId: 'c1',
        chunkId,
        sourceRef: 'p.1',
        type: 'fact',
        text: `Question ${id}`,
        choices: ['a', 'b'],
        correctAnswer,
        status: 'approved',
        selfCheck: { passed: true },
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
      });
  }

  test('rejects a call with no authenticated user', async () => {
    await expect(
      scoreTestForUser(db, undefined, { testId: 't1', answers: [] })
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  test('rejects a testId with no assignment for this uid', async () => {
    await expect(
      scoreTestForUser(db, { uid }, { testId: 'nonexistent', answers: [] })
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  test('grades a practice test: correct/incorrect mix, per-topic results, marks assignment scored', async () => {
    await seedQuestion('q1', 'row', 'a');
    await seedQuestion('q2', 'signs', 'b');
    const assembled = await assembleTestForUser(db, { uid }, { count: 2 });

    const result = await scoreTestForUser(db, { uid }, {
      testId: assembled.testId,
      answers: [
        { questionId: 'q1', choice: 'a' },
        { questionId: 'q2', choice: 'a' },
      ],
    });

    expect(result.type).toBe('practice');
    expect(result.correctCount).toBe(1);
    expect(result.totalCount).toBe(2);
    expect(result.score).toBeCloseTo(0.5);
    expect(result.perTopic.sort((a, b) => a.chunkId.localeCompare(b.chunkId))).toEqual([
      { chunkId: 'row', correct: 1, total: 1 },
      { chunkId: 'signs', correct: 0, total: 1 },
    ]);

    const assignmentSnap = await db
      .collection('users')
      .doc(uid)
      .collection('testAssignments')
      .doc(assembled.testId)
      .get();
    expect(assignmentSnap.data()?.scored).toBe(true);

    const attemptSnap = await db
      .collection('users')
      .doc(uid)
      .collection('testAttempts')
      .doc(assembled.testId)
      .get();
    expect(attemptSnap.exists).toBe(true);
    expect(attemptSnap.data()?.type).toBe('practice');
  });

  test('returns per-question results with each correct answer, in assignment order, and saves them', async () => {
    await seedQuestion('q1', 'row', 'a');
    await seedQuestion('q2', 'signs', 'b');
    const assembled = await assembleTestForUser(db, { uid }, { count: 2 });

    const result = await scoreTestForUser(db, { uid }, {
      testId: assembled.testId,
      answers: [
        { questionId: 'q1', choice: 'a' },
        { questionId: 'q2', choice: 'a' },
      ],
    });

    const expected = {
      q1: { questionId: 'q1', chunkId: 'row', choice: 'a', correctAnswer: 'a', correct: true },
      q2: { questionId: 'q2', chunkId: 'signs', choice: 'a', correctAnswer: 'b', correct: false },
    };
    const assignedOrder = assembled.questions.map((q) => q.id as 'q1' | 'q2');
    expect(result.perQuestion).toEqual(assignedOrder.map((id) => expected[id]));

    const attemptSnap = await db
      .collection('users')
      .doc(uid)
      .collection('testAttempts')
      .doc(assembled.testId)
      .get();
    expect(attemptSnap.data()?.perQuestion).toEqual(result.perQuestion);
  });

  test('reports an unanswered question with a null choice', async () => {
    await seedQuestion('q1', 'row', 'a');
    const assembled = await assembleTestForUser(db, { uid }, { count: 1 });

    const result = await scoreTestForUser(db, { uid }, { testId: assembled.testId, answers: [] });

    expect(result.perQuestion).toEqual([
      { questionId: 'q1', chunkId: 'row', choice: null, correctAnswer: 'a', correct: false },
    ]);
  });

  test('skips a question deleted after assignment instead of failing or counting it wrong', async () => {
    await seedQuestion('q1', 'row', 'a');
    await seedQuestion('q2', 'signs', 'b');
    const assembled = await assembleTestForUser(db, { uid }, { count: 2 });
    await db.collection('questions').doc('q2').delete();

    const result = await scoreTestForUser(db, { uid }, {
      testId: assembled.testId,
      answers: [
        { questionId: 'q1', choice: 'a' },
        { questionId: 'q2', choice: 'b' },
      ],
    });

    expect(result.correctCount).toBe(1);
    expect(result.totalCount).toBe(1);
    expect(result.score).toBe(1);
    expect(result.perTopic).toEqual([{ chunkId: 'row', correct: 1, total: 1 }]);
    expect(result.perQuestion.find((q) => q.questionId === 'q2')).toEqual({
      questionId: 'q2',
      chunkId: null,
      choice: 'b',
      correctAnswer: null,
      correct: null,
      unavailable: true,
    });
  });

  test('treats an unanswered question as incorrect, not an error', async () => {
    await seedQuestion('q1', 'row', 'a');
    const assembled = await assembleTestForUser(db, { uid }, { count: 1 });

    const result = await scoreTestForUser(db, { uid }, { testId: assembled.testId, answers: [] });

    expect(result.correctCount).toBe(0);
    expect(result.totalCount).toBe(1);
  });

  test('rejects scoring the same assignment twice', async () => {
    await seedQuestion('q1', 'row', 'a');
    const assembled = await assembleTestForUser(db, { uid }, { count: 1 });
    const answers = [{ questionId: 'q1', choice: 'a' }];

    await scoreTestForUser(db, { uid }, { testId: assembled.testId, answers });

    await expect(
      scoreTestForUser(db, { uid }, { testId: assembled.testId, answers })
    ).rejects.toMatchObject({ code: 'already-exists' });
  });

  test('a mini-quiz scoring 80%+ recommends move-on, below recommends review-again', async () => {
    await seedQuestion('q1', 'row', 'a');
    await seedQuestion('q2', 'row', 'a');
    await seedQuestion('q3', 'row', 'a');
    await seedQuestion('q4', 'row', 'a');
    await seedQuestion('q5', 'row', 'a');
    const assembled = await assembleMiniQuizForUser(db, { uid }, { chunkId: 'row', count: 5 });

    const allCorrect = assembled.questions.map((q) => ({ questionId: q.id, choice: 'a' }));
    const result = await scoreTestForUser(db, { uid }, { testId: assembled.testId, answers: allCorrect });

    expect(result.type).toBe('mini-quiz');
    expect(result.recommendation).toBe('move-on');
  });

  test('a low-scoring mini-quiz recommends review-again', async () => {
    await seedQuestion('q1', 'row', 'a');
    const assembled = await assembleMiniQuizForUser(db, { uid }, { chunkId: 'row', count: 1 });

    const result = await scoreTestForUser(db, { uid }, {
      testId: assembled.testId,
      answers: [{ questionId: assembled.questions[0].id, choice: 'wrong' }],
    });

    expect(result.recommendation).toBe('review-again');
  });

  test('scores a baseline section, advances currentSection, and does not mark freeTestUsedAt yet', async () => {
    await seedQuestion('q1', 'row', 'a');
    await db
      .collection('baselineTests')
      .doc(CURRENT_BASELINE_VERSION)
      .set({
        sections: [
          { section: 1, questionIds: ['q1'] },
          { section: 2, questionIds: [] },
          { section: 3, questionIds: [] },
        ],
        createdAt: new Date(),
      });
    const started = await startOrResumeBaselineForUser(db, { uid });

    const result = await scoreTestForUser(db, { uid }, {
      testId: started.testId,
      answers: [{ questionId: 'q1', choice: 'a' }],
    });

    expect(result.type).toBe('baseline');
    // Answers are held back until the whole baseline is complete — in the response and in the
    // client-readable attempt doc.
    const withheld = [{ questionId: 'q1', chunkId: 'row', choice: 'a', correctAnswer: null, correct: null }];
    expect(result.perQuestion).toEqual(withheld);
    expect(result.baselineReview).toBeUndefined();
    const attemptSnap = await db.collection('users').doc(uid).collection('testAttempts').doc(started.testId).get();
    expect(attemptSnap.data()?.perQuestion).toEqual(withheld);
    expect(JSON.stringify(attemptSnap.data())).not.toContain('correctAnswer":"a');

    const progressSnap = await db.collection('users').doc(uid).collection('baseline').doc('progress').get();
    expect(progressSnap.data()?.currentSection).toBe(2);
    expect(progressSnap.data()?.completedAt).toBeNull();
    expect(progressSnap.data()?.freeTestUsedAt).toBeNull();
  });

  test('finishing the last baseline section marks completedAt and freeTestUsedAt', async () => {
    await seedQuestion('q1', 'row', 'a');
    await db
      .collection('baselineTests')
      .doc(CURRENT_BASELINE_VERSION)
      .set({ sections: [{ section: 1, questionIds: ['q1'] }], createdAt: new Date() });
    const started = await startOrResumeBaselineForUser(db, { uid });

    await scoreTestForUser(db, { uid }, {
      testId: started.testId,
      answers: [{ questionId: 'q1', choice: 'a' }],
    });

    const progressSnap = await db.collection('users').doc(uid).collection('baseline').doc('progress').get();
    expect(progressSnap.data()?.completedAt).not.toBeNull();
    expect(progressSnap.data()?.freeTestUsedAt).not.toBeNull();
  });

  test('finishing the baseline reveals every section\'s answers in baselineReview', async () => {
    await seedQuestion('q1', 'row', 'a');
    await seedQuestion('q2', 'signs', 'b');
    await db
      .collection('baselineTests')
      .doc(CURRENT_BASELINE_VERSION)
      .set({
        sections: [
          { section: 1, questionIds: ['q1'] },
          { section: 2, questionIds: ['q2'] },
        ],
        createdAt: new Date(),
      });

    const section1 = await startOrResumeBaselineForUser(db, { uid });
    await scoreTestForUser(db, { uid }, {
      testId: section1.testId,
      answers: [{ questionId: 'q1', choice: 'wrong' }],
    });
    const section2 = await startOrResumeBaselineForUser(db, { uid });
    const final = await scoreTestForUser(db, { uid }, {
      testId: section2.testId,
      answers: [{ questionId: 'q2', choice: 'b' }],
    });

    const review = [
      { questionId: 'q1', chunkId: 'row', choice: 'wrong', correctAnswer: 'a', correct: false },
      { questionId: 'q2', chunkId: 'signs', choice: 'b', correctAnswer: 'b', correct: true },
    ];
    expect(final.perQuestion).toEqual([review[1]]);
    expect(final.baselineReview).toEqual(review);

    const attemptSnap = await db.collection('users').doc(uid).collection('testAttempts').doc(section2.testId).get();
    expect(attemptSnap.data()?.baselineReview).toEqual(review);
  });

  test('rejects a baseline testId for a section that is not the caller\'s current section', async () => {
    await seedQuestion('q1', 'row', 'a');
    await db
      .collection('baselineTests')
      .doc(CURRENT_BASELINE_VERSION)
      .set({
        sections: [
          { section: 1, questionIds: ['q1'] },
          { section: 2, questionIds: [] },
        ],
        createdAt: new Date(),
      });
    await startOrResumeBaselineForUser(db, { uid }); // currentSection stays 1, not scored yet

    await expect(
      scoreTestForUser(db, { uid }, {
        testId: `baseline-${CURRENT_BASELINE_VERSION}-2`,
        answers: [],
      })
    ).rejects.toMatchObject({ code: 'already-exists' });
  });

  test("rejects a baseline testId for a different version than the caller's progress", async () => {
    await seedQuestion('q1', 'row', 'a');
    for (const version of [CURRENT_BASELINE_VERSION, 'v2']) {
      await db
        .collection('baselineTests')
        .doc(version)
        .set({ sections: [{ section: 1, questionIds: ['q1'] }], createdAt: new Date() });
    }
    await startOrResumeBaselineForUser(db, { uid }); // pins the caller to CURRENT_BASELINE_VERSION

    await expect(
      scoreTestForUser(db, { uid }, { testId: 'baseline-v2-1', answers: [] })
    ).rejects.toMatchObject({ code: 'not-found' });

    const progressSnap = await db.collection('users').doc(uid).collection('baseline').doc('progress').get();
    expect(progressSnap.data()?.completedAt).toBeNull();
  });
});
