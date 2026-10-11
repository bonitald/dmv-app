import { fireEvent, render, screen } from '@testing-library/react-native';
import { fromScoreResult } from './miniQuizData';
import { MiniQuizResults } from './MiniQuizResults';

const pq = (id: string, correct: boolean, choice: string | null) => ({
  questionId: id, chunkId: 'row', choice, correctAnswer: `Right ${id}`, correct, text: `Question ${id}`, choices: [], type: 'fact' as const,
});
const outcome = (score: number, rec: 'move-on' | 'review-again', perQuestion = [pq('a', false, 'Wrong a'), pq('b', true, 'Right b'), pq('c', false, null)]) =>
  fromScoreResult({ testId: 't1', type: 'mini-quiz', score, correctCount: 1, totalCount: 3, perTopic: [], perQuestion, recommendation: rec });

test('shows the score, recommendation, missed questions with your answer and the right one', async () => {
  await render(<MiniQuizResults outcome={outcome(0.33, 'review-again')} onChoice={jest.fn()} onReview={jest.fn()} />);
  expect(screen.getByText('1 of 3 · 33%')).toBeTruthy();
  expect(screen.getByText('Worth another look before moving on.')).toBeTruthy();
  expect(screen.getByText('Question a')).toBeTruthy();
  expect(screen.getByText('Your answer: Wrong a')).toBeTruthy();
  expect(screen.getByText('Right answer: Right a')).toBeTruthy();
  expect(screen.getByText('Your answer: Skipped')).toBeTruthy();
  expect(screen.queryByText('Question b')).toBeNull();
  expect(screen.getByText('You can restart any concept from the concept list.')).toBeTruthy();
});

test('exactly two choices, both enabled and reported; review answers is reported', async () => {
  const onChoice = jest.fn();
  const onReview = jest.fn();
  await render(<MiniQuizResults outcome={outcome(0.9, 'move-on')} onChoice={onChoice} onReview={onReview} />);
  for (const [label, choice] of [
    ['Review Again', 'review-again'],
    ['Mark Reviewed', 'mark-reviewed'],
  ] as const) {
    expect(screen.getByRole('button', { name: label }).props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(screen.getByText(label));
    expect(onChoice).toHaveBeenLastCalledWith(choice);
  }
  expect(screen.queryByText(/Later/)).toBeNull();
  await fireEvent.press(screen.getByText('Review answers'));
  expect(onReview).toHaveBeenCalled();
});

test('the recommended choice is first and announced as recommended', async () => {
  // move-on case: Mark Reviewed is recommended and should be first
  const { rerender } = await render(<MiniQuizResults outcome={outcome(0.9, 'move-on')} onChoice={jest.fn()} onReview={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Mark Reviewed' }).props.accessibilityHint).toBe('Recommended');
  expect(screen.getByRole('button', { name: 'Review Again' }).props.accessibilityHint).toBeUndefined();
  // Mark Reviewed button should be first among choice buttons
  const markReviewedBtn = screen.getByRole('button', { name: 'Mark Reviewed' });
  const reviewAgainBtn = screen.getByRole('button', { name: 'Review Again' });
  const allButtons = screen.getAllByRole('button');
  const markIndex = allButtons.indexOf(markReviewedBtn);
  const reviewIndex = allButtons.indexOf(reviewAgainBtn);
  expect(markIndex < reviewIndex).toBe(true);

  // review-again case: Review Again is recommended and should be first
  await rerender(<MiniQuizResults outcome={outcome(0.33, 'review-again')} onChoice={jest.fn()} onReview={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Review Again' }).props.accessibilityHint).toBe('Recommended');
  // Review Again button should be first among choice buttons
  const reviewAgainBtn2 = screen.getByRole('button', { name: 'Review Again' });
  const markReviewedBtn2 = screen.getByRole('button', { name: 'Mark Reviewed' });
  const allButtons2 = screen.getAllByRole('button');
  const reviewIndex2 = allButtons2.indexOf(reviewAgainBtn2);
  const markIndex2 = allButtons2.indexOf(markReviewedBtn2);
  expect(reviewIndex2 < markIndex2).toBe(true);
});

test('no misses says so', async () => {
  await render(<MiniQuizResults outcome={outcome(1, 'move-on', [pq('b', true, 'Right b')])} onChoice={jest.fn()} onReview={jest.fn()} />);
  expect(screen.getByText('You got every one right.')).toBeTruthy();
});
