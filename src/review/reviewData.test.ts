import { countMissed, isMissed, toReviewItems } from './reviewData';

const entry = (over: Record<string, unknown> = {}) => ({
  questionId: 'q1',
  chunkId: 'row',
  choice: 'a',
  correctAnswer: 'a',
  correct: true,
  text: 'Q?',
  choices: ['a', 'b'],
  type: 'scenario',
  ...over,
});

test('uses baselineReview when present, perQuestion otherwise', () => {
  const review = toReviewItems({ type: 'baseline', perQuestion: [], baselineReview: [entry()] });
  expect(review).toEqual([
    {
      questionId: 'q1',
      chunkId: 'row',
      text: 'Q?',
      choices: ['a', 'b'],
      type: 'scenario',
      choice: 'a',
      correctAnswer: 'a',
      explanation: null,
      outcome: 'right',
    },
  ]);
  expect(
    toReviewItems({ type: 'practice', perQuestion: [entry({ explanation: 'Why' })] })?.[0].explanation
  ).toBe('Why');
});

test('no review for a baseline section before the last (answers withheld)', () => {
  expect(
    toReviewItems({ type: 'baseline', perQuestion: [entry({ correct: null, correctAnswer: null })] })
  ).toBeNull();
});

test('no review for a missing or malformed attempt', () => {
  expect(toReviewItems(undefined)).toBeNull();
  expect(toReviewItems({ type: 'practice', perQuestion: 'nope' })).toBeNull();
});

test('outcomes: wrong, skipped, removed', () => {
  const items = toReviewItems({
    type: 'practice',
    perQuestion: [
      entry({ questionId: 'w', choice: 'b', correct: false }),
      entry({ questionId: 's', choice: null, correct: false }),
      entry({
        questionId: 'r',
        unavailable: true,
        chunkId: null,
        correct: null,
        correctAnswer: null,
        text: null,
        choices: null,
        type: null,
      }),
    ],
  })!;
  expect(items.map((i) => i.outcome)).toEqual(['wrong', 'skipped', 'removed']);
  expect(items[2].type).toBe('fact');
  expect(items.filter(isMissed).map((i) => i.questionId)).toEqual(['w', 's']);
  expect(countMissed(items)).toBe(2);
});

test('attempts saved before ph-4-us-3 have null text and choices', () => {
  const legacy = { questionId: 'q1', chunkId: 'row', choice: 'a', correctAnswer: 'b', correct: false };
  const [item] = toReviewItems({ type: 'practice', perQuestion: [legacy] })!;
  expect(item).toMatchObject({ text: null, choices: null, type: 'fact', outcome: 'wrong' });
});

test('drops malformed entries instead of throwing', () => {
  expect(toReviewItems({ type: 'practice', perQuestion: [null, 5, entry()] })).toHaveLength(1);
});
