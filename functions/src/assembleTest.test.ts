import { Timestamp } from 'firebase-admin/firestore';
import { getDb } from './adminApp';
import {
  assembleTestForUser,
  MAX_PER_TOPIC,
  MIN_SCENARIO_COUNT,
  recentlySeenQuestionIds,
  selectPracticeQuestions,
} from './assembleTest';
import { seededRandom } from './shuffle';

interface Item {
  id: string;
  type?: unknown;
  chunkId: string;
}

// Builds `topics` topics, each with `scenario` scenario and `fact` fact questions.
function buildPool(topics: number, scenario: number, fact: number, prefix = 't'): Item[] {
  const pool: Item[] = [];
  for (let t = 0; t < topics; t++) {
    for (let i = 0; i < scenario; i++) pool.push({ id: `${prefix}${t}-s${i}`, type: 'scenario', chunkId: `${prefix}${t}` });
    for (let i = 0; i < fact; i++) pool.push({ id: `${prefix}${t}-f${i}`, type: 'fact', chunkId: `${prefix}${t}` });
  }
  return pool;
}

const opts = { minScenario: MIN_SCENARIO_COUNT, maxPerTopic: MAX_PER_TOPIC };
const select = (pool: Item[], seed: number, count = 25) =>
  selectPracticeQuestions(pool, count, seededRandom(`seed-${seed}`), opts, (x) => x);
const scenarioCount = (items: Item[]) => items.filter((x) => x.type === 'scenario').length;
const maxTopic = (items: Item[]) => {
  const counts = new Map<string, number>();
  for (const x of items) counts.set(x.chunkId, (counts.get(x.chunkId) ?? 0) + 1);
  return Math.max(...counts.values());
};

