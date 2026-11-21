import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Text } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { createNavigationContainerRef, NavigationContainer, useRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { assembleTest, scoreTest } from '../api/callables';
import { CallableError } from '../api/callableErrors';
import type { QuizQuestion, ScoreTestResult } from '../api/types';
import { setPracticeMode } from '../profile/localFlags';
import { TIMED_TEST_LIMIT_SEC } from './timing';
import { PRACTICE_CACHE_WARNING, getActiveSession, saveAnswers, startSession } from '../quiz/quizSession';
import { PracticeTestScreen } from './PracticeTestScreen';
import { startPracticeTest } from './startPracticeTest';

jest.mock('@react-native-firebase/app', () => ({ getApp: jest.fn() }));
jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ status: 'ready', uid: 'u1' }) }));
jest.mock('../api/callables', () => ({ assembleTest: jest.fn(), scoreTest: jest.fn() }));
let mockTopics: { status: string; topics?: unknown[] } = { status: 'ready' };
jest.mock('../topics/useTopics', () => ({
  useTopics: () => ({ ...mockTopics, retry: jest.fn() }),
}));
const readyTopics = {
  status: 'ready',
  topics: [{ chunkId: 'row', title: 'Right of way', description: '', order: 1, approvedQuestionCount: 3 }],
};
let mockAttempt: { status: string; data?: Record<string, unknown>; offline?: boolean } = { status: 'loading' };
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

const q = (n: number): QuizQuestion => ({ id: `q${n}`, text: `Question ${n}`, choices: [`A${n}`, `B${n}`], type: 'fact', chunkId: 'row', conceptId: 'k' });
const graded = (correct = [true, false]): ScoreTestResult => ({
  testId: 't1', type: 'practice', score: correct.filter(Boolean).length / correct.length,
  correctCount: correct.filter(Boolean).length, totalCount: correct.length,
  perTopic: [{ chunkId: 'row', correct: correct.filter(Boolean).length, total: correct.length }],
  perQuestion: correct.map((c, i) => ({ questionId: `q${i + 1}`, chunkId: 'row', choice: `A${i + 1}`, correctAnswer: c ? `A${i + 1}` : `B${i + 1}`, correct: c, text: `Question ${i + 1}` })),
} as ScoreTestResult);

function Named({ label }: { label: string }) {
  const params = useRoute().params as Record<string, unknown> | undefined;
  return <Text>{`${label} ${JSON.stringify(params ?? {})}`}</Text>;
}
const Stack = createNativeStackNavigator();
const ref = createNavigationContainerRef();
async function renderFlow(params?: { resume?: boolean; timed?: boolean }) {
  await render(
    <NavigationContainer ref={ref}>
      <Stack.Navigator initialRouteName="Main">
        <Stack.Screen name="Main">{() => <Named label="Main" />}</Stack.Screen>
        <Stack.Screen name="PracticeTest" component={PracticeTestScreen as never} />
        <Stack.Screen name="Review">{() => <Named label="Review" />}</Stack.Screen>
        <Stack.Screen name="Flashcards">{() => <Named label="Flashcards" />}</Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
  await act(() => ref.navigate('PracticeTest' as never, params as never));
}
async function submitAll(n: number) {
  for (let i = 1; i <= n; i++) {
    await fireEvent.press(await screen.findByText(`A${i}`));
    if (i < n) await fireEvent.press(screen.getByText('Next'));
  }
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await fireEvent.press(screen.getByText('Submit'));
  const confirm = alert.mock.calls.at(-1)![2]!.find((b) => b.text === 'Submit')!;
  alert.mockRestore();
  await act(async () => confirm.onPress!());
}

beforeEach(async () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await setOnline(true);
  mockAttempt = { status: 'loading' };
  mockTopics = readyTopics;
  (assembleTest as jest.Mock).mockResolvedValue({ testId: 't1', questions: [q(1), q(2)] });
});

