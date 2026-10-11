import type { PerQuestionResult } from '../api/types';
import {
  applyQuizResults,
  cardHistory,
  gradedByTopic,
  NO_HISTORY,
  parseTopicHistory,
} from './cardPerformanceData';

const r = (questionId: string, correct: boolean | null, over: Partial<PerQuestionResult> = {}): PerQuestionResult => ({
  questionId,
  chunkId: 'row',
  choice: correct === null ? null : 'x',
  correctAnswer: 'y',
  correct,
  ...over,
});

test('wrong, wrong, right accumulates to 3 graded, 2 missed, last correct', () => {
  let h = NO_HISTORY;
  h = applyQuizResults(h, [r('q1', false)]);
  h = applyQuizResults(h, [r('q1', false)]);
  h = applyQuizResults(h, [r('q1', true)]);
  expect(cardHistory(h, 'q1')).toEqual({ graded: 3, missed: 2, correctStreak: 1, lastCorrect: true });
});

test('a miss resets the correct streak', () => {
  let h = applyQuizResults(NO_HISTORY, [r('q1', true)]);
  h = applyQuizResults(h, [r('q1', true)]);
  h = applyQuizResults(h, [r('q1', false)]);
  expect(cardHistory(h, 'q1')).toMatchObject({ correctStreak: 0, missed: 1 });
});

test('a skipped question (choice null, correct false) counts as missed', () => {
  const h = applyQuizResults(NO_HISTORY, [r('q1', false, { choice: null })]);
  expect(cardHistory(h, 'q1')).toMatchObject({ missed: 1 });
  expect(h.lastQuizMissedIds).toEqual(['q1']);
});

test('lastQuizMissedIds is replaced by each quiz, not merged', () => {
  let h = applyQuizResults(NO_HISTORY, [r('q1', false), r('q2', true)]);
  h = applyQuizResults(h, [r('q2', false), r('q3', true)]);
  expect(h.lastQuizMissedIds).toEqual(['q2']);
});

test('unavailable and correct:null entries are skipped by gradedByTopic', () => {
  const grouped = gradedByTopic([
    r('q1', false),
    r('q2', null),
    r('q3', false, { unavailable: true }),
    r('q4', true, { chunkId: 'signs' }),
    r('q5', true, { chunkId: null }),
  ]);
  expect([...grouped.keys()].sort()).toEqual(['row', 'signs']);
  expect(grouped.get('row')!.map((x) => x.questionId)).toEqual(['q1']);
});

test('a never-graded question reads as null, not zeros', () => {
  expect(cardHistory(NO_HISTORY, 'q1')).toBeNull();
});

test.each([null, '', 'not json', '{"cards":5}', '[]', '{"cards":{"q1":{"graded":"x"}},"lastQuizMissedIds":[1]}'])(
  'parseTopicHistory(%p) degrades safely',
  (raw) => {
    const h = parseTopicHistory(raw);
    expect(h.lastQuizMissedIds.every((id) => typeof id === 'string')).toBe(true);
    expect(cardHistory(h, 'q1')).toBeNull();
  }
);

test('parseTopicHistory round-trips', () => {
  const h = applyQuizResults(NO_HISTORY, [r('q1', false)]);
  expect(parseTopicHistory(JSON.stringify(h))).toEqual(h);
});
