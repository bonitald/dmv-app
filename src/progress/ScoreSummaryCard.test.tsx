import { fireEvent, render, screen } from '@testing-library/react-native';
import { ScoreSummaryCard } from './ScoreSummaryCard';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
let mockBaseline: unknown = { status: 'loading' };
jest.mock('./useBaselineScore', () => ({ useBaselineScore: () => mockBaseline }));
let mockPractice: unknown = { status: 'ready', attempts: [] };
jest.mock('../practice/usePracticeAttempts', () => ({ usePracticeAttempts: () => mockPractice }));

const attempt = (correctCount: number) => ({ testId: 't', createdAt: null, correctCount, totalCount: 25, perTopic: [], unavailableCount: 0, timing: null, unansweredCount: 0 });

beforeEach(() => {
  jest.clearAllMocks();
  mockPractice = { status: 'ready', attempts: [] };
});

test('baseline and latest practice: both scores and the change', async () => {
  mockBaseline = { status: 'ready', percent: 60 };
  mockPractice = { status: 'ready', attempts: [attempt(19), attempt(10)] };
  await render(<ScoreSummaryCard />);
  expect(screen.getByText('Baseline 60%')).toBeTruthy();
  expect(screen.getByText('Latest practice test 76%')).toBeTruthy();
  expect(screen.getByText('Baseline 60% → Latest 76% · +16 points')).toBeTruthy();
});

test('baseline but no practice test: invites one', async () => {
  mockBaseline = { status: 'ready', percent: 60 };
  await render(<ScoreSummaryCard />);
  await fireEvent.press(screen.getByText('Take a practice test'));
  expect(mockNavigate).toHaveBeenCalledWith('Main', { screen: 'PracticeTests' });
});

test('no baseline or one in progress: start or finish it', async () => {
  mockBaseline = { status: 'none' };
  await render(<ScoreSummaryCard />);
  await fireEvent.press(screen.getByText('Start your baseline'));
  expect(mockNavigate).toHaveBeenCalledWith('Baseline');
  mockBaseline = { status: 'in-progress' };
  await render(<ScoreSummaryCard />);
  expect(screen.getByText('Finish your baseline')).toBeTruthy();
});

test('hidden while loading or when the baseline cannot be read', async () => {
  for (const status of ['loading', 'unknown']) {
    mockBaseline = { status };
    const { toJSON } = await render(<ScoreSummaryCard />);
    expect(toJSON()).toBeNull();
  }
});

test('practice list failed: baseline only, no invite', async () => {
  mockBaseline = { status: 'ready', percent: 60 };
  mockPractice = { status: 'error' };
  await render(<ScoreSummaryCard />);
  expect(screen.getByText('Baseline 60%')).toBeTruthy();
  expect(screen.queryByText('Take a practice test')).toBeNull();
});
