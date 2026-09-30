import type { ReviewItem } from '../review/reviewData';
import { finalBaselineTestId, summarizeBaseline, trackingLine } from './baselineResultsData';

const item = (chunkId: string | null, outcome: ReviewItem['outcome']): ReviewItem => ({
  questionId: `q-${chunkId}`,
  chunkId,
  text: 'Q',
  choices: ['a', 'b'],
  type: 'fact',
  choice: outcome === 'skipped' ? null : 'a',
  correctAnswer: 'a',
  explanation: null,
  outcome,
});
const items = (right: number, wrong: number) => [
  ...Array.from({ length: right }, (_, i) => item(`r${i}`, 'right')),
  ...Array.from({ length: wrong }, (_, i) => item(`w${i}`, 'wrong')),
];

test('37 of 45 is 82% and at the mark', () => {
  const s = summarizeBaseline(items(37, 8), []);
  expect(s).toMatchObject({ correctCount: 37, totalCount: 45, percent: 82, atPassMark: true });
  expect(trackingLine(s)).toBe(
    "The real test needs 80%. You're off to a strong start — practice tests will tell you when you're ready."
  );
});

test('exactly 36 of 45 (80%) counts as at the mark', () => {
  expect(summarizeBaseline(items(36, 9), []).atPassMark).toBe(true);
});

test('35 of 45 rounds to 78% and is below the mark', () => {
  const s = summarizeBaseline(items(35, 10), []);
  expect(s).toMatchObject({ percent: 78, atPassMark: false });
  expect(trackingLine(s)).toBe("The real test needs 80%. Here's where to focus first.");
});

test('never says pass or fail', () => {
  for (const [r, w] of [
    [45, 0],
    [0, 45],
    [36, 9],
  ]) {
    expect(trackingLine(summarizeBaseline(items(r, w), []))).not.toMatch(/pass|fail/i);
  }
});

test('topics in handbook order with got it / missed it / not tested; first miss in that order', () => {
  const s = summarizeBaseline(
    [item('b', 'wrong'), item('a', 'right'), item('c', 'skipped'), item(null, 'removed')],
    [
      { chunkId: 'a', title: 'A', order: 1 },
      { chunkId: 'b', title: 'B', order: 2 },
      { chunkId: 'c', title: 'C', order: 3 },
      { chunkId: 'd', title: 'D', order: 4 },
    ]
  );
  expect(s.topics).toEqual([
    { chunkId: 'a', title: 'A', result: 'got-it' },
    { chunkId: 'b', title: 'B', result: 'missed-it' },
    { chunkId: 'c', title: 'C', result: 'missed-it' },
    { chunkId: 'd', title: 'D', result: 'not-tested' },
  ]);
  expect(s.firstMissedChunkId).toBe('b');
  // The removed question doesn't count.
  expect(s).toMatchObject({ correctCount: 1, totalCount: 3 });
});

test('topics missing from the catalog (or no catalog) still show, titled by chunkId', () => {
  const s = summarizeBaseline([item('x', 'wrong'), item('a', 'right')], [
    { chunkId: 'a', title: 'A', order: 1 },
  ]);
  expect(s.topics).toEqual([
    { chunkId: 'a', title: 'A', result: 'got-it' },
    { chunkId: 'x', title: 'x', result: 'missed-it' },
  ]);
});

test('all correct: no first miss', () => {
  expect(summarizeBaseline(items(45, 0), []).firstMissedChunkId).toBeNull();
});

test('nothing gradable: 0%, not at the mark', () => {
  expect(summarizeBaseline([item(null, 'removed')], [])).toMatchObject({
    totalCount: 0,
    percent: 0,
    atPassMark: false,
  });
});

test('final attempt id is the last section', () => {
  expect(finalBaselineTestId('v1')).toBe('baseline-v1-3');
});