test('starts a test, caches it, answers save, submit shows results', async () => {
  (scoreTest as jest.Mock).mockResolvedValue(graded());
  await renderFlow();
  expect(await screen.findByText('Question 1')).toBeTruthy();
  expect((await getActiveSession('u1', 'practice'))?.questions.map((x) => x.id)).toEqual(['q1', 'q2']);
  await fireEvent.press(screen.getByText('A1'));
  await waitFor(async () => expect((await getActiveSession('u1', 'practice'))?.answers).toEqual({ q1: 'A1' }));
  await fireEvent.press(screen.getByText('Next'));
  await fireEvent.press(await screen.findByText('A2'));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await fireEvent.press(screen.getByText('Submit'));
  const confirm = alert.mock.calls.at(-1)![2]!.find((b) => b.text === 'Submit')!;
  await act(async () => confirm.onPress!());
  expect(await screen.findByText('1 of 2 correct')).toBeTruthy();
  expect(scoreTest).toHaveBeenCalledWith({
    testId: 't1',
    answers: [{ questionId: 'q1', choice: 'A1' }, { questionId: 'q2', choice: 'A2' }],
    timing: { mode: 'untimed', elapsedSec: expect.any(Number) },
  });
  expect(await getActiveSession('u1', 'practice')).toBeNull();
});

test('resume uses the saved session without calling assembleTest', async () => {
  await startSession('u1', 'saved', 'practice', [q(1), q(2)]);
  await saveAnswers('u1', 'practice', 'saved', { q1: 'B1' });
  await renderFlow({ resume: true });
  expect(await screen.findByText('Question 1')).toBeTruthy();
  expect(assembleTest).not.toHaveBeenCalled();
  expect(screen.getByRole('radio', { name: 'B1', selected: true })).toBeTruthy();
});

test('resume with nothing saved assembles a new test', async () => {
  await renderFlow({ resume: true });
  expect(await screen.findByText('Question 1')).toBeTruthy();
  expect(assembleTest).toHaveBeenCalledTimes(1);
});

test('offline submit holds the answers and sends on reconnect', async () => {
  (scoreTest as jest.Mock).mockResolvedValue(graded());
  await renderFlow();
  await screen.findByText('Question 1');
  await setOnline(false);
  await submitAll(2);
  expect(await screen.findByText("Your answers are saved. We'll submit as soon as you're back online.")).toBeTruthy();
  expect(scoreTest).not.toHaveBeenCalled();
  await setOnline(true);
  expect(await screen.findByText('1 of 2 correct')).toBeTruthy();
  expect(scoreTest).toHaveBeenCalledTimes(1);
});

test('already-exists shows the saved attempt', async () => {
  (scoreTest as jest.Mock).mockRejectedValue(new CallableError('already-exists', 'already-exists', 'scored'));
  mockAttempt = { status: 'ready', data: { type: 'practice', ...graded([true, true]) } };
  await renderFlow();
  await submitAll(2);
  expect(await screen.findByText('2 of 2 correct')).toBeTruthy();
  expect(await getActiveSession('u1', 'practice')).toBeNull();
});

test.each([
  [new CallableError('offline', 'unavailable', 'net'), 'No connection'],
  [new CallableError('unknown', 'internal', 'boom'), 'Something went wrong'],
])('an assembleTest %s shows "%s"', async (error, title) => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  (assembleTest as jest.Mock).mockRejectedValue(error);
  await renderFlow();
  expect(await screen.findByText(title)).toBeTruthy();
});

test('a cache write failure shows the warning', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
  await renderFlow();
  expect(await screen.findByText('Question 1')).toBeTruthy();
  expect(await screen.findByText(PRACTICE_CACHE_WARNING)).toBeTruthy();
});

test('the cache warning says "test", not "section"', () => {
  expect(PRACTICE_CACHE_WARNING).toBe("This test can't be saved on your phone. Stay connected until you submit.");
});

