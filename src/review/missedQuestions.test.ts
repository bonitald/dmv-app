import type { Topic } from '../topics/topicsData';
import { groupByTopic, latestMisses, type AttemptDoc } from './missedQuestions';

const q = (questionId: string, correct: boolean | null, over: Record<string, unknown> = {}) => ({
  questionId, chunkId: 'row', choice: 'x', correctAnswer: correct ? 'x' : 'y', correct, text: `T ${questionId}`, ...over,
});
const attempt = (testId: string, at: number | null, perQuestion: unknown[], type = 'practice'): AttemptDoc => ({
  testId, createdAtMs: at, data: { type, perQuestion },
});
const ids = (attempts: AttemptDoc[]) => latestMisses(attempts).map((m) => `${m.questionId}@${m.testId}`);

test('a miss answered right later drops off', () => {
  expect(ids([attempt('a', 1, [q('q1', false)]), attempt('b', 2, [q('q1', true)])])).toEqual([]);
});

test('missed twice is listed once, from the latest attempt', () => {
  expect(ids([attempt('b', 2, [q('q1', false)]), attempt('a', 1, [q('q1', false)])])).toEqual(['q1@b']);
});

test('a mini-quiz miss then a practice right clears it', () => {
  expect(ids([attempt('m', 1, [q('q1', false)], 'mini-quiz'), attempt('p', 2, [q('q1', true)])])).toEqual([]);
});

test('right earlier, missed later is listed', () => {
  expect(ids([attempt('a', 1, [q('q1', true)]), attempt('b', 2, [q('q1', false)])])).toEqual(['q1@b']);
});

test('removed and ungraded entries neither add nor clear a miss', () => {
  const misses = ids([
    attempt('a', 1, [q('q1', false)]),
    attempt('b', 2, [q('q1', null), q('q2', true, { unavailable: true }), q('q3', null)]),
  ]);
  expect(misses).toEqual(['q1@a']);
});

test('the baseline counts through its final baselineReview only', () => {
  const final: AttemptDoc = {
    testId: 'baseline-v1-3', createdAtMs: 3,
    data: { type: 'baseline', perQuestion: [q('s3', false)], baselineReview: [q('s1', false), q('s3', true)] },
  };
  const earlier = attempt('baseline-v1-1', 1, [q('s1', null)], 'baseline');
  expect(ids([earlier, final])).toEqual(['s1@baseline-v1-3']);
});

test('a skipped question counts as missed', () => {
  expect(ids([attempt('a', 1, [q('q1', false, { choice: null })])])).toEqual(['q1@a']);
});

test('a pending server time counts as newest', () => {
  expect(ids([attempt('new', null, [q('q1', true)]), attempt('old', 5, [q('q1', false)])])).toEqual([]);
});

test('malformed attempts are ignored', () => {
  const bad: AttemptDoc[] = [
    { testId: 'x', createdAtMs: 1, data: { type: 'practice' } },
    { testId: 'y', createdAtMs: 2, data: { type: 'practice', perQuestion: 'nope' } },
    attempt('z', 3, [null, 5, { questionId: 7 }, q('q1', false)]),
  ];
  expect(ids(bad)).toEqual(['q1@z']);
});

const topic = (chunkId: string, title: string, order: number): Topic =>
  ({ chunkId, title, description: '', order, approvedQuestionCount: 1 }) as Topic;

test('groupByTopic: catalog order, unknown topics next, no topic last', () => {
  const misses = latestMisses([
    attempt('a', 1, [
      q('n1', false, { chunkId: null }),
      q('u1', false, { chunkId: 'unknown' }),
      q('s1', false, { chunkId: 'signs' }),
      q('r1', false, { chunkId: 'row' }),
      q('r2', false, { chunkId: 'row' }),
    ]),
  ]);
  const groups = groupByTopic(misses, [topic('row', 'Right of way', 1), topic('signs', 'Signs', 2)]);
  expect(groups.map((g) => [g.title, g.questions.length])).toEqual([
    ['Right of way', 2], ['Signs', 1], ['unknown', 1], ['Other', 1],
  ]);
});
