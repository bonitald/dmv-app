import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Text } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { logEvent } from '@react-native-firebase/analytics';
import { scoreTest, startOrResumeBaseline } from '../api/callables';
import { CallableError } from '../api/callableErrors';
import type { BaselineSection, QuizQuestion, ScoreTestResult } from '../api/types';
import { getActiveSession, saveAnswers, startSession } from '../quiz/quizSession';
import type { BaselineProgress } from './baselineProgressData';
import { BaselineScreen } from './BaselineScreen';

// Slice 2 journey (docs/build-order.md) through the real baseline screen, runner and session
// store. Only the callables, the progress listener, NetInfo and Firebase are mocked.
jest.mock('@react-native-firebase/app', () => ({ getApp: jest.fn() }));
jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: jest.fn(),
  logEvent: jest.fn(),
}));
jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ status: 'ready', uid: 'u1' }) }));
jest.mock('../api/callables', () => ({ startOrResumeBaseline: jest.fn(), scoreTest: jest.fn() }));
let mockProgress: BaselineProgress = { status: 'not-started' };
// Subscribable like the real onSnapshot-backed hook, so a test can move progress on mid-flow.
const mockProgressListeners = new Set<() => void>();
jest.mock('./useBaselineProgress', () => {
  const { useSyncExternalStore } = jest.requireActual('react');
  return {
    useBaselineProgress: () =>
      useSyncExternalStore(
        (listener: () => void) => {
          mockProgressListeners.add(listener);
          return () => mockProgressListeners.delete(listener);
        },
        () => mockProgress
      ),
  };
});
async function setProgress(progress: BaselineProgress) {
  await act(() => {
    mockProgress = progress;
    mockProgressListeners.forEach((listener) => listener());
  });
}
let mockTopics: { status: string; topics?: { chunkId: string; title: string; order: number }[] } = {
  status: 'ready',
  topics: [],
};
jest.mock('../topics/useTopics', () => ({ useTopics: () => mockTopics }));
// The final attempt read: only asked for when results aren't already in memory (testId set).
let mockAttempt: { status: string; data?: Record<string, unknown>; offline?: boolean } = {
  status: 'loading',
};
jest.mock('../review/useTestAttempt', () => ({
  useTestAttempt: (testId: string | null) =>
    testId ? { ...mockAttempt, retry: jest.fn() } : { status: 'loading', retry: jest.fn() },
}));
// A subscribable stand-in for NetInfo, so tests can flip the connection mid-flow.
let mockOnline = true;
const mockOnlineListeners = new Set<() => void>();
jest.mock('../network/useIsOnline', () => {
  const { useSyncExternalStore } = jest.requireActual('react');
  return {
    useIsOnline: () =>
      useSyncExternalStore(
        (listener: () => void) => {
          mockOnlineListeners.add(listener);
          return () => mockOnlineListeners.delete(listener);
        },
        () => mockOnline
      ),
  };
});
async function setOnline(online: boolean) {
  await act(() => {
    mockOnline = online;
    mockOnlineListeners.forEach((listener) => listener());
  });
}

const mockStart = startOrResumeBaseline as jest.Mock;
const mockScore = scoreTest as jest.Mock;

const question = (n: number): QuizQuestion => ({
  id: `q${n}`,
  text: `Question text ${n}`,
  choices: [`A${n}`, `B${n}`],
  type: 'fact',
  chunkId: `c${n}`,
  conceptId: `k${n}`,
});
const sectionOf = (n: number): BaselineSection => ({
  testId: `baseline-v1-${n}`,
  version: 'v1',
  section: n,
  totalSections: 3,
  questions: [question(n * 10 + 1), question(n * 10 + 2)],
});
const graded = (n: number, extra: Partial<ScoreTestResult> = {}): ScoreTestResult => ({
  testId: `baseline-v1-${n}`,
  type: 'baseline',
  score: 0.5,
  correctCount: 1,
  totalCount: 2,
  perTopic: [],
  perQuestion: [],
  recommendation: null,
  ...extra,
});

