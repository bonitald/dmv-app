import { fireEvent, render, screen } from '@testing-library/react-native';
import { MissedQuestionsScreen } from './MissedQuestionsScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));
let mockRecent: unknown = { status: 'ready', attempts: [] };
jest.mock('./useRecentAttempts', () => ({ useRecentAttempts: () => mockRecent }));
let mockBaseline: unknown = { status: 'not-started' };
jest.mock('../baseline/useBaselineProgress', () => ({ useBaselineProgress: () => mockBaseline }));
jest.mock('../topics/useTopics', () => ({
  useTopics: () => ({
    status: 'ready',
    topics: [
      { chunkId: 'row', title: 'Right of way', description: '', order: 1, approvedQuestionCount: 3 },
      { chunkId: 'signs', title: 'Signs', description: '', order: 2, approvedQuestionCount: 3 },
    ],
  }),
}));

const entry = (questionId: string, chunkId: string, correct: boolean, text: string | null = `Text ${questionId}`) => ({
  questionId, chunkId, choice: 'x', correctAnswer: correct ? 'x' : 'y', correct, ...(text ? { text, choices: ['x', 'y'] } : {}),
});
const doc = (testId: string, at: number, perQuestion: unknown[]) => ({ testId, createdAtMs: at, data: { type: 'practice', perQuestion } });

beforeEach(() => {
  jest.clearAllMocks();
  mockBaseline = { status: 'not-started' };
});

test('groups by topic in handbook order with counts; a question opens on its own', async () => {
  mockRecent = {
    status: 'ready',
    attempts: [doc('t1', 1, [entry('s1', 'signs', false), entry('r1', 'row', false), entry('r2', 'row', false, null), entry('r3', 'row', true)])],
  };
  await render(<MissedQuestionsScreen />);
  const headers = screen.getAllByRole('header').map((h) => h.props.children);
  expect(headers).toEqual(['Right of way · 2', 'Signs · 1']);
  expect(screen.getByText('Question text unavailable')).toBeTruthy();
  await fireEvent.press(screen.getByText('Text s1'));
  expect(mockNavigate).toHaveBeenCalledWith('Review', { testId: 't1', questionId: 's1' });
});

test('Study this concept opens that topic', async () => {
  mockRecent = { status: 'ready', attempts: [doc('t1', 1, [entry('s1', 'signs', false)])] };
  await render(<MissedQuestionsScreen />);
  await fireEvent.press(screen.getByText('Study this concept'));
  expect(mockNavigate).toHaveBeenCalledWith('Flashcards', { chunkId: 'signs' });
});

test('attempts but no misses: nothing to go over', async () => {
  mockRecent = { status: 'ready', attempts: [doc('t1', 1, [entry('r1', 'row', true)])] };
  await render(<MissedQuestionsScreen />);
  expect(screen.getByText('Nothing to go over right now')).toBeTruthy();
  await fireEvent.press(screen.getByText('Browse concepts'));
  expect(mockNavigate).toHaveBeenCalledWith('Main', { screen: 'Study' });
});

test('no attempts: points to the baseline, or to a practice test once it is done', async () => {
  mockRecent = { status: 'ready', attempts: [] };
  await render(<MissedQuestionsScreen />);
  await fireEvent.press(screen.getByText('Start your baseline'));
  expect(mockNavigate).toHaveBeenCalledWith('Baseline');
  mockBaseline = { status: 'complete', version: 'v1' };
  await render(<MissedQuestionsScreen />);
  await fireEvent.press(screen.getByText('Take a practice test'));
  expect(mockNavigate).toHaveBeenCalledWith('Main', { screen: 'PracticeTests' });
});

test('a read error with nothing cached shows no connection', async () => {
  mockRecent = { status: 'error' };
  await render(<MissedQuestionsScreen />);
  expect(screen.getByText('No connection')).toBeTruthy();
  await fireEvent.press(screen.getByText('Back'));
  expect(mockGoBack).toHaveBeenCalled();
});
