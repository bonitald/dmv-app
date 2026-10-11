import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Text } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { createNavigationContainerRef, NavigationContainer, useRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { assembleMiniQuiz, scoreTest } from '../api/callables';
import { CallableError } from '../api/callableErrors';
import type { QuizQuestion, ScoreTestResult } from '../api/types';
import { markOpened, setStatusFromChoice } from '../study/conceptProgress';
import { MiniQuizScreen } from './MiniQuizScreen';

jest.mock('@react-native-firebase/app', () => ({ getApp: jest.fn() }));
jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ status: 'ready', uid: 'u1' }) }));
jest.mock('../api/callables', () => ({ assembleMiniQuiz: jest.fn(), scoreTest: jest.fn() }));
jest.mock('../study/conceptProgress', () => ({ markOpened: jest.fn(), setStatusFromChoice: jest.fn() }));
jest.mock('../study/useConceptProgress', () => ({
  useConceptProgress: () => ({ status: 'ready', byChunk: {}, cachedEmpty: false }),
}));
jest.mock('../topics/useTopics', () => ({
  useTopics: () => ({
    status: 'ready',
    topics: [
      { chunkId: 'row', title: 'Right of way', description: '', order: 1, approvedQuestionCount: 3 },
      { chunkId: 'empty', title: 'Empty', description: '', order: 2, approvedQuestionCount: 0 },
      { chunkId: 'signs', title: 'Signs', description: '', order: 3, approvedQuestionCount: 3 },
    ],
    retry: jest.fn(),
  }),
}));
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
const graded = (rec: 'move-on' | 'review-again', correct = [true, false]): ScoreTestResult => ({
  testId: 't1', type: 'mini-quiz', score: correct.filter(Boolean).length / correct.length,
  correctCount: correct.filter(Boolean).length, totalCount: correct.length, perTopic: [],
  perQuestion: correct.map((c, i) => ({ questionId: `q${i + 1}`, chunkId: 'row', choice: `A${i + 1}`, correctAnswer: c ? `A${i + 1}` : `B${i + 1}`, correct: c, text: `Question ${i + 1}` })),
  recommendation: rec,
});

function Named({ label }: { label: string }) {
  const params = useRoute().params as Record<string, unknown> | undefined;
  return <Text>{`${label} ${JSON.stringify(params ?? {})}`}</Text>;
}
const Stack = createNativeStackNavigator();
const ref = createNavigationContainerRef();
async function renderFlow() {
  await render(
    <NavigationContainer ref={ref}>
      <Stack.Navigator initialRouteName="Main">
        <Stack.Screen name="Main">{() => <Named label="Main" />}</Stack.Screen>
        <Stack.Screen name="Flashcards">{() => <Named label="Flashcards" />}</Stack.Screen>
        <Stack.Screen name="MiniQuiz" component={MiniQuizScreen as never} />
        <Stack.Screen name="Review">{() => <Named label="Review" />}</Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
  await act(() => ref.navigate('Flashcards' as never, { chunkId: 'row' } as never));
  await act(() => ref.navigate('MiniQuiz' as never, { chunkId: 'row' } as never));
}
async function answerAllAndSubmit(n: number) {
  for (let i = 1; i <= n; i++) {
    await fireEvent.press(await screen.findByText(`A${i}`));
    if (i < n) await fireEvent.press(screen.getByText('Next'));
  }
  await fireEvent.press(screen.getByText('Submit'));
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await setOnline(true);
  mockAttempt = { status: 'loading' };
  (assembleMiniQuiz as jest.Mock).mockResolvedValue({ testId: 't1', questions: [q(1), q(2)] });
});

test('loads a topic-sized quiz with no count, marks the topic opened, and grades it', async () => {
  (scoreTest as jest.Mock).mockResolvedValue(graded('review-again'));
  await renderFlow();
  expect(await screen.findByText('Question 1')).toBeTruthy();
  expect(assembleMiniQuiz).toHaveBeenCalledWith({ chunkId: 'row', excludeIds: [] });
  expect(markOpened).toHaveBeenCalledWith('u1', 'row', 'not-started');
  await answerAllAndSubmit(2);
  expect(await screen.findByText('1 of 2 · 50%')).toBeTruthy();
  expect(scoreTest).toHaveBeenCalledWith({ testId: 't1', answers: [{ questionId: 'q1', choice: 'A1' }, { questionId: 'q2', choice: 'A2' }] });
  // card performance recorded before results show
  expect(JSON.parse((await AsyncStorage.getItem('dmv-app:card-perf:u1:row'))!).lastQuizMissedIds).toEqual(['q2']);
});

test('a retake passes the previous quiz as excludeIds', async () => {
  (scoreTest as jest.Mock).mockResolvedValue(graded('move-on', [true, true]));
  await renderFlow();
  await answerAllAndSubmit(2);
  await screen.findByText('2 of 2 · 100%');
  await act(() => ref.navigate('Flashcards' as never, { chunkId: 'row' } as never));
  await act(() => ref.navigate('MiniQuiz' as never, { chunkId: 'row' } as never));
  await waitFor(() => expect(assembleMiniQuiz).toHaveBeenLastCalledWith({ chunkId: 'row', excludeIds: ['q1', 'q2'] }));
});

test('Review Again returns to the concept list', async () => {
  (scoreTest as jest.Mock).mockResolvedValue(graded('review-again'));
  await renderFlow();
  await answerAllAndSubmit(2);
  await fireEvent.press(await screen.findByText('Review Again'));
  expect(setStatusFromChoice).toHaveBeenCalledWith('u1', 'row', 'review-again');
  expect(await screen.findByText(/^Main .*"screen":"Study"/)).toBeTruthy();
  expect(ref.getRootState().routes.map((r) => r.name)).toEqual(['Main']);
});

