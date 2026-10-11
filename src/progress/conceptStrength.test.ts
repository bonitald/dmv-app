import type { Topic } from '../topics/topicsData';
import { basisLine, conceptStrength, hasEvidence, sortRows, toReportRows } from './conceptStrength';

test.each([
  [0.8, 'strong'], [1, 'strong'], [0.79, 'shaky'], [0.5, 'shaky'], [0.49, 'likely-gap'], [0, 'likely-gap'],
])('mini-quiz %p → %s', (score, strength) => {
  expect(conceptStrength({ miniQuiz: { score } }).strength).toBe(strength);
});

test('mini-quiz wins over practice and baseline', () => {
  expect(conceptStrength({ miniQuiz: { score: 0.6 }, practice: { correct: 3, total: 3 }, baseline: 'got-it' })).toMatchObject({
    strength: 'shaky', source: 'mini-quiz',
  });
});

test('practice needs at least 3 answers', () => {
  expect(conceptStrength({ practice: { correct: 2, total: 2 }, baseline: 'missed-it' })).toMatchObject({ strength: 'missed-it', source: 'baseline' });
  expect(conceptStrength({ practice: { correct: 2, total: 3 } })).toMatchObject({ strength: 'shaky', source: 'practice', correct: 2, total: 3 });
});

test('baseline only is got it / missed it; nothing is not tested', () => {
  expect(conceptStrength({ baseline: 'got-it' }).strength).toBe('got-it');
  expect(conceptStrength({ baseline: 'missed-it' }).strength).toBe('missed-it');
  expect(conceptStrength({})).toEqual({ strength: 'not-tested', source: 'none' });
});

test('basis lines', () => {
  expect(basisLine(conceptStrength({ miniQuiz: { score: 0.67, correct: 10, total: 15 } }))).toBe('10 of 15 right in your latest quiz');
  expect(basisLine(conceptStrength({ miniQuiz: { score: 0.7 } }))).toBe('70% in your latest quiz');
  expect(basisLine(conceptStrength({ practice: { correct: 4, total: 5 } }))).toBe('4 of 5 right in practice tests');
  expect(basisLine(conceptStrength({ baseline: 'got-it' }))).toBe('From 1 baseline question');
  expect(basisLine(conceptStrength({}))).toBe('Not tested yet');
});

const topic = (chunkId: string, order: number, approvedQuestionCount = 5): Topic => ({ chunkId, title: chunkId.toUpperCase(), description: '', order, approvedQuestionCount });
const topics = [topic('a', 1), topic('b', 2), topic('c', 3), topic('d', 4), topic('e', 5, 0)];
const progress = {
  a: { status: 'reviewed' as const, latestMiniQuizScore: 0.9, latestMiniQuizCorrect: 9, latestMiniQuizTotal: 10 },
  c: { status: 'in-progress' as const, latestMiniQuizScore: 0.6 },
};
const baseline = new Map<string, 'got-it' | 'missed-it'>([['b', 'missed-it'], ['c', 'got-it']]);

test('rows in handbook order with each topic\'s best evidence', () => {
  const rows = toReportRows(topics, progress, baseline);
  expect(rows.map((r) => [r.chunkId, r.result.strength, r.comingSoon])).toEqual([
    ['a', 'strong', false], ['b', 'missed-it', false], ['c', 'shaky', false], ['d', 'not-tested', false], ['e', 'not-tested', true],
  ]);
});

test('needs work first: gap and missed, shaky, not tested, strong and got it; handbook order within', () => {
  const rows = toReportRows(
    [...topics, topic('f', 6)],
    { ...progress, f: { status: 'in-progress', latestMiniQuizScore: 0.1 } },
    baseline
  );
  expect(sortRows(rows, 'needs-work').map((r) => r.chunkId)).toEqual(['b', 'f', 'c', 'd', 'e', 'a']);
  expect(sortRows(rows, 'handbook').map((r) => r.chunkId)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
});

test('hasEvidence is false only when every topic is not tested', () => {
  expect(hasEvidence(toReportRows(topics, {}, new Map()))).toBe(false);
  expect(hasEvidence(toReportRows(topics, progress, new Map()))).toBe(true);
});