test('leaving while the test is still loading does not leave a saved test behind', async () => {
  let resolve!: (v: unknown) => void;
  (assembleTest as jest.Mock).mockReturnValue(new Promise((r) => (resolve = r)));
  const view = await render(
    <NavigationContainer ref={ref}>
      <Stack.Navigator initialRouteName="Main">
        <Stack.Screen name="Main">{() => <Named label="Main" />}</Stack.Screen>
        <Stack.Screen name="PracticeTest" component={PracticeTestScreen as never} />
      </Stack.Navigator>
    </NavigationContainer>
  );
  await act(() => ref.navigate('PracticeTest' as never));
  await act(() => ref.goBack());
  await act(async () => resolve({ testId: 't9', questions: [q(1), q(2)] }));
  expect(await getActiveSession('u1', 'practice')).toBeNull();
  view.unmount();
});

test.each(['not-found', 'permission-denied'])('a %s on submit ends the test and offers a way back', async (code) => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  (scoreTest as jest.Mock).mockRejectedValue(
    Object.assign(new Error('nope'), { code: `functions/${code}` }),
  );
  await renderFlow();
  await submitAll(2);
  expect(await screen.findByText('Something went wrong')).toBeTruthy();
  expect(screen.getByText("This test can't be submitted any more. Start a new one from the Practice tab.")).toBeTruthy();
  expect(await getActiveSession('u1', 'practice')).toBeNull();
  await fireEvent.press(screen.getByText('Back to Practice'));
  expect(await screen.findByText(/^Main .*"screen":"PracticeTests"/)).toBeTruthy();
});

test('an ordinary submit error keeps the answers and Try again', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  (scoreTest as jest.Mock).mockRejectedValue(new CallableError('unknown', 'internal', 'boom'));
  await renderFlow();
  await submitAll(2);
  await waitFor(() => expect(scoreTest).toHaveBeenCalledTimes(1));
  expect(await getActiveSession('u1', 'practice')).not.toBeNull();
});

test('results wait for the topic titles instead of showing a false none line', async () => {
  (scoreTest as jest.Mock).mockResolvedValue(graded([true, false]));
  mockTopics = { status: 'loading' };
  await renderFlow();
  await submitAll(2);
  expect(await screen.findByLabelText('Loading your results')).toBeTruthy();
  expect(screen.queryByText("You didn't miss a single topic.")).toBeNull();
});

test('leaving mid-test asks first and Leave keeps the session', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await renderFlow();
  await screen.findByText('Question 1');
  await act(() => ref.goBack());
  expect(alert).toHaveBeenCalledWith('Leave the test?', 'Your answers are saved. You can resume it from the Practice tab.', [
    expect.objectContaining({ text: 'Stay' }),
    expect.objectContaining({ text: 'Leave' }),
  ]);
  const leave = alert.mock.calls.at(-1)![2]!.find((b) => b.text === 'Leave')!;
  await act(async () => leave.onPress!());
  expect(await screen.findByText(/^Main/)).toBeTruthy();
  expect(await getActiveSession('u1', 'practice')).not.toBeNull();
});

test('results: Back to Practice pops to the Practice tab', async () => {
  (scoreTest as jest.Mock).mockResolvedValue(graded());
  await renderFlow();
  await submitAll(2);
  await fireEvent.press(await screen.findByText('Back to Practice'));
  expect(await screen.findByText(/^Main .*"screen":"PracticeTests"/)).toBeTruthy();
});

test('results: Review answers opens the review for this test', async () => {
  (scoreTest as jest.Mock).mockResolvedValue(graded());
  await renderFlow();
  await submitAll(2);
  await fireEvent.press(await screen.findByText('Review answers'));
  expect(await screen.findByText('Review {"testId":"t1"}')).toBeTruthy();
});

