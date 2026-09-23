import { getDb } from './adminApp';
import { startOrResumeBaselineForUser, CURRENT_BASELINE_VERSION } from './startOrResumeBaseline';

describe('startOrResumeBaselineForUser', () => {
  const db = getDb();

  beforeEach(async () => {
    for (const collection of ['baselineTests', 'questions']) {
      const snap = await db.collection(collection).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
    }
    // listDocuments(), not get(): the users/{uid} parent docs are never created, only their
    // subcollections, and get() skips parents that don't exist.
    const userRefs = await db.collection('users').listDocuments();
    for (const userRef of userRefs) {
      const baselineSnap = await userRef.collection('baseline').get();
      await Promise.all(baselineSnap.docs.map((d) => d.ref.delete()));
    }
  });

  async function seedBaseline() {
    await db
      .collection('questions')
      .doc('q1')
      .set({
        conceptId: 'c1',
        chunkId: 'row',
        sourceRef: 'p.1',
        type: 'fact',
        text: 'Section 1 question',
        choices: ['a', 'b'],
        correctAnswer: 'a',
        status: 'approved',
        selfCheck: { passed: true },
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
      });
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
  }

  test('rejects a call with no authenticated user', async () => {
    await seedBaseline();
    await expect(startOrResumeBaselineForUser(db, undefined)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  test('a first-time user gets section 1', async () => {
    await seedBaseline();

    const result = await startOrResumeBaselineForUser(db, { uid: 'alice-uid' });

    expect(result.section).toBe(1);
    expect(result.totalSections).toBe(3);
    expect(result.testId).toBe(`baseline-${CURRENT_BASELINE_VERSION}-1`);
    expect(result.questions.map((q) => q.id)).toEqual(['q1']);
    expect(result.questions[0]).not.toHaveProperty('correctAnswer');
  });

  test('a returning user with progress gets their current section again', async () => {
    await seedBaseline();
    await db
      .collection('users')
      .doc('alice-uid')
      .collection('baseline')
      .doc('progress')
      .set({
        version: CURRENT_BASELINE_VERSION,
        currentSection: 2,
        completedAt: null,
        freeTestUsedAt: null,
        createdAt: new Date(),
      });

    const result = await startOrResumeBaselineForUser(db, { uid: 'alice-uid' });

    expect(result.section).toBe(2);
  });

  test('rejects restarting an already-completed baseline', async () => {
    await seedBaseline();
    await db
      .collection('users')
      .doc('alice-uid')
      .collection('baseline')
      .doc('progress')
      .set({
        version: CURRENT_BASELINE_VERSION,
        currentSection: 3,
        completedAt: new Date(),
        freeTestUsedAt: new Date(),
        createdAt: new Date(),
      });

    await expect(startOrResumeBaselineForUser(db, { uid: 'alice-uid' })).rejects.toMatchObject({
      code: 'already-exists',
    });
  });

  test('two different users receive identical section-1 questions', async () => {
    await seedBaseline();

    const alice = await startOrResumeBaselineForUser(db, { uid: 'alice-uid' });
    const bob = await startOrResumeBaselineForUser(db, { uid: 'bob-uid' });

    expect(alice.questions).toEqual(bob.questions);
  });
});
