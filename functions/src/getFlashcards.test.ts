import { getDb } from './adminApp';
import { getFlashcardsForUser, RATE_LIMIT_MAX_CALLS } from './getFlashcards';

describe('getFlashcardsForUser', () => {
  const db = getDb();

  beforeEach(async () => {
    const snap = await db.collection('questions').get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
    // listDocuments(), not get(): the users/{uid} parent docs are never created, only their
    // subcollections, and get() skips parents that don't exist.
    const userRefs = await db.collection('users').listDocuments();
    for (const userRef of userRefs) {
      const rateLimits = await userRef.collection('rateLimits').get();
      await Promise.all(rateLimits.docs.map((d) => d.ref.delete()));
    }
  });

  async function seedQuestion(id: string, overrides: Record<string, unknown> = {}) {
    await db
      .collection('questions')
      .doc(id)
      .set({
        conceptId: 'concept-1',
        chunkId: 'right-of-way',
        sourceRef: 'p.1',
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
    await expect(getFlashcardsForUser(db, undefined, 'right-of-way')).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  test('rejects a missing chunkId', async () => {
    await expect(getFlashcardsForUser(db, { uid: 'alice-uid' }, '')).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  test('returns not-found for a topic with no approved questions', async () => {
    await seedQuestion('q1', { status: 'pending_review' });

    await expect(
      getFlashcardsForUser(db, { uid: 'alice-uid' }, 'right-of-way')
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  test('returns cards with answers, excluding sourceRef/selfCheck/review metadata', async () => {
    await seedQuestion('q1');

    const result = await getFlashcardsForUser(db, { uid: 'alice-uid' }, 'right-of-way');

    expect(result.chunkId).toBe('right-of-way');
    expect(result.cards).toEqual([
      {
        id: 'q1',
        text: 'Question q1',
        choices: ['a', 'b', 'c'],
        correctAnswer: 'a',
        type: 'fact',
        chunkId: 'right-of-way',
        conceptId: 'concept-1',
      },
    ]);
  });

  test('nothing is written to testAttempts or testAssignments', async () => {
    await seedQuestion('q1');

    await getFlashcardsForUser(db, { uid: 'alice-uid' }, 'right-of-way');

    const assignments = await db
      .collection('users')
      .doc('alice-uid')
      .collection('testAssignments')
      .get();
    expect(assignments.empty).toBe(true);
  });

  test('rejects once the per-user rate limit is exceeded', async () => {
    await seedQuestion('q1');
    const now = () => 1000;

    for (let i = 0; i < RATE_LIMIT_MAX_CALLS; i++) {
      await getFlashcardsForUser(db, { uid: 'alice-uid' }, 'right-of-way', { now });
    }

    await expect(
      getFlashcardsForUser(db, { uid: 'alice-uid' }, 'right-of-way', { now })
    ).rejects.toMatchObject({ code: 'resource-exhausted' });
  });

  test('rate limit resets after the window elapses', async () => {
    await seedQuestion('q1');
    let now = 0;
    for (let i = 0; i < RATE_LIMIT_MAX_CALLS; i++) {
      await getFlashcardsForUser(db, { uid: 'alice-uid' }, 'right-of-way', { now: () => now });
    }

    now = 11 * 60 * 1000; // past the 10-minute window
    await expect(
      getFlashcardsForUser(db, { uid: 'alice-uid' }, 'right-of-way', { now: () => now })
    ).resolves.toBeDefined();
  });
});
