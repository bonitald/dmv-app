import { getDb } from './adminApp';
import { assembleTestForUser } from './assembleTest';

describe('assembleTestForUser', () => {
  const db = getDb();

  beforeEach(async () => {
    const snap = await db.collection('questions').get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  });

  async function seedQuestion(id: string, overrides: Record<string, unknown> = {}) {
    await db
      .collection('questions')
      .doc(id)
      .set({
        conceptId: 'concept-1',
        chunkId: 'chunk-1',
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
    await seedQuestion('q1');

    await expect(assembleTestForUser(db, undefined, { count: 1 })).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  test('returns only approved questions, excluding non-approved statuses', async () => {
    await seedQuestion('q1', { status: 'approved' });
    await seedQuestion('q2', { status: 'pending_review' });
    await seedQuestion('q3', { status: 'flagged' });
    await seedQuestion('q4', { status: 'rejected' });

    const result = await assembleTestForUser(db, { uid: 'alice-uid' }, { count: 10 });

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].id).toBe('q1');
  });

  test('returns only the client-safe fields, not sourceRef/selfCheck/review metadata', async () => {
    await seedQuestion('q1');

    const result = await assembleTestForUser(db, { uid: 'alice-uid' }, { count: 1 });

    expect(result.questions[0]).toEqual({
      id: 'q1',
      text: 'Question q1',
      choices: ['a', 'b', 'c'],
      type: 'fact',
      conceptId: 'concept-1',
    });
  });

  test('returns at most `count` questions', async () => {
    await seedQuestion('q1');
    await seedQuestion('q2');
    await seedQuestion('q3');

    const result = await assembleTestForUser(db, { uid: 'alice-uid' }, { count: 2 });

    expect(result.questions).toHaveLength(2);
  });

  test('returns whatever is available when fewer than `count` approved questions exist', async () => {
    await seedQuestion('q1');

    const result = await assembleTestForUser(db, { uid: 'alice-uid' }, { count: 25 });

    expect(result.questions).toHaveLength(1);
  });

  test('includes a generated testId that differs between calls', async () => {
    await seedQuestion('q1');

    const first = await assembleTestForUser(db, { uid: 'alice-uid' }, { count: 1 });
    const second = await assembleTestForUser(db, { uid: 'alice-uid' }, { count: 1 });

    expect(first.testId).toBeTruthy();
    expect(first.testId).not.toBe(second.testId);
  });

  test('selection order depends on the injected random source (randomized, not fixed)', async () => {
    await seedQuestion('q1');
    await seedQuestion('q2');
    await seedQuestion('q3');

    const ascending = await assembleTestForUser(
      db,
      { uid: 'alice-uid' },
      { count: 3, random: () => 0 }
    );
    const descending = await assembleTestForUser(
      db,
      { uid: 'alice-uid' },
      { count: 3, random: () => 0.999 }
    );

    const ascendingIds = ascending.questions.map((q) => q.id);
    const descendingIds = descending.questions.map((q) => q.id);
    expect(ascendingIds).not.toEqual(descendingIds);
  });
});
