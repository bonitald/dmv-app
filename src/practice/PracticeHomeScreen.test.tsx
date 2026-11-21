import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { endSession, getActiveSession } from '../quiz/quizSession';
import { getPracticeMode, setPracticeMode } from '../profile/localFlags';
import { startPracticeTest } from './startPracticeTest';
import { PracticeHomeScreen } from './PracticeHomeScreen';
import type { PracticeOutcome } from './practiceData';

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
jest.mock('../quiz/quizSession', () => ({ getActiveSession: jest.fn(), endSession: jest.fn() }));
jest.mock('../profile/localFlags', () => ({ getPracticeMode: jest.fn(), setPracticeMode: jest.fn() }));
jest.mock('./startPracticeTest', () => ({ startPracticeTest: jest.fn() }));
let mockAttempts: unknown = { status: 'ready', attempts: [] };
jest.mock('./usePracticeAttempts', () => ({ usePracticeAttempts: () => mockAttempts }));

const outcome = (testId: string, correctCount: number): PracticeOutcome => ({
  testId,
  createdAt: new Date(2026, 10, 18, 12),
  correctCount,
  totalCount: 25,
  perTopic: [],
  unavailableCount: 0,
  timing: null,
  unansweredCount: 0,
});
const answers = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`q${i}`, 0]));
const saved = {
  testId: 't1',
  kind: 'practice',
  questions: Array.from({ length: 25 }, (_, i) => ({ id: `q${i}` })),
  answers,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAttempts = { status: 'ready', attempts: [] };
  (getActiveSession as jest.Mock).mockResolvedValue(null);
  (endSession as jest.Mock).mockResolvedValue(undefined);
  (getPracticeMode as jest.Mock).mockResolvedValue('untimed');
  (setPracticeMode as jest.Mock).mockResolvedValue(undefined);
});

test('no saved test: no resume card, start button and the static copy', async () => {
  await render(<PracticeHomeScreen />);
  expect(screen.getByText('Practice tests')).toBeTruthy();
  expect(screen.getByText('25 questions, like the real Colorado test. You need 20 right to pass.')).toBeTruthy();
  expect(screen.getByText('Based on the Colorado Driver Handbook.')).toBeTruthy();
  expect(screen.queryByText('You have a test in progress')).toBeNull();
  await fireEvent.press(screen.getByText('Start a practice test'));
  expect(startPracticeTest).toHaveBeenCalledWith(expect.anything(), 'u1', 'navigate');
});

test('a saved test shows its progress; Resume continues it', async () => {
  (getActiveSession as jest.Mock).mockResolvedValue(saved);
  await render(<PracticeHomeScreen />);
  expect(await screen.findByText('12 of 25 answered')).toBeTruthy();
  await fireEvent.press(screen.getByText('Resume'));
  expect(mockNavigate).toHaveBeenCalledWith('PracticeTest', { resume: true });
});

test('Discard asks first, then clears the saved test', async () => {
  (getActiveSession as jest.Mock).mockResolvedValue(saved);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render(<PracticeHomeScreen />);
  await fireEvent.press(await screen.findByText('Discard'));
  expect(alert).toHaveBeenCalledWith('Discard this test?', 'Your answers will be lost.', expect.any(Array));
  expect(endSession).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
  expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Discard']);
  buttons[1].onPress?.();
  expect(endSession).toHaveBeenCalledWith('u1', 'practice', 't1');
  await waitFor(() => expect(screen.queryByText('You have a test in progress')).toBeNull());
  alert.mockRestore();
});

test('switch defaults to Untimed and saves the choice', async () => {
  await render(<PracticeHomeScreen />);
  expect(await screen.findByRole('button', { name: 'Untimed', selected: true })).toBeTruthy();
  await fireEvent.press(screen.getByText('Timed — 60 min, like the real test'));
  expect(setPracticeMode).toHaveBeenCalledWith('u1', 'timed');
  expect(await screen.findByRole('button', { name: 'Timed — 60 min, like the real test', selected: true })).toBeTruthy();
});

test('switch loads the saved choice', async () => {
  (getPracticeMode as jest.Mock).mockResolvedValue('timed');
  await render(<PracticeHomeScreen />);
  expect(await screen.findByRole('button', { name: 'Timed — 60 min, like the real test', selected: true })).toBeTruthy();
});