describe('selectPracticeQuestions', () => {
  test('meets the scenario minimum and topic cap across seeds', () => {
    const pool = buildPool(45, 2, 4);
    for (let seed = 1; seed <= 200; seed++) {
      const result = select(pool, seed);
      expect(result).toHaveLength(25);
      expect(scenarioCount(result)).toBeGreaterThanOrEqual(8);
      expect(maxTopic(result)).toBeLessThanOrEqual(2);
      expect(new Set(result.map((x) => x.id)).size).toBe(25);
    }
  });

  test('includes every scenario question when there are fewer than the minimum', () => {
    const pool = [...buildPool(3, 1, 0, 's'), ...buildPool(30, 0, 2, 'f')];
    for (let seed = 1; seed <= 200; seed++) {
      const result = select(pool, seed);
      expect(result).toHaveLength(25);
      expect(scenarioCount(result)).toBe(3);
    }
  });

  test('works with no scenario questions', () => {
    const pool = buildPool(30, 0, 2);
    for (let seed = 1; seed <= 200; seed++) {
      const result = select(pool, seed);
      expect(result).toHaveLength(25);
      expect(maxTopic(result)).toBeLessThanOrEqual(2);
    }
  });

  test('scenario minimum wins over the topic cap', () => {
    const pool = [...buildPool(3, 4, 0, 's'), ...buildPool(50, 0, 2, 'f')];
    for (let seed = 1; seed <= 200; seed++) {
      expect(scenarioCount(select(pool, seed))).toBeGreaterThanOrEqual(8);
    }
  });

  test('relaxes the cap to fill the test', () => {
    const pool = buildPool(2, 0, 20);
    for (let seed = 1; seed <= 200; seed++) {
      expect(select(pool, seed)).toHaveLength(25);
    }
  });

  test('returns the whole pool when it is smaller than count', () => {
    const pool = buildPool(5, 0, 2);
    for (let seed = 1; seed <= 200; seed++) {
      expect(select(pool, seed)).toHaveLength(10);
    }
  });

  test('missing or odd type counts as fact', () => {
    const pool: Item[] = [];
    for (let t = 0; t < 15; t++) {
      pool.push({ id: `a${t}`, type: undefined, chunkId: `t${t}` });
      pool.push({ id: `b${t}`, type: 'weird', chunkId: `t${t}` });
      pool.push({ id: `c${t}`, type: 'Scenario', chunkId: `t${t}` });
    }
    for (let seed = 1; seed <= 200; seed++) {
      const result = select(pool, seed);
      expect(result).toHaveLength(25);
      expect(scenarioCount(result)).toBe(0);
    }
  });

  test('odd types are not mistaken for scenario questions when real ones are scarce', () => {
    const real = buildPool(5, 1, 0, 'r'); // exactly 5 real scenario questions, fewer than the minimum of 8
    const pool: Item[] = [...real];
    for (let t = 0; t < 15; t++) {
      pool.push({ id: `a${t}`, type: undefined, chunkId: `o${t}` });
      pool.push({ id: `b${t}`, type: 'weird', chunkId: `o${t}` });
      pool.push({ id: `c${t}`, type: 'Scenario', chunkId: `o${t}` });
    }
    for (let seed = 1; seed <= 200; seed++) {
      const result = select(pool, seed);
      expect(result).toHaveLength(25);
      expect(scenarioCount(result)).toBe(5);
    }
  });

  test('scenario questions are not grouped', () => {
    const pool = buildPool(45, 2, 4);
    const result = select(pool, 7);
    const positions = result.map((x, i) => (x.type === 'scenario' ? i : -1)).filter((i) => i >= 0);
    const k = positions.length;
    const first = Array.from({ length: k }, (_, i) => i);
    const last = Array.from({ length: k }, (_, i) => 25 - k + i);
    expect(positions).not.toEqual(first);
    expect(positions).not.toEqual(last);
  });

  test('no isSeen gives the same picks as before', () => {
    const pool = buildPool(45, 2, 4);
    for (let seed = 1; seed <= 50; seed++) {
      const without = select(pool, seed);
      const withSeen = selectPracticeQuestions(
        pool, 25, seededRandom(`seed-${seed}`), { ...opts, isSeen: () => false }, (x) => x
      );
      expect(withSeen.map((x) => x.id)).toEqual(without.map((x) => x.id));
    }
  });

  test('avoids seen questions when enough unseen remain', () => {
    const pool = buildPool(45, 2, 4);
    const seen = new Set(select(pool, 1).map((x) => x.id));
    const second = selectPracticeQuestions(
      pool, 25, seededRandom('seed-2'), { ...opts, isSeen: (x) => seen.has(x.id) }, (x) => x
    );
    expect(second.filter((x) => seen.has(x.id))).toHaveLength(0);
    expect(second).toHaveLength(25);
    expect(scenarioCount(second)).toBeGreaterThanOrEqual(8);
    expect(maxTopic(second)).toBeLessThanOrEqual(2);
  });

  test('tops up from seen questions when the pool is small', () => {
    const pool = buildPool(10, 1, 3); // 40 items
    const seen = new Set(select(pool, 1).map((x) => x.id)); // 25 seen
    const result = selectPracticeQuestions(
      pool, 25, seededRandom('seed-2'), { ...opts, isSeen: (x) => seen.has(x.id) }, (x) => x
    );
    expect(result).toHaveLength(25);
    const ids = new Set(result.map((x) => x.id));
    for (const x of pool) if (!seen.has(x.id)) expect(ids.has(x.id)).toBe(true);
  });

  test('pool of exactly 25 repeats the whole test', () => {
    const pool = buildPool(25, 0, 1);
    const result = selectPracticeQuestions(
      pool, 25, seededRandom('seed-1'), { ...opts, isSeen: () => true }, (x) => x
    );
    expect(result).toHaveLength(25);
  });

  test('scenario minimum is met from seen scenario questions', () => {
    const pool = [...buildPool(10, 1, 0, 's'), ...buildPool(40, 0, 1, 'f')];
    for (let seed = 1; seed <= 50; seed++) {
      const result = selectPracticeQuestions(
        pool, 25, seededRandom(`seed-${seed}`),
        { ...opts, isSeen: (x) => x.type === 'scenario' }, (x) => x
      );
      expect(scenarioCount(result)).toBeGreaterThanOrEqual(MIN_SCENARIO_COUNT);
    }
  });

  test('an unseen question over the cap beats a seen one under it', () => {
    const pool: Item[] = [];
    for (let i = 0; i < 5; i++) pool.push({ id: `a${i}`, type: 'fact', chunkId: 'a' });
    for (let t = 0; t < 20; t++) pool.push({ id: `o${t}`, type: 'fact', chunkId: `o${t}` });
    const result = selectPracticeQuestions(
      pool, 5, seededRandom('x'),
      { minScenario: 0, maxPerTopic: 2, isSeen: (x) => x.id.startsWith('o') }, (x) => x
    );
    expect(result.every((x) => x.chunkId === 'a')).toBe(true);
  });
});


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

    // A random source just under 1 makes Fisher–Yates swap each item with itself, so choices
    // keep their stored order and can be compared exactly.
    const result = await assembleTestForUser(db, { uid: 'alice-uid' }, { count: 1, random: () => 0.999999 });

    expect(result.questions[0]).toEqual({
      id: 'q1',
      text: 'Question q1',
      choices: ['a', 'b', 'c'],
      type: 'fact',
      chunkId: 'chunk-1',
      conceptId: 'concept-1',
    });
  });

  test('shuffles each question\'s answer choices so the correct answer is not always first', async () => {
    await seedQuestion('q1', { choices: ['a', 'b', 'c', 'd'], correctAnswer: 'a' });

    // With random always 0, Fisher–Yates turns [a, b, c, d] into [b, c, d, a].
    const result = await assembleTestForUser(db, { uid: 'alice-uid' }, { count: 1, random: () => 0 });

    expect(result.questions[0].choices).toEqual(['b', 'c', 'd', 'a']);
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

  test('persists a practice testAssignments record for the caller', async () => {
    await seedQuestion('q1');
    await seedQuestion('q2');

    const result = await assembleTestForUser(db, { uid: 'alice-uid' }, { count: 2 });

    const assignmentSnap = await db
      .collection('users')
      .doc('alice-uid')
      .collection('testAssignments')
      .doc(result.testId)
      .get();

    expect(assignmentSnap.exists).toBe(true);
    const assignment = assignmentSnap.data()!;
    expect(assignment.type).toBe('practice');
    expect(assignment.scored).toBe(false);
    expect(assignment.questionIds.sort()).toEqual(result.questions.map((q) => q.id).sort());
    expect(assignment.createdAt).toBeDefined();
  });

  test('never returns explanation', async () => {
    await seedQuestion('q1', { explanation: 'Because a.' });
    const result = await assembleTestForUser(db, { uid: 'alice-uid' }, { count: 1 });
    expect(result.questions[0]).not.toHaveProperty('explanation');
    expect(JSON.stringify(result)).not.toContain('Because a.');
  });

  test('assembleTestForUser applies the mix', async () => {
    for (let i = 0; i < 10; i++) await seedQuestion(`s${i}`, { type: 'scenario', chunkId: `c${i % 20}` });
    for (let i = 0; i < 30; i++) await seedQuestion(`f${i}`, { type: 'fact', chunkId: `c${i % 20}` });

    const result = await assembleTestForUser(
      db,
      { uid: 'alice-uid' },
      { count: 25, random: seededRandom('mix') }
    );

    expect(result.questions).toHaveLength(25);
    expect(result.questions.filter((q) => q.type === 'scenario').length).toBeGreaterThanOrEqual(8);
    const perTopic = new Map<string, number>();
    for (const q of result.questions) perTopic.set(q.chunkId, (perTopic.get(q.chunkId) ?? 0) + 1);
    expect(Math.max(...perTopic.values())).toBeLessThanOrEqual(2);
  });

  // Each test below uses its own uid so attempts seeded by one never leak into another.
  async function seedAttempt(uid: string, id: string, type: string, millis: number, perQuestion: unknown) {
    await db
      .collection('users').doc(uid).collection('testAttempts').doc(id)
      .set({ type, createdAt: Timestamp.fromMillis(millis), perQuestion });
  }
  const pq = (...ids: string[]) => ids.map((questionId) => ({ questionId }));
  async function seedMany(n: number) {
    for (let i = 1; i <= n; i++) await seedQuestion(`q${i}`, { chunkId: `c${i}` });
  }

  test('excludes questions from the last 3 practice attempts', async () => {
    await seedMany(30);
    await seedAttempt('u-excl', 'a1', 'practice', 1000, pq('q1', 'q2'));
    await seedAttempt('u-excl', 'a2', 'practice', 2000, pq('q3'));
    await seedAttempt('u-excl', 'a3', 'practice', 3000, pq('q4', 'q5'));

    const result = await assembleTestForUser(db, { uid: 'u-excl' }, { count: 25 });

    const ids = result.questions.map((q) => q.id);
    expect(ids).toHaveLength(25);
    for (const x of ['q1', 'q2', 'q3', 'q4', 'q5']) expect(ids).not.toContain(x);
  });

  test('only the 3 most recent practice attempts count', async () => {
    await seedAttempt('u-recent', 'a1', 'practice', 1000, pq('old'));
    await seedAttempt('u-recent', 'a2', 'practice', 2000, pq('q2'));
    await seedAttempt('u-recent', 'a3', 'practice', 3000, pq('q3'));
    await seedAttempt('u-recent', 'a4', 'practice', 4000, pq('q4'));

    const seen = await recentlySeenQuestionIds(db, 'u-recent');

    expect([...seen].sort()).toEqual(['q2', 'q3', 'q4']);
  });

  test('mini-quiz and baseline attempts do not count', async () => {
    await seedAttempt('u-types', 'a1', 'mini-quiz', 1000, pq('q1'));
    await seedAttempt('u-types', 'a2', 'baseline', 2000, pq('q2'));
    await seedAttempt('u-types', 'a3', 'practice', 3000, pq('q3'));

    const seen = await recentlySeenQuestionIds(db, 'u-types');

    expect([...seen]).toEqual(['q3']);
  });

  test('attempts with missing or malformed perQuestion are ignored', async () => {
    await seedMany(30);
    const uid = 'u-bad';
    await db.collection('users').doc(uid).collection('testAttempts').doc('a0')
      .set({ type: 'practice', createdAt: Timestamp.fromMillis(500) });
    await seedAttempt(uid, 'a1', 'practice', 1000, 'x');
    await seedAttempt(uid, 'a2', 'practice', 2000, [{}]);
    await seedAttempt(uid, 'a3', 'practice', 3000, [{ questionId: 7 }]);

    const result = await assembleTestForUser(db, { uid }, { count: 25 });

    expect(result.questions).toHaveLength(25);
  });

  test('a user with no attempts behaves as before', async () => {
    await seedMany(30);
    const a = await assembleTestForUser(db, { uid: 'u-none' }, { count: 25, random: seededRandom('same') });
    const b = await assembleTestForUser(db, { uid: 'u-none-2' }, { count: 25, random: seededRandom('same') });
    expect(a.questions).toHaveLength(25);
    expect(a.questions.map((q) => q.id)).toEqual(b.questions.map((q) => q.id));
  });

  test('does not touch freeTestUsedAt', async () => {
    await seedMany(30);
    await db.collection('users').doc('u-free').set({ freeTestUsedAt: null });

    await assembleTestForUser(db, { uid: 'u-free' }, { count: 25 });

    const snap = await db.collection('users').doc('u-free').get();
    expect(snap.data()!.freeTestUsedAt).toBeNull();
  });
});