// A two-screen stack so "Take a break" and Back have somewhere to go. Main sits under
// Baseline, as it does in the app.
const Stack = createNativeStackNavigator();
const navRef = createNavigationContainerRef();
function flowTree() {
  return (
    <NavigationContainer ref={navRef}>
      <Stack.Navigator initialRouteName="Main">
        <Stack.Screen name="Main">{() => <Text>Home screen</Text>}</Stack.Screen>
        <Stack.Screen name="Baseline" component={BaselineScreen} />
        <Stack.Screen name="Review">{() => <Text>Review screen</Text>}</Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
async function renderFlow() {
  const view = await render(flowTree());
  await act(() => navRef.navigate('Baseline' as never));
  return view;
}

async function answerAllAndSubmit(n: number) {
  await fireEvent.press(screen.getByText(`A${n * 10 + 1}`));
  await fireEvent.press(screen.getByText('Next'));
  await fireEvent.press(screen.getByText(`A${n * 10 + 2}`));
  await fireEvent.press(screen.getByText('Submit'));
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockProgress = { status: 'not-started' };
  mockAttempt = { status: 'loading' };
  mockTopics = { status: 'ready', topics: [] };
  mockOnline = true;
  mockOnlineListeners.clear();
});

test('first time: intro, then section 1 in the runner', async () => {
  mockStart.mockResolvedValueOnce(sectionOf(1));
  await renderFlow();
  expect(await screen.findByText('45 questions in 3 sections of 15')).toBeTruthy();
  await fireEvent.press(screen.getByText('Start section 1'));
  expect(await screen.findByText('Section 1 of 3')).toBeTruthy();
  expect(screen.getByText('Question text 11')).toBeTruthy();
  expect((await getActiveSession('u1'))?.testId).toBe('baseline-v1-1');
});

test('section 1 submit shows the check-in with no score; Keep going loads section 2', async () => {
  mockStart.mockResolvedValueOnce(sectionOf(1)).mockResolvedValueOnce(sectionOf(2));
  mockScore.mockResolvedValueOnce(graded(1));
  await renderFlow();
  await fireEvent.press(await screen.findByText('Start section 1'));
  await screen.findByText('Section 1 of 3');
  await answerAllAndSubmit(1);

  expect(await screen.findByText('Section 1 done')).toBeTruthy();
  expect(screen.queryByText(/%|1 of 2|right/)).toBeNull();
  expect(mockScore).toHaveBeenCalledWith({
    testId: 'baseline-v1-1',
    answers: [
      { questionId: 'q11', choice: 'A11' },
      { questionId: 'q12', choice: 'A12' },
    ],
  });
  expect(await getActiveSession('u1')).toBeNull();

  await fireEvent.press(screen.getByText('Keep going'));
  expect(await screen.findByText('Section 2 of 3')).toBeTruthy();
});

test('Take a break goes back to Home', async () => {
  mockStart.mockResolvedValueOnce(sectionOf(1));
  mockScore.mockResolvedValueOnce(graded(1));
  await renderFlow();
  await fireEvent.press(await screen.findByText('Start section 1'));
  await screen.findByText('Section 1 of 3');
  await answerAllAndSubmit(1);
  await fireEvent.press(await screen.findByText('Take a break'));
  expect(await screen.findByText('Home screen')).toBeTruthy();
});

test('in progress: skips the intro and restores saved answers for the same section', async () => {
  mockProgress = { status: 'in-progress', currentSection: 2, totalSections: 3 };
  await startSession('u1', 'baseline-v1-2', 'baseline', sectionOf(2).questions);
  await saveAnswers('u1', 'baseline-v1-2', { q21: 'B21' });
  mockStart.mockResolvedValueOnce(sectionOf(2));

  await renderFlow();
  expect(await screen.findByText('Section 2 of 3')).toBeTruthy();
  expect(screen.queryByText('Start section 1')).toBeNull();
  expect(screen.getByLabelText('Question 1, answered')).toBeTruthy();
});

test('a stale session for another section is discarded', async () => {
  mockProgress = { status: 'in-progress', currentSection: 3, totalSections: 3 };
  await startSession('u1', 'baseline-v1-2', 'baseline', sectionOf(2).questions);
  await saveAnswers('u1', 'baseline-v1-2', { q21: 'B21' });
  mockStart.mockResolvedValueOnce(sectionOf(3));

  await renderFlow();
  expect(await screen.findByText('Section 3 of 3')).toBeTruthy();
  expect(screen.getByLabelText('Question 1')).toBeTruthy();
  expect((await getActiveSession('u1'))?.testId).toBe('baseline-v1-3');
});

const reviewOf = (right: number, total = 45) =>
  Array.from({ length: total }, (_, i) => ({
    questionId: `r${i}`,
    chunkId: `c${i}`,
    choice: i < right ? 'x' : 'y',
    correctAnswer: 'x',
    correct: i < right,
    text: `T${i}`,
    choices: ['x', 'y'],
    type: 'fact' as const,
  }));

async function finishWith(review: ReturnType<typeof reviewOf>) {
  mockProgress = { status: 'in-progress', currentSection: 3, totalSections: 3 };
  mockStart.mockResolvedValueOnce(sectionOf(3));
  mockScore.mockResolvedValueOnce(graded(3, { baselineReview: review }));
  await renderFlow();
  await screen.findByText('Section 3 of 3');
  await answerAllAndSubmit(3);
}

test('section 3 submit shows results from baselineReview: 82%, 37 of 45, tracking line, topics', async () => {
  await finishWith(reviewOf(37));

  expect(await screen.findByText('82%')).toBeTruthy();
  expect(screen.getByText('37 of 45 right')).toBeTruthy();
  expect(screen.getByText(/The real test needs 80%\. You're off to a strong start/)).toBeTruthy();
  expect(screen.queryByText(/\bpass\b|\bfail/i)).toBeNull();
  expect(screen.getByLabelText('c0, Got it')).toBeTruthy();
  expect(screen.getByLabelText('c37, Missed it')).toBeTruthy();
  expect(screen.getByText('One question per topic, so this is only a rough guide.')).toBeTruthy();
});

test('below the mark says where to focus; Start with what you missed opens the Study tab', async () => {
  await finishWith(reviewOf(30));
  expect(await screen.findByText("The real test needs 80%. Here's where to focus first.")).toBeTruthy();
  await fireEvent.press(screen.getByText('Start with what you missed'));
  expect(navRef.getCurrentRoute()?.name).toBe('Main');
});

test('tapping a topic opens the Study tab', async () => {
  await finishWith(reviewOf(30));
  await fireEvent.press(await screen.findByLabelText('c2, Got it'));
  expect(navRef.getCurrentRoute()?.name).toBe('Main');
});

test('all right: no "Start with what you missed"; Review answers opens the final attempt', async () => {
  await finishWith(reviewOf(45));
  expect(await screen.findByText('100%')).toBeTruthy();
  expect(screen.queryByText('Start with what you missed')).toBeNull();
  await fireEvent.press(screen.getByText('Review answers'));
  expect(navRef.getCurrentRoute()).toMatchObject({
    name: 'Review',
    params: { testId: 'baseline-v1-3' },
  });
});

test('if progress cannot be read, the server decides: the section loads instead of a blank screen', async () => {
  mockProgress = { status: 'error' };
  mockStart.mockResolvedValueOnce(sectionOf(2));
  await renderFlow();
  expect(await screen.findByText('Section 2 of 3')).toBeTruthy();
});

test('reopening a completed baseline loads results from the final attempt', async () => {
  mockProgress = { status: 'complete', version: 'v1' };
  mockAttempt = {
    status: 'ready',
    data: { type: 'baseline', perQuestion: [], baselineReview: reviewOf(30) },
  };
  await renderFlow();
  expect(await screen.findByText('67%')).toBeTruthy();
  expect(screen.getByText('30 of 45 right')).toBeTruthy();
  expect(mockStart).not.toHaveBeenCalled();
});

test('reopening while offline with nothing cached shows no connection', async () => {
  mockProgress = { status: 'complete', version: 'v1' };
  mockAttempt = { status: 'error', offline: true };
  await renderFlow();
  expect(await screen.findByText('No connection')).toBeTruthy();
});

test('already-exists from startOrResumeBaseline shows results, not an error', async () => {
  mockProgress = { status: 'in-progress', currentSection: 3, totalSections: 3 };
  mockAttempt = {
    status: 'ready',
    data: { type: 'baseline', perQuestion: [], baselineReview: reviewOf(40) },
  };
  mockStart.mockRejectedValueOnce(new CallableError('already-exists', 'already-exists', 'done'));
  await renderFlow();
  // Progress catches up with the server and reports the version the results live under.
  await setProgress({ status: 'complete', version: 'v1' });
  expect(await screen.findByText('89%')).toBeTruthy();
});

test('progress unreadable and already-exists: results still load (v1), not a blank screen', async () => {
  mockProgress = { status: 'error' };
  mockAttempt = {
    status: 'ready',
    data: { type: 'baseline', perQuestion: [], baselineReview: reviewOf(40) },
  };
  mockStart.mockRejectedValueOnce(new CallableError('already-exists', 'already-exists', 'done'));
  await renderFlow();
  expect(await screen.findByText('89%')).toBeTruthy();
});

test('results wait for topic titles instead of flashing raw topic ids', async () => {
  mockTopics = { status: 'loading' };
  await finishWith(reviewOf(37));
  await waitFor(() => expect(mockScore).toHaveBeenCalled());
  await act(async () => {});
  expect(screen.queryByText('82%')).toBeNull();
  expect(screen.queryByLabelText('c0, Got it')).toBeNull();
});

test('topics that fail to load fall back to topic ids rather than an empty list', async () => {
  mockTopics = { status: 'error' };
  await finishWith(reviewOf(37));
  expect(await screen.findByLabelText('c0, Got it')).toBeTruthy();
});

test('already-exists from scoreTest moves on to the check-in', async () => {
  mockStart.mockResolvedValueOnce(sectionOf(1));
  mockScore.mockRejectedValueOnce(new CallableError('already-exists', 'already-exists', 'scored'));
  await renderFlow();
  await fireEvent.press(await screen.findByText('Start section 1'));
  await screen.findByText('Section 1 of 3');
  await answerAllAndSubmit(1);
  expect(await screen.findByText('Section 1 done')).toBeTruthy();
});

test('failed-precondition shows the unavailable message and logs it', async () => {
  mockStart.mockRejectedValueOnce(
    new CallableError('failed-precondition', 'failed-precondition', 'not published')
  );
  await renderFlow();
  await fireEvent.press(await screen.findByText('Start section 1'));
  expect(
    await screen.findByText("The baseline isn't available right now — try a practice test instead.")
  ).toBeTruthy();
  expect(logEvent).toHaveBeenCalledWith(undefined, 'baseline_unavailable', {
    code: 'failed-precondition',
  });
});

test('offline with nothing cached shows No connection; Try again retries', async () => {
  mockStart
    .mockRejectedValueOnce(new CallableError('offline', 'unavailable', 'offline'))
    .mockResolvedValueOnce(sectionOf(1));
  await renderFlow();
  await fireEvent.press(await screen.findByText('Start section 1'));
  expect(await screen.findByText('No connection')).toBeTruthy();
  await fireEvent.press(screen.getByText('Try again'));
  expect(await screen.findByText('Section 1 of 3')).toBeTruthy();
});

test('a server error with nothing cached is not reported as No connection; Try again retries', async () => {
  mockStart
    .mockRejectedValueOnce(new CallableError('unauthenticated', 'unauthenticated', 'denied'))
    .mockResolvedValueOnce(sectionOf(1));
  await renderFlow();
  await fireEvent.press(await screen.findByText('Start section 1'));
  expect(await screen.findByText('Something went wrong')).toBeTruthy();
  expect(screen.queryByText('No connection')).toBeNull();
  await fireEvent.press(screen.getByText('Try again'));
  expect(await screen.findByText('Section 1 of 3')).toBeTruthy();
});

test('a failed submit shows the error and keeps the answers', async () => {
  mockStart.mockResolvedValueOnce(sectionOf(1));
  mockScore
    .mockRejectedValueOnce(new CallableError('unknown', 'internal', 'boom'))
    .mockResolvedValueOnce(graded(1));
  await renderFlow();
  await fireEvent.press(await screen.findByText('Start section 1'));
  await screen.findByText('Section 1 of 3');
  await answerAllAndSubmit(1);
  expect(await screen.findByText("Couldn't submit. Your answers are saved.")).toBeTruthy();
  expect((await getActiveSession('u1'))?.answers).toEqual({ q11: 'A11', q12: 'A12' });
  await fireEvent.press(screen.getByText('Try again'));
  expect(await screen.findByText('Section 1 done')).toBeTruthy();
});

test('double-tapping Submit calls scoreTest once', async () => {
  mockStart.mockResolvedValueOnce(sectionOf(1));
  let resolve!: (r: ScoreTestResult) => void;
  mockScore.mockReturnValueOnce(new Promise((r) => (resolve = r)));
  await renderFlow();
  await fireEvent.press(await screen.findByText('Start section 1'));
  await screen.findByText('Section 1 of 3');
  await answerAllAndSubmit(1);
  await fireEvent.press(screen.getByText('Submitting…'));
  await act(async () => resolve(graded(1)));
  await screen.findByText('Section 1 done');
  expect(mockScore).toHaveBeenCalledTimes(1);
});

describe('offline and leaving (ph-3-us-1)', () => {
  test('offline at submit: answers are held, then submitted once when the connection returns', async () => {
    mockStart.mockResolvedValueOnce(sectionOf(1));
    mockScore.mockResolvedValueOnce(graded(1));
    await renderFlow();
    await fireEvent.press(await screen.findByText('Start section 1'));
    await screen.findByText('Section 1 of 3');

    await setOnline(false);
    expect(
      screen.getByText("You're offline. Keep going — your answers are saved on this phone.")
    ).toBeTruthy();
    await answerAllAndSubmit(1);
    expect(
      await screen.findByText("Your answers are saved. We'll submit as soon as you're back online.")
    ).toBeTruthy();
    expect(mockScore).not.toHaveBeenCalled();

    await setOnline(true);
    expect(await screen.findByText('Section 1 done')).toBeTruthy();
    expect(mockScore).toHaveBeenCalledTimes(1);
  });

  test('server unreachable while the phone looks online: keeps answers, offers Try again, no retry loop', async () => {
    mockStart.mockResolvedValueOnce(sectionOf(1));
    mockScore.mockRejectedValueOnce(new CallableError('offline', 'unavailable', 'offline'));
    await renderFlow();
    await fireEvent.press(await screen.findByText('Start section 1'));
    await screen.findByText('Section 1 of 3');
    await answerAllAndSubmit(1);
    expect(await screen.findByText("Couldn't submit. Your answers are saved.")).toBeTruthy();
    expect(mockScore).toHaveBeenCalledTimes(1);
    expect((await getActiveSession('u1'))?.answers).toEqual({ q11: 'A11', q12: 'A12' });
  });

  test('offline on reopen with a cached section: keeps going from the cache', async () => {
    mockProgress = { status: 'in-progress', currentSection: 2, totalSections: 3 };
    await startSession('u1', 'baseline-v1-2', 'baseline', sectionOf(2).questions);
    await saveAnswers('u1', 'baseline-v1-2', { q21: 'A21' });
    mockStart.mockRejectedValueOnce(new CallableError('offline', 'unavailable', 'offline'));
    await renderFlow();
    expect(await screen.findByText('Section 2 of 3')).toBeTruthy();
    expect(screen.getByLabelText('Question 1, answered')).toBeTruthy();
  });

  test('server error on reopen with a cached section: keeps going from the cache', async () => {
    mockProgress = { status: 'in-progress', currentSection: 2, totalSections: 3 };
    await startSession('u1', 'baseline-v1-2', 'baseline', sectionOf(2).questions);
    mockStart.mockRejectedValueOnce(new CallableError('unknown', 'internal', 'boom'));
    await renderFlow();
    expect(await screen.findByText('Section 2 of 3')).toBeTruthy();
  });

  test('leaving mid-section asks first, and leaving keeps the session', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    mockStart.mockResolvedValueOnce(sectionOf(1));
    await renderFlow();
    await fireEvent.press(await screen.findByText('Start section 1'));
    await screen.findByText('Section 1 of 3');
    await fireEvent.press(screen.getByText('A11'));

    // Same path as the header's back button and Android back: a goBack that usePreventRemove sees.
    await act(() => navRef.goBack());
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith('Take a break?', expect.any(String), expect.any(Array))
    );
    expect(screen.getByText('Section 1 of 3')).toBeTruthy();

    await act(() => alert.mock.calls[0][2]!.find((b) => b.text === 'Leave')!.onPress!());
    expect(await screen.findByText('Home screen')).toBeTruthy();
    expect((await getActiveSession('u1'))?.answers).toEqual({ q11: 'A11' });
    alert.mockRestore();
  });
});
