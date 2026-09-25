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
jest.mock('./useBaselineProgress', () => ({ useBaselineProgress: () => mockProgress }));
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

test('section 3 submit goes to the complete screen with the total from baselineReview', async () => {
  mockProgress = { status: 'in-progress', currentSection: 3, totalSections: 3 };
  mockStart.mockResolvedValueOnce(sectionOf(3));
  const review = Array.from({ length: 45 }, (_, i) => ({
    questionId: `r${i}`,
    chunkId: 'c',
    choice: 'x',
    correctAnswer: 'x',
    correct: i < 30,
  }));
  mockScore.mockResolvedValueOnce(graded(3, { baselineReview: review }));

  await renderFlow();
  await screen.findByText('Section 3 of 3');
  await answerAllAndSubmit(3);
  expect(await screen.findByText('Baseline done')).toBeTruthy();
  expect(screen.getByText('You got 30 of 45 right.')).toBeTruthy();
});

test('if progress cannot be read, the server decides: the section loads instead of a blank screen', async () => {
  mockProgress = { status: 'error' };
  mockStart.mockResolvedValueOnce(sectionOf(2));
  await renderFlow();
  expect(await screen.findByText('Section 2 of 3')).toBeTruthy();
});

test('complete progress opens straight to the complete screen', async () => {
  mockProgress = { status: 'complete' };
  await renderFlow();
  expect(await screen.findByText('Baseline done')).toBeTruthy();
  expect(mockStart).not.toHaveBeenCalled();
});

test('already-exists from startOrResumeBaseline shows complete, not an error', async () => {
  mockProgress = { status: 'in-progress', currentSection: 3, totalSections: 3 };
  mockStart.mockRejectedValueOnce(new CallableError('already-exists', 'already-exists', 'done'));
  await renderFlow();
  expect(await screen.findByText('Baseline done')).toBeTruthy();
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