test('Mark Reviewed after a failed quiz returns to the concept list', async () => {
  (scoreTest as jest.Mock).mockResolvedValue(graded('review-again'));
  await renderFlow();
  await answerAllAndSubmit(2);
  await fireEvent.press(await screen.findByText('Mark Reviewed'));
  expect(setStatusFromChoice).toHaveBeenCalledWith('u1', 'row', 'mark-reviewed');
  expect(await screen.findByText(/^Main .*"screen":"Study"/)).toBeTruthy();
  expect(ref.getRootState().routes.map((r) => r.name)).toEqual(['Main']);
});

test('Mark Reviewed returns to the concept list', async () => {
  (scoreTest as jest.Mock).mockResolvedValue(graded('move-on', [true, true]));
  await renderFlow();
  await answerAllAndSubmit(2);
  await fireEvent.press(await screen.findByText('Mark Reviewed'));
  expect(setStatusFromChoice).toHaveBeenCalledWith('u1', 'row', 'mark-reviewed');
  expect(await screen.findByText(/^Main .*"screen":"Study"/)).toBeTruthy();
});

test('a double tap on a choice writes and navigates once', async () => {
  (scoreTest as jest.Mock).mockResolvedValue(graded('move-on', [true, true]));
  await renderFlow();
  await answerAllAndSubmit(2);
  const button = await screen.findByText('Mark Reviewed');
  // Both taps land before navigation re-renders (one act), like a real double tap.
  // fireEvent.press is async and wraps itself in act, so two of them can't share one act;
  // call the button's host click handler twice inside a single act instead.
  const onClick = button.parent!.props.onClick as (event: unknown) => void;
  const event = { nativeEvent: {}, stopPropagation: () => {}, preventDefault: () => {} };
  await act(async () => {
    onClick(event);
    onClick(event);
  });
  expect(setStatusFromChoice).toHaveBeenCalledTimes(1);
  expect(ref.getRootState().routes.map((r) => r.name)).toEqual(['Main']);
});

test('Review answers opens the review for this quiz', async () => {
  (scoreTest as jest.Mock).mockResolvedValue(graded('review-again'));
  await renderFlow();
  await answerAllAndSubmit(2);
  await fireEvent.press(await screen.findByText('Review answers'));
  expect(await screen.findByText('Review {"testId":"t1"}')).toBeTruthy();
});

test('leaving the results without choosing writes no status', async () => {
  (scoreTest as jest.Mock).mockResolvedValue(graded('review-again'));
  await renderFlow();
  await answerAllAndSubmit(2);
  await screen.findByText('1 of 2 · 50%');
  await act(() => ref.goBack());
  expect(setStatusFromChoice).not.toHaveBeenCalled();
});

test('offline at submit holds the answers and sends them on reconnect', async () => {
  (scoreTest as jest.Mock).mockResolvedValue(graded('review-again'));
  await renderFlow();
  await screen.findByText('Question 1');
  await setOnline(false);
  await answerAllAndSubmit(2);
  expect(await screen.findByText("Your answers are saved. We'll submit as soon as you're back online.")).toBeTruthy();
  expect(scoreTest).not.toHaveBeenCalled();
  await setOnline(true);
  expect(await screen.findByText('1 of 2 · 50%')).toBeTruthy();
});

test('already graded: shows the saved attempt and records it', async () => {
  (scoreTest as jest.Mock).mockRejectedValue(new CallableError('already-exists', 'already-exists', 'scored'));
  mockAttempt = { status: 'ready', data: { type: 'mini-quiz', ...graded('review-again') } };
  await renderFlow();
  await answerAllAndSubmit(2);
  expect(await screen.findByText('1 of 2 · 50%')).toBeTruthy();
  await waitFor(async () => expect(await AsyncStorage.getItem('dmv-app:card-perf:u1:row')).not.toBeNull());
});

test('already graded but the attempt cannot be read offline: No connection with Try again', async () => {
  (scoreTest as jest.Mock).mockRejectedValue(new CallableError('already-exists', 'already-exists', 'scored'));
  mockAttempt = { status: 'error', offline: true };
  await renderFlow();
  await answerAllAndSubmit(2);
  expect(await screen.findByText('No connection')).toBeTruthy();
  expect(screen.getByText('Try again')).toBeTruthy();
});

test.each([
  [new CallableError('not-found', 'not-found', 'none'), 'Nothing here yet'],
  [new CallableError('offline', 'unavailable', 'net'), 'No connection'],
  [new CallableError('unknown', 'internal', 'boom'), 'Something went wrong'],
])('a %s at load shows "%s"', async (error, title) => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  (assembleMiniQuiz as jest.Mock).mockRejectedValue(error);
  await renderFlow();
  expect(await screen.findByText(title)).toBeTruthy();
});

test('a submit error keeps the answers with Try again', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  (scoreTest as jest.Mock).mockRejectedValueOnce(new CallableError('unknown', 'internal', 'boom')).mockResolvedValueOnce(graded('review-again'));
  await renderFlow();
  await answerAllAndSubmit(2);
  await fireEvent.press(await screen.findByText('Try again'));
  expect(await screen.findByText('1 of 2 · 50%')).toBeTruthy();
});

test('leaving mid-quiz asks first', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await renderFlow();
  await screen.findByText('Question 1');
  await act(() => ref.goBack());
  expect(alert).toHaveBeenCalledWith('Leave the quiz?', expect.any(String), expect.any(Array));
});

test('a topic with no questions is never marked opened', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  (assembleMiniQuiz as jest.Mock).mockRejectedValue(new CallableError('not-found', 'not-found', 'none'));
  await renderFlow();
  expect(await screen.findByText('Nothing here yet')).toBeTruthy();
  expect(markOpened).not.toHaveBeenCalled();
});