const TIME_UP = "Time's up. Submitting your answersâ€¦";
const TIME_UP_OFFLINE = "Time's up. Your answers are saved and will be sent when you're back online.";
const HOUR_MS = TIMED_TEST_LIMIT_SEC * 1000;

describe('timed tests', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: 1_700_000_000_000 });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  async function startedAt() {
    return (await getActiveSession('u1', 'practice'))!.timing!.startedAt;
  }
  // Moves the clock to `ms` after the test started and lets the timer's next tick see it.
  async function clockAt(ms: number, tick = true) {
    jest.setSystemTime((await startedAt()) + ms);
    if (tick) await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
  }

  test('untimed: no timer, submit sends untimed timing', async () => {
    (scoreTest as jest.Mock).mockResolvedValue(graded());
    await renderFlow();
    await screen.findByText('Question 1');
    expect(screen.queryByText('60:00')).toBeNull();
    await submitAll(2);
    expect(await screen.findByText('1 of 2 correct')).toBeTruthy();
    expect(scoreTest).toHaveBeenCalledWith(expect.objectContaining({ timing: { mode: 'untimed', elapsedSec: expect.any(Number) } }));
  });

  test('timed: saves timing on the session and shows the timer', async () => {
    const before = Date.now();
    await renderFlow({ timed: true });
    await screen.findByText('Question 1');
    const timing = (await getActiveSession('u1', 'practice'))!.timing!;
    expect(timing).toEqual({ mode: 'timed', timeLimitSec: 3600, startedAt: expect.any(Number) });
    expect(timing.startedAt).toBeGreaterThanOrEqual(before);
    expect(timing.startedAt).toBeLessThan(before + 5000);
    expect(screen.getByText('60:00')).toBeTruthy();
  });

  test('timed: time up locks answers and submits once with timedOut timing', async () => {
    (scoreTest as jest.Mock).mockResolvedValue(graded());
    await renderFlow({ timed: true });
    await fireEvent.press(await screen.findByText('A1'));
    await clockAt(HOUR_MS);
    expect(await screen.findByText('1 of 2 correct')).toBeTruthy();
    expect(scoreTest).toHaveBeenCalledTimes(1);
    expect(scoreTest).toHaveBeenCalledWith({
      testId: 't1',
      answers: [{ questionId: 'q1', choice: 'A1' }],
      timing: { mode: 'timed', timeLimitSec: 3600, elapsedSec: 3600 },
    });
  });

  test('time up locks the runner and shows the notice while the submit is pending', async () => {
    (scoreTest as jest.Mock).mockReturnValue(new Promise(() => {}));
    await renderFlow({ timed: true });
    await fireEvent.press(await screen.findByText('A1'));
    await clockAt(HOUR_MS);
    expect(await screen.findByText(TIME_UP)).toBeTruthy();
    expect(screen.queryByText('Submit')).toBeNull();
    expect(screen.queryByText('Next')).toBeNull();
    await fireEvent.press(screen.getByText('B1'));
    expect(screen.getByRole('radio', { name: 'A1', selected: true })).toBeTruthy();
  });

  test('auto-submit during an in-flight submit calls scoreTest once', async () => {
    let resolve!: (v: unknown) => void;
    (scoreTest as jest.Mock).mockReturnValue(new Promise((r) => (resolve = r)));
    await renderFlow({ timed: true });
    await screen.findByText('Question 1');
    await submitAll(2);
    expect(scoreTest).toHaveBeenCalledTimes(1);
    await clockAt(HOUR_MS);
    expect(scoreTest).toHaveBeenCalledTimes(1);
    await act(async () => resolve(graded()));
    expect(await screen.findByText('1 of 2 correct')).toBeTruthy();
    expect(scoreTest).toHaveBeenCalledTimes(1);
  });

  test('a stale Submit dialog pressed after the auto-submit finished sends nothing more', async () => {
    (scoreTest as jest.Mock).mockResolvedValue(graded());
    await renderFlow({ timed: true });
    await fireEvent.press(await screen.findByText('A1'));
    await fireEvent.press(screen.getByText('Next'));
    await fireEvent.press(await screen.findByText('A2'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await fireEvent.press(screen.getByText('Submit'));
    const confirm = alert.mock.calls.at(-1)![2]!.find((b) => b.text === 'Submit')!;
    await clockAt(HOUR_MS);
    expect(await screen.findByText('1 of 2 correct')).toBeTruthy();
    expect(scoreTest).toHaveBeenCalledTimes(1);
    await act(async () => confirm.onPress!());
    expect(scoreTest).toHaveBeenCalledTimes(1);
    expect(screen.getByText('1 of 2 correct')).toBeTruthy();
  });

  test('time up while offline holds the answers and sends once on reconnect', async () => {
    (scoreTest as jest.Mock).mockResolvedValue(graded());
    await renderFlow({ timed: true });
    await fireEvent.press(await screen.findByText('A1'));
    await setOnline(false);
    await clockAt(HOUR_MS);
    expect(await screen.findByText(TIME_UP_OFFLINE)).toBeTruthy();
    expect(scoreTest).not.toHaveBeenCalled();
    await setOnline(true);
    expect(await screen.findByText('1 of 2 correct')).toBeTruthy();
    expect(scoreTest).toHaveBeenCalledTimes(1);
    expect(scoreTest).toHaveBeenCalledWith(expect.objectContaining({ timing: { mode: 'timed', timeLimitSec: 3600, elapsedSec: 3600 } }));
  });

  test('elapsed time is measured at the first submit attempt', async () => {
    (scoreTest as jest.Mock).mockResolvedValue(graded());
    await renderFlow({ timed: true });
    await screen.findByText('Question 1');
    await setOnline(false);
    await clockAt(600_000, false);
    await submitAll(2);
    await screen.findByText("Your answers are saved. We'll submit as soon as you're back online.");
    await clockAt(1_200_000, false);
    await setOnline(true);
    expect(await screen.findByText('1 of 2 correct')).toBeTruthy();
    expect(scoreTest).toHaveBeenCalledTimes(1);
    expect(scoreTest).toHaveBeenCalledWith(expect.objectContaining({ timing: { mode: 'timed', timeLimitSec: 3600, elapsedSec: 600 } }));
  });

  test('time running out overrides an earlier captured timing when the submit was held offline', async () => {
    (scoreTest as jest.Mock).mockResolvedValue(graded());
    await renderFlow({ timed: true });
    await screen.findByText('Question 1');
    await setOnline(false);
    await clockAt(600_000, false);
    await submitAll(2);
    await screen.findByText("Your answers are saved. We'll submit as soon as you're back online.");
    await clockAt(HOUR_MS);
    await setOnline(true);
    expect(await screen.findByText('1 of 2 correct')).toBeTruthy();
    expect(scoreTest).toHaveBeenCalledTimes(1);
    expect(scoreTest).toHaveBeenCalledWith(expect.objectContaining({ timing: { mode: 'timed', timeLimitSec: 3600, elapsedSec: 3600 } }));
  });

  test('an offline rejection while the connection flag is still online holds the answers and resends on reconnect', async () => {
    (scoreTest as jest.Mock).mockRejectedValueOnce(new CallableError('offline', 'unavailable', 'x')).mockResolvedValue(graded());
    await renderFlow();
    await screen.findByText('Question 1');
    await submitAll(2);
    expect(await screen.findByText("Your answers are saved. We'll submit as soon as you're back online.")).toBeTruthy();
    expect(scoreTest).toHaveBeenCalledTimes(1);
    await setOnline(false);
    await setOnline(true);
    expect(await screen.findByText('1 of 2 correct')).toBeTruthy();
    expect(scoreTest).toHaveBeenCalledTimes(2);
  });

  test('time up after a failed submit tells the teen to tap Try again', async () => {
    (scoreTest as jest.Mock).mockRejectedValue(new CallableError('unknown', 'internal', 'boom'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await renderFlow({ timed: true });
    await screen.findByText('Question 1');
    await submitAll(2);
    await screen.findByText('Try again');
    await clockAt(HOUR_MS);
    expect(await screen.findByText("Time's up. Your answers are saved — tap Try again to send them.")).toBeTruthy();
    expect(screen.queryByText(TIME_UP)).toBeNull();
  });

  test('resume with no saved session falls back to a fresh test in the saved practice mode', async () => {
    await setPracticeMode('u1', 'timed');
    await renderFlow({ resume: true });
    await screen.findByText('Question 1');
    expect((await getActiveSession('u1', 'practice'))!.timing).toEqual({ mode: 'timed', timeLimitSec: 3600, startedAt: expect.any(Number) });
    expect(screen.getByText('60:00')).toBeTruthy();
  });

  test('resuming an expired timed test submits straight away', async () => {
    (scoreTest as jest.Mock).mockResolvedValue(graded());
    await startSession('u1', 'saved', 'practice', [q(1), q(2)], { mode: 'timed', timeLimitSec: 3600, startedAt: Date.now() - 2 * HOUR_MS });
    await saveAnswers('u1', 'practice', 'saved', { q1: 'B1' });
    await renderFlow({ resume: true });
    expect(await screen.findByText('1 of 2 correct')).toBeTruthy();
    expect(scoreTest).toHaveBeenCalledTimes(1);
    expect(scoreTest).toHaveBeenCalledWith({
      testId: 'saved',
      answers: [{ questionId: 'q1', choice: 'B1' }],
      timing: { mode: 'timed', timeLimitSec: 3600, elapsedSec: 3600 },
    });
  });

  test('resuming a 5a session without timing runs untimed and sends no timing', async () => {
    (scoreTest as jest.Mock).mockResolvedValue(graded());
    await startSession('u1', 'saved', 'practice', [q(1), q(2)]);
    await renderFlow({ resume: true });
    await screen.findByText('Question 1');
    expect(screen.queryByText(/^\d+:\d\d$/)).toBeNull();
    await submitAll(2);
    expect(await screen.findByText('1 of 2 correct')).toBeTruthy();
    expect(scoreTest).toHaveBeenCalledTimes(1);
    expect(Object.keys((scoreTest as jest.Mock).mock.calls[0][0])).not.toContain('timing');
  });

  test('leaving a timed test mentions the timer', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderFlow({ timed: true });
    await screen.findByText('Question 1');
    await act(() => ref.goBack());
    expect(alert).toHaveBeenCalledWith(
      'Leave the test?',
      "Your answers are saved. The timer keeps going while you're away. You can resume it from the Practice tab.",
      [expect.objectContaining({ text: 'Stay' }), expect.objectContaining({ text: 'Leave' })]
    );
  });
});

describe('startPracticeTest', () => {
  async function renderStack() {
    await render(
      <NavigationContainer ref={ref}>
        <Stack.Navigator initialRouteName="Main">
          <Stack.Screen name="Main">{() => <Named label="Main" />}</Stack.Screen>
          <Stack.Screen name="PracticeTest">{() => <Named label="PracticeTest" />}</Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  test('navigates straight away when nothing is saved', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderStack();
    await act(() => startPracticeTest(ref as never, 'u1', 'navigate'));
    expect(alert).not.toHaveBeenCalled();
    expect(await screen.findByText(/^PracticeTest/)).toBeTruthy();
  });

  test('asks before discarding a saved test; Start new clears it and navigates', async () => {
    await startSession('u1', 'saved', 'practice', [q(1)]);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderStack();
    await act(() => startPracticeTest(ref as never, 'u1', 'navigate'));
    expect(alert).toHaveBeenCalledWith('Start a new test?', 'Your unfinished test will be discarded.', [
      expect.objectContaining({ text: 'Cancel' }),
      expect.objectContaining({ text: 'Start new' }),
    ]);
    const start = alert.mock.calls.at(-1)![2]!.find((b) => b.text === 'Start new')!;
    await act(async () => start.onPress!());
    expect(await screen.findByText(/^PracticeTest/)).toBeTruthy();
    expect(await getActiveSession('u1', 'practice')).toBeNull();
  });

  test('passes timed from the saved preference', async () => {
    await setPracticeMode('u1', 'timed');
    await renderStack();
    await act(() => startPracticeTest(ref as never, 'u1', 'navigate'));
    expect(await screen.findByText('PracticeTest {"timed":true}')).toBeTruthy();
  });

  test('expired saved test opens it instead of prompting', async () => {
    await startSession('u1', 'saved', 'practice', [q(1)], {
      mode: 'timed',
      timeLimitSec: TIMED_TEST_LIMIT_SEC,
      startedAt: Date.now() - (TIMED_TEST_LIMIT_SEC + 5) * 1000,
    });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderStack();
    await act(() => startPracticeTest(ref as never, 'u1', 'navigate'));
    expect(alert).not.toHaveBeenCalled();
    expect(await screen.findByText('PracticeTest {"resume":true}')).toBeTruthy();
    expect(await getActiveSession('u1', 'practice')).not.toBeNull();
  });

  test('expired saved test replaces the route in replace mode', async () => {
    await startSession('u1', 'saved', 'practice', [q(1)], {
      mode: 'timed',
      startedAt: Date.now() - (TIMED_TEST_LIMIT_SEC + 5) * 1000,
    });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderStack();
    await act(() => startPracticeTest(ref as never, 'u1', 'replace'));
    expect(alert).not.toHaveBeenCalled();
    expect(await screen.findByText('PracticeTest {"resume":true}')).toBeTruthy();
  });

  test('unexpired saved test still asks before discarding', async () => {
    await startSession('u1', 'saved', 'practice', [q(1)], {
      mode: 'timed',
      timeLimitSec: TIMED_TEST_LIMIT_SEC,
      startedAt: Date.now() - 60 * 1000,
    });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderStack();
    await act(() => startPracticeTest(ref as never, 'u1', 'navigate'));
    expect(alert).toHaveBeenCalledWith('Start a new test?', expect.any(String), expect.any(Array));
  });

  test('confirming Start new after the test ran out opens it instead of deleting it', async () => {
    const realNow = Date.now();
    await startSession('u1', 'saved', 'practice', [q(1)], {
      mode: 'timed',
      timeLimitSec: TIMED_TEST_LIMIT_SEC,
      startedAt: realNow - 60 * 1000,
    });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderStack();
    await act(() => startPracticeTest(ref as never, 'u1', 'navigate'));
    const start = alert.mock.calls.at(-1)![2]!.find((b) => b.text === 'Start new')!;
    const now = jest.spyOn(Date, 'now').mockReturnValue(realNow + TIMED_TEST_LIMIT_SEC * 1000);
    await act(async () => start.onPress!());
    now.mockRestore();
    expect(await screen.findByText('PracticeTest {"resume":true}')).toBeTruthy();
    expect(await getActiveSession('u1', 'practice')).not.toBeNull();
  });

  test('Cancel neither clears the session nor navigates', async () => {
    await startSession('u1', 'saved', 'practice', [q(1)]);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderStack();
    await act(() => startPracticeTest(ref as never, 'u1', 'navigate'));
    const cancel = alert.mock.calls.at(-1)![2]!.find((b) => b.text === 'Cancel')!;
    await act(async () => cancel.onPress?.());
    expect(screen.getByText(/^Main/)).toBeTruthy();
    expect(await getActiveSession('u1', 'practice')).not.toBeNull();
  });
});
