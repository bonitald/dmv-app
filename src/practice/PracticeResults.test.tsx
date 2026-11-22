import { fireEvent, render, screen } from '@testing-library/react-native';
import type { Topic } from '../topics/topicsData';
import type { PracticeOutcome } from './practiceData';
import { PracticeResults } from './PracticeResults';

let mockBaseline: unknown = { status: 'none' };
jest.mock('../progress/useBaselineScore', () => ({ useBaselineScore: () => mockBaseline }));
beforeEach(() => { mockBaseline = { status: 'none' }; });

const topic = (chunkId: string, order: number): Topic => ({
  chunkId, title: `Title ${chunkId}`, description: '', order, approvedQuestionCount: 5,
} as Topic);
const outcome = (correct: number, perTopic: PracticeOutcome['perTopic'] = [], unavailableCount = 0, totalCount = 25): PracticeOutcome => ({
  testId: 't1', createdAt: null, correctCount: correct, totalCount, perTopic, unavailableCount,
  timing: null, unansweredCount: 0,
});
const handlers = () => ({ onOpenTopic: jest.fn(), onReview: jest.fn(), onTakeAnother: jest.fn(), onBack: jest.fn() });

test('22 of 25 shows score, percent and the pass line', async () => {
  await render(<PracticeResults outcome={outcome(22)} topics={[]} {...handlers()} />);
  expect(screen.getByText('22 of 25 correct')).toBeTruthy();
  expect(screen.getByText('88%')).toBeTruthy();
  expect(screen.getByText("You'd pass the real test. It needs 20 of 25.")).toBeTruthy();
});

test('17 of 25 shows the not-yet line and never says fail', async () => {
  const { toJSON } = await render(<PracticeResults outcome={outcome(17)} topics={[]} {...handlers()} />);
  expect(screen.getByText('3 more right answers to pass (20 of 25 needed). Every test helps.')).toBeTruthy();
  expect(JSON.stringify(toJSON())).not.toMatch(/fail/i);
});

test('tapping a topic row opens that topic', async () => {
  const h = handlers();
  await render(
    <PracticeResults outcome={outcome(20, [{ chunkId: 'row', correct: 1, total: 3 }])} topics={[topic('row', 1)]} {...h} />,
  );
  expect(screen.getByText('Topics to work on')).toBeTruthy();
  expect(screen.getByText('2 missed')).toBeTruthy();
  await fireEvent.press(screen.getByText('Title row'));
  expect(h.onOpenTopic).toHaveBeenCalledWith('row');
});

test('7 missed topics show 5 rows and the more line', async () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  await render(
    <PracticeResults
      outcome={outcome(18, ids.map((chunkId) => ({ chunkId, correct: 0, total: 1 })))}
      topics={ids.map((id, i) => topic(id, i))}
      {...handlers()}
    />,
  );
  expect(screen.getAllByText('1 missed')).toHaveLength(5);
  expect(screen.getByText('and 2 more — see Review answers')).toBeTruthy();
});

test('no misses says so', async () => {
  await render(<PracticeResults outcome={outcome(25, [{ chunkId: 'row', correct: 2, total: 2 }])} topics={[topic('row', 1)]} {...handlers()} />);
  expect(screen.getByText("You didn't miss a single topic.")).toBeTruthy();
});

test('an unavailable question shows the left-out line', async () => {
  await render(<PracticeResults outcome={outcome(20, [], 1, 24)} topics={[]} {...handlers()} />);
  expect(screen.getByText('1 question was removed from the bank, so this test is scored out of 24.')).toBeTruthy();
});

test('each button calls its handler', async () => {
  const h = handlers();
  await render(<PracticeResults outcome={outcome(20)} topics={[]} {...h} />);
  await fireEvent.press(screen.getByText('Take another test'));
  await fireEvent.press(screen.getByText('Review answers'));
  await fireEvent.press(screen.getByText('Back to Practice'));
  expect(h.onTakeAnother).toHaveBeenCalled();
  expect(h.onReview).toHaveBeenCalled();
  expect(h.onBack).toHaveBeenCalled();
});

test('with no topic titles, missed topics still show by chunkId and not the none line', async () => {
  await render(<PracticeResults outcome={outcome(15, [{ chunkId: 'row', correct: 1, total: 3 }])} topics={[]} {...handlers()} />);
  expect(screen.getByText('row')).toBeTruthy();
  expect(screen.getByText('2 missed')).toBeTruthy();
  expect(screen.queryByText("You didn't miss a single topic.")).toBeNull();
});

test('a timed-out test shows the time-ran-out line under the score', async () => {
  const timing = { mode: 'timed' as const, timeLimitSec: 3600, elapsedSec: 3600 };
  await render(
    <PracticeResults outcome={{ ...outcome(17), timing, unansweredCount: 3 }} topics={[]} {...handlers()} />,
  );
  expect(screen.getByText('Time ran out — 3 questions unanswered.')).toBeTruthy();
});

test('a test that was not timed out shows no time line', async () => {
  await render(<PracticeResults outcome={outcome(17)} topics={[]} {...handlers()} />);
  expect(screen.queryByText(/Time ran out/)).toBeNull();
});

test('Go over missed questions shows only when wired, and opens the list (ph-4-us-5)', async () => {
  await render(<PracticeResults outcome={outcome(20)} topics={[]} {...handlers()} />);
  expect(screen.queryByText('Go over missed questions')).toBeNull();
  const onOpenMissed = jest.fn();
  await render(<PracticeResults outcome={outcome(20)} topics={[]} {...handlers()} onOpenMissed={onOpenMissed} />);
  await fireEvent.press(screen.getByText('Go over missed questions'));
  expect(onOpenMissed).toHaveBeenCalled();
});

test('compares this test with the baseline (ph-4-us-7)', async () => {
  mockBaseline = { status: 'ready', percent: 60 };
  await render(<PracticeResults outcome={outcome(19)} topics={[]} {...handlers()} />);
  expect(screen.getByText('Baseline 60% → This test 76% · +16 points')).toBeTruthy();
});

test('baseline in progress invites finishing it; none or unknown shows nothing', async () => {
  mockBaseline = { status: 'in-progress' };
  await render(<PracticeResults outcome={outcome(19)} topics={[]} {...handlers()} />);
  expect(screen.getByText("Finish your baseline to see how far you've come.")).toBeTruthy();
  mockBaseline = { status: 'unknown' };
  await render(<PracticeResults outcome={outcome(19)} topics={[]} {...handlers()} />);
  expect(screen.queryByText(/Baseline|Finish your baseline/)).toBeNull();
});
