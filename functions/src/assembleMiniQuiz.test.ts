import { getDb } from './adminApp';
import { assembleMiniQuizForUser, miniQuizSize } from './assembleMiniQuiz';

describe('assembleMiniQuizForUser', () => {
  const db = getDb();

  beforeEach(async () => {
    const snap = await db.collection('questions').get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
    // listDocuments(), not get(): the users/{uid} parent docs are never created, only their
    // subcollections, and get() skips parents that don't exist.
    const userRefs = await db.collection('users').listDocuments();
    for (const userRef of userRefs) {
      const assignments = await userRef.collection('testAssignments').get();
      await Promise.all(assignments.docs.map((d) => d.ref.delete()));
    }
  });

  async function seedQuestion(id: string, overrides: Record<string, unknown> = {}) {
    await db
      .collection('questions')
      .doc(id)
      .set({
        conceptId: 'concept-1',
        chunkId: 'right-of-way',
        sourceRef: 'DR_2337_Jan2025.pdf#p12',
        type: 'fact',
        text: `Question ${id}`,
        choices: ['a', 'b', 'c'],
        correctAnswer: 'a',
        status: 'approved',
        selfCheck: { passed: true },
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
        ...overrides,
      });
  }

  test('rejects a call with no authenticated user', async () => {
    await expect(
      assembleMiniQuizForUser(db, undefined, { chunkId: 'right-of-way' })
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  test('rejects a missing or malformed chunkId', async () => {
    await expect(
      assembleMiniQuizForUser(db, { uid: 'alice-uid' }, { chunkId: '' })
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(
      assembleMiniQuizForUser(db, { uid: 'alice-uid' }, {})
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('returns not-found for a topic with no approved questions', async () => {
    await seedQuestion('q1', { status: 'pending_review' });

    await expect(
      assembleMiniQuizForUser(db, { uid: 'alice-uid' }, { chunkId: 'right-of-way' })
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  test('shuffles each question\'s answer choices so the correct answer is not always first', async () => {
    await seedQuestion('q1', { choices: ['a', 'b', 'c', 'd'], correctAnswer: 'a' });

    // With random always 0, Fisher–Yates turns [a, b, c, d] into [b, c, d, a].
    const result = await assembleMiniQuizForUser(
      db,
      { uid: 'alice-uid' },
      { chunkId: 'right-of-way' },
      { random: () => 0 }
    );

    expect(result.questions[0].choices).toEqual(['b', 'c', 'd', 'a']);
  });

  test('returns only approved questions from the requested topic', async () => {
    await seedQuestion('q1', { chunkId: 'right-of-way', status: 'approved' });
    await seedQuestion('q2', { chunkId: 'other-topic', status: 'approved' });
    await seedQuestion('q3', { chunkId: 'right-of-way', status: 'pending_review' });

    const result = await assembleMiniQuizForUser(db, { uid: 'alice-uid' }, {
      chunkId: 'right-of-way',
    });

    expect(result.questions.map((q) => q.id)).toEqual(['q1']);
    expect(result.questions[0]).not.toHaveProperty('correctAnswer');
    expect(result.questions[0]).not.toHaveProperty('sourceRef');
  });

  test('never returns more than the topic holds even if more is requested', async () => {
    for (let i = 1; i <= 12; i++) {
      await seedQuestion(`q${i}`);
    }

    const result = await assembleMiniQuizForUser(db, { uid: 'alice-uid' }, {
      chunkId: 'right-of-way',
      count: 999,
    });

    expect(result.questions.length).toBe(12);
  });

  test('persists a mini-quiz testAssignments record with the chunkId', async () => {
    await seedQuestion('q1');

    const result = await assembleMiniQuizForUser(db, { uid: 'alice-uid' }, {
      chunkId: 'right-of-way',
    });

    const assignmentSnap = await db
      .collection('users')
      .doc('alice-uid')
      .collection('testAssignments')
      .doc(result.testId)
      .get();

    expect(assignmentSnap.data()).toMatchObject({
      type: 'mini-quiz',
      chunkId: 'right-of-way',
      scored: false,
    });
  });

  test('avoids repeating the excluded set when the pool allows it', async () => {
    await seedQuestion('q1');
    await seedQuestion('q2');

    const result = await assembleMiniQuizForUser(db, { uid: 'alice-uid' }, {
      chunkId: 'right-of-way',
      count: 1,
      excludeIds: ['q1'],
    });

    expect(result.questions.map((q) => q.id)).toEqual(['q2']);
  });

  test('falls back to the full pool when excluding would leave too few questions', async () => {
    await seedQuestion('q1');

    const result = await assembleMiniQuizForUser(db, { uid: 'alice-uid' }, {
      chunkId: 'right-of-way',
      count: 1,
      excludeIds: ['q1'],
    });

    expect(result.questions.map((q) => q.id)).toEqual(['q1']);
  });

  test('never returns explanation', async () => {
    await seedQuestion('q1', { explanation: 'Because a.' });
    const result = await assembleMiniQuizForUser(db, { uid: 'alice-uid' }, { chunkId: 'right-of-way', count: 1 });
    expect(result.questions[0]).not.toHaveProperty('explanation');
    expect(JSON.stringify(result)).not.toContain('Because a.');
  });

  test.each([
    [1, 1],
    [3, 3],
    [4, 4],
    [9, 5],
    [16, 5],
    [17, 6],
    [31, 10],
    [45, 15],
    [60, 15],
  ])('miniQuizSize(%i) is %i', (pool, expected) => {
    expect(miniQuizSize(pool)).toBe(expected);
  });

  test('with no count, the quiz is sized from the topic (31 approved → 10)', async () => {
    for (let i = 1; i <= 31; i++) await seedQuestion(`q${i}`);
    const result = await assembleMiniQuizForUser(db, { uid: 'alice-uid' }, { chunkId: 'right-of-way' });
    expect(result.questions).toHaveLength(10);
  });

  test('a big topic gets up to 15 questions', async () => {
    for (let i = 1; i <= 50; i++) await seedQuestion(`q${i}`);
    const result = await assembleMiniQuizForUser(db, { uid: 'alice-uid' }, { chunkId: 'right-of-way' });
    expect(result.questions).toHaveLength(15);
  });

  test('an explicit count is still honoured and capped at 15', async () => {
    for (let i = 1; i <= 20; i++) await seedQuestion(`q${i}`);
    const three = await assembleMiniQuizForUser(db, { uid: 'alice-uid' }, { chunkId: 'right-of-way', count: 3 });
    expect(three.questions).toHaveLength(3);
    const capped = await assembleMiniQuizForUser(db, { uid: 'alice-uid' }, { chunkId: 'right-of-way', count: 40 });
    expect(capped.questions).toHaveLength(15);
  });
});