test('timed resume card shows minutes left', async () => {
  (getActiveSession as jest.Mock).mockResolvedValue({
    ...saved,
    timing: { mode: 'timed', timeLimitSec: 3600, startedAt: Date.now() - 20 * 60 * 1000 },
  });
  await render(<PracticeHomeScreen />);
  expect(await screen.findByText('40 min left')).toBeTruthy();
  expect(screen.getByText('Resume')).toBeTruthy();
  expect(screen.getByText('Discard')).toBeTruthy();
});

test('expired resume card has Open to submit and no Discard', async () => {
  (getActiveSession as jest.Mock).mockResolvedValue({
    ...saved,
    timing: { mode: 'timed', startedAt: Date.now() - 61 * 60 * 1000 },
  });
  await render(<PracticeHomeScreen />);
  expect(await screen.findByText("Time's up — open it to submit")).toBeTruthy();
  expect(screen.queryByText('Discard')).toBeNull();
  expect(screen.queryByText('Resume')).toBeNull();
  await fireEvent.press(screen.getByText('Open to submit'));
  expect(mockNavigate).toHaveBeenCalledWith('PracticeTest', { resume: true });
});

describe('a test that runs out while the card is on screen', () => {
  const realNow = Date.now();
  afterEach(() => jest.restoreAllMocks());
  const laterBy = (ms: number) => jest.spyOn(Date, 'now').mockReturnValue(realNow + ms);

  beforeEach(() => {
    (getActiveSession as jest.Mock).mockResolvedValue({
      ...saved,
      timing: { mode: 'timed', timeLimitSec: 3600, startedAt: realNow - 59 * 60 * 1000 },
    });
  });

  test('tapping Discard opens the expired test instead of asking', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<PracticeHomeScreen />);
    await fireEvent.press(await screen.findByText('Discard'));
    expect(alert).toHaveBeenCalled();
    alert.mockClear();
    laterBy(2 * 60 * 1000);
    await fireEvent.press(screen.getByText('Discard'));
    expect(alert).not.toHaveBeenCalled();
    expect(endSession).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('PracticeTest', { resume: true });
    expect(await screen.findByText('Open to submit')).toBeTruthy();
  });

  test('confirming Discard after expiry opens the test and keeps it', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<PracticeHomeScreen />);
    await fireEvent.press(await screen.findByText('Discard'));
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    laterBy(2 * 60 * 1000);
    await act(async () => buttons[1].onPress?.());
    expect(endSession).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('PracticeTest', { resume: true });
  });
});

test('untimed and 5a sessions keep Resume and Discard', async () => {
  (getActiveSession as jest.Mock).mockResolvedValue({ ...saved, timing: { mode: 'untimed', startedAt: 1 } });
  await render(<PracticeHomeScreen />);
  expect(await screen.findByText('12 of 25 answered')).toBeTruthy();
  expect(screen.getByText('Resume')).toBeTruthy();
  expect(screen.getByText('Discard')).toBeTruthy();
  expect(screen.queryByText(/min left/)).toBeNull();
});

test('recent tests in order with Pass / Not yet; a row opens its results', async () => {
  mockAttempts = { status: 'ready', attempts: [outcome('a', 22), outcome('b', 15)] };
  await render(<PracticeHomeScreen />);
  expect(screen.getByText('Nov 18 · 22 of 25')).toBeTruthy();
  expect(screen.getByText('Nov 18 · 15 of 25')).toBeTruthy();
  expect(screen.getByText('Pass')).toBeTruthy();
  expect(screen.getByText('Not yet')).toBeTruthy();
  await fireEvent.press(screen.getByText('Nov 18 · 15 of 25'));
  expect(mockNavigate).toHaveBeenCalledWith('PracticeResults', { testId: 'b' });
});

test('a failed read shows the empty line and no error text', async () => {
  mockAttempts = { status: 'error' };
  await render(<PracticeHomeScreen />);
  expect(screen.getByText('Your tests will show here.')).toBeTruthy();
  expect(screen.queryByText(/error|wrong|connection/i)).toBeNull();
});

test('loading shows a spinner in the list area, with the rest of the screen still there', async () => {
  mockAttempts = { status: 'loading' };
  await render(<PracticeHomeScreen />);
  expect(screen.getByLabelText('Loading your tests')).toBeTruthy();
  expect(screen.getByText('Start a practice test')).toBeTruthy();
});
