import { fireEvent, render, screen } from '@testing-library/react-native';
import { startPracticeTest } from './startPracticeTest';
import { PracticeResultsScreen } from './PracticeResultsScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('../progress/useBaselineScore', () => ({ useBaselineScore: () => ({ status: 'none' }) }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: { testId: 't1' } }),
}));
jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ status: 'ready', uid: 'u1' }) }));
jest.mock('./startPracticeTest', () => ({ startPracticeTest: jest.fn() }));
let mockTopics: { status: string; topics?: unknown[] } = { status: 'ready', topics: [] };
jest.mock('../topics/useTopics', () => ({
  useTopics: () => ({ ...mockTopics, retry: jest.fn() }),
}));
const mockRetry = jest.fn();
let mockAttempt: { status: string; data?: Record<string, unknown>; offline?: boolean } = { status: 'loading' };
jest.mock('../review/useTestAttempt', () => ({ useTestAttempt: () => ({ ...mockAttempt, retry: mockRetry }) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockTopics = { status: 'ready', topics: [] };
});

test('a ready practice attempt shows its score; the actions work', async () => {
  mockAttempt = {
    status: 'ready',
    data: { type: 'practice', correctCount: 21, totalCount: 25, perTopic: [], perQuestion: [] },
  };
  await render(<PracticeResultsScreen />);
  expect(screen.getByText('21 of 25 correct')).toBeTruthy();
  await fireEvent.press(screen.getByText('Review answers'));
  expect(mockNavigate).toHaveBeenCalledWith('Review', { testId: 't1' });
  await fireEvent.press(screen.getByText('Take another test'));
  expect(startPracticeTest).toHaveBeenCalledWith(expect.anything(), 'u1', 'replace');
  await fireEvent.press(screen.getByText('Back to Practice'));
  expect(mockGoBack).toHaveBeenCalled();
});

test('a failed read shows the retry state', async () => {
  mockAttempt = { status: 'error', offline: true };
  await render(<PracticeResultsScreen />);
  expect(screen.getByText('No connection')).toBeTruthy();
  await fireEvent.press(screen.getByText('Try again'));
  expect(mockRetry).toHaveBeenCalled();
});

test('an attempt that is not a practice test says something went wrong', async () => {
  mockAttempt = { status: 'ready', data: { type: 'baseline', correctCount: 1, totalCount: 2, perTopic: [] } };
  await render(<PracticeResultsScreen />);
  expect(screen.getByText('Something went wrong')).toBeTruthy();
});

const notPassing = {
  status: 'ready',
  data: { type: 'practice', correctCount: 15, totalCount: 25, perTopic: [{ chunkId: 'row', correct: 0, total: 10 }], perQuestion: [] },
};

test('while topics load it shows a spinner, not a false none line', async () => {
  mockAttempt = notPassing;
  mockTopics = { status: 'loading' };
  await render(<PracticeResultsScreen />);
  expect(screen.getByLabelText('Loading your results')).toBeTruthy();
  expect(screen.queryByText("You didn't miss a single topic.")).toBeNull();
});

test('when topics errored it shows missed topics by chunkId', async () => {
  mockAttempt = notPassing;
  mockTopics = { status: 'error' };
  await render(<PracticeResultsScreen />);
  expect(screen.getByText('row')).toBeTruthy();
  expect(screen.queryByText("You didn't miss a single topic.")).toBeNull();
});
