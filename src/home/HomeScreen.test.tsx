import { fireEvent, render, screen } from '@testing-library/react-native';
import { HomeScreen } from './HomeScreen';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useNavigation: () => ({ navigate: mockNavigate }),
    useFocusEffect: (effect: () => void | (() => void)) => {
      useEffect(effect, [effect]);
    },
  };
});
jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ status: 'ready', uid: 'u1' }) }));
jest.mock('./TestDateCard', () => ({ TestDateCard: () => null }));
jest.mock('../profile/localFlags', () => ({ getLastOpenedTopic: jest.fn(async () => null) }));
jest.mock('../topics/useTopics', () => ({ useTopics: () => ({ status: 'ready', topics: [] }) }));
let mockProgress: unknown = { status: 'complete', version: 'v1' };
jest.mock('../baseline/useBaselineProgress', () => ({ useBaselineProgress: () => mockProgress }));
let mockPractice: unknown = { status: 'ready', attempts: [] };
jest.mock('../practice/usePracticeAttempts', () => ({ usePracticeAttempts: () => mockPractice }));
let mockScore: unknown = { status: 'ready', percent: 60 };
jest.mock('../progress/useBaselineScore', () => ({ useBaselineScore: () => mockScore }));
let mockEvidence: unknown = { status: 'loading' };
jest.mock('../progress/useConceptEvidence', () => ({ useConceptEvidence: () => mockEvidence }));

const attempt = (correctCount: number) => ({ testId: 't', createdAt: null, correctCount, totalCount: 25, perTopic: [], unavailableCount: 0, timing: null, unansweredCount: 0 });
const row = (chunkId: string, strength: string, comingSoon = false) => ({
  chunkId, title: `Title ${chunkId}`, comingSoon, result: { strength, source: 'baseline' },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockProgress = { status: 'complete', version: 'v1' };
  mockPractice = { status: 'ready', attempts: [] };
  mockScore = { status: 'ready', percent: 60 };
  mockEvidence = { status: 'loading' };
});

test('baseline done, no practice test yet: invites one and opens the Practice tab', async () => {
  await render(<HomeScreen />);
  expect(screen.getByText('Take a practice test')).toBeTruthy();
  expect(screen.getByText('25 questions, like the real test.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Take a practice test'));
  expect(mockNavigate).toHaveBeenCalledWith('Main', { screen: 'PracticeTests' });
});

test('with a latest test: its score and the change since the baseline', async () => {
  mockPractice = { status: 'ready', attempts: [attempt(19), attempt(5)] };
  await render(<HomeScreen />);
  expect(screen.getByText('Latest: 19 of 25 (76%) · +16 points since your baseline')).toBeTruthy();
});

test('a lower latest score, or an unreadable baseline, shows the score alone', async () => {
  mockPractice = { status: 'ready', attempts: [attempt(13)] };
  await render(<HomeScreen />);
  expect(screen.getByText('Latest: 13 of 25 (52%)')).toBeTruthy();
  mockScore = { status: 'unknown' };
  mockPractice = { status: 'ready', attempts: [attempt(19)] };
  await render(<HomeScreen />);
  expect(screen.getByText('Latest: 19 of 25 (76%)')).toBeTruthy();
});

test('baseline not started or in progress keeps the baseline card', async () => {
  mockProgress = { status: 'not-started' };
  await render(<HomeScreen />);
  expect(screen.getByText('Start your baseline')).toBeTruthy();
  expect(screen.queryByText('Take a practice test')).toBeNull();
  mockProgress = { status: 'in-progress', currentSection: 2, totalSections: 3 };
  await render(<HomeScreen />);
  expect(screen.getByText('Resume your baseline')).toBeTruthy();
});

test('weak spots: up to 3 likely gap or missed-it topics, in order, each opening flashcards', async () => {
  mockEvidence = {
    status: 'ready',
    baselineError: false,
    retryBaseline: null,
    rows: [
      row('a', 'strong'), row('b', 'likely-gap'), row('c', 'missed-it'), row('d', 'shaky'),
      row('e', 'missed-it', true), row('f', 'likely-gap'), row('g', 'missed-it'),
    ],
  };
  await render(<HomeScreen />);
  expect(screen.getByText('WORK ON THESE')).toBeTruthy();
  expect(screen.getAllByText(/^Title /).map((t) => t.props.children)).toEqual(['Title b', 'Title c', 'Title f']);
  await fireEvent.press(screen.getByText('Title c'));
  expect(mockNavigate).toHaveBeenCalledWith('Flashcards', { chunkId: 'c' });
});

test('no weak spots: the card is hidden', async () => {
  mockEvidence = { status: 'ready', baselineError: false, retryBaseline: null, rows: [row('a', 'strong'), row('b', 'not-tested')] };
  await render(<HomeScreen />);
  expect(screen.queryByText('WORK ON THESE')).toBeNull();
});
