import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ReviewScreen } from './ReviewScreen';
import type { AttemptState } from './useTestAttempt';

// ph-4-us-4 through the real screen and quiz card. Only the attempt and topics reads are mocked.
jest.mock('@react-native-firebase/app', () => ({ getApp: jest.fn() }));
let mockAttempt: AttemptState = { status: 'loading' };
const mockRetry = jest.fn();
jest.mock('./useTestAttempt', () => ({
  useTestAttempt: () => ({ ...mockAttempt, retry: mockRetry }),
}));
jest.mock('../topics/useTopics', () => ({
  useTopics: () => ({
    status: 'ready',
    topics: [{ chunkId: 'row', title: 'Right of way', order: 1 }],
  }),
}));

const q = (id: string, over: Record<string, unknown> = {}) => ({
  questionId: id,
  chunkId: 'row',
  choice: 'a',
  correctAnswer: 'a',
  correct: true,
  text: `Text ${id}`,
  choices: ['a', 'b'],
  type: 'fact',
  ...over,
});
function ready(perQuestion: unknown[], type = 'practice') {
  mockAttempt = {
    status: 'ready',
    data:
      type === 'baseline'
        ? { type, perQuestion: [], baselineReview: perQuestion }
        : { type, perQuestion },
  };
}

const Stack = createNativeStackNavigator();
async function renderReview() {
  return render(
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Review" component={ReviewScreen} initialParams={{ testId: 't1' }} />
        <Stack.Screen name="Main">{() => <Text>Study tab</Text>}</Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

beforeEach(() => jest.clearAllMocks());

test('missed only is on by default when there are misses, and shows wrong and skipped', async () => {
  ready([q('q1'), q('q2', { choice: 'b', correct: false }), q('q3', { choice: null, correct: false })]);
  await renderReview();
  expect(screen.getByRole('switch', { name: 'Missed only' }).props.accessibilityState.checked).toBe(true);
  expect(screen.getByText('Question 1 of 2')).toBeTruthy();
  expect(screen.getByText('Text q2')).toBeTruthy();
  expect(screen.getByLabelText('b, your answer')).toBeTruthy();
  await fireEvent.press(screen.getByText('Next'));
  expect(screen.getByText('Text q3')).toBeTruthy();
  expect(screen.getByText('Not answered')).toBeTruthy();
});

test('turning missed only off shows every question', async () => {
  ready([q('q1'), q('q2', { choice: 'b', correct: false })]);
  await renderReview();
  await fireEvent.press(screen.getByRole('switch', { name: 'Missed only' }));
  expect(screen.getByText('Question 1 of 2')).toBeTruthy();
  expect(screen.getByText('Text q1')).toBeTruthy();
});

test('all correct: missed only starts off; turning it on says No misses', async () => {
  ready([q('q1')]);
  await renderReview();
  const toggle = screen.getByRole('switch', { name: 'Missed only' });
  expect(toggle.props.accessibilityState.checked).toBe(false);
  await fireEvent.press(toggle);
  expect(screen.getByText('No misses')).toBeTruthy();
  expect(screen.getByText('Text q1')).toBeTruthy();
});

test('explanation panel when present; handbook topic and Study link otherwise', async () => {
  ready([q('q1', { explanation: 'Because a.' }), q('q2')]);
  await renderReview();
  expect(screen.getByText('Because a.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Next'));
  expect(screen.getByText('From the handbook: Right of way')).toBeTruthy();
  await fireEvent.press(screen.getByText('Study this concept'));
  expect(await screen.findByText('Study tab')).toBeTruthy();
});

test('removed and pre-ph-4-us-3 questions', async () => {
  ready([
    q('gone', {
      unavailable: true,
      chunkId: null,
      correct: null,
      correctAnswer: null,
      text: null,
      choices: null,
      type: null,
    }),
    { questionId: 'old', chunkId: 'row', choice: 'b', correctAnswer: 'a', correct: false },
  ]);
  await renderReview();
  await fireEvent.press(screen.getByRole('switch', { name: 'Missed only' })); // show all
  expect(screen.getByText('This question was removed')).toBeTruthy();
  await fireEvent.press(screen.getByText('Next'));
  expect(screen.getByText('Question text unavailable')).toBeTruthy();
  expect(screen.getByText('Your answer: b')).toBeTruthy();
  expect(screen.getByText('Correct answer: a')).toBeTruthy();
});

test('the question strip marks right and wrong in text, not just color', async () => {
  ready([q('q1'), q('q2', { choice: 'b', correct: false }), q('q3', { choice: null, correct: false })]);
  await renderReview();
  await fireEvent.press(screen.getByRole('switch', { name: 'Missed only' }));
  expect(screen.getByLabelText('Question 1, right')).toBeTruthy();
  expect(screen.getByLabelText('Question 2, wrong')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Question 3, not answered'));
  expect(screen.getByText('Text q3')).toBeTruthy();
});

test('scenario questions keep the badge', async () => {
  ready([q('q1', { type: 'scenario' })]);
  await renderReview();
  expect(screen.getByText('SCENARIO')).toBeTruthy();
});

test('baseline still in progress: no review', async () => {
  mockAttempt = {
    status: 'ready',
    data: { type: 'baseline', perQuestion: [q('q1', { correct: null, correctAnswer: null })] },
  };
  await renderReview();
  expect(screen.getByText('No review yet')).toBeTruthy();
});

test('baseline complete: reviews all of baselineReview', async () => {
  ready(
    Array.from({ length: 45 }, (_, i) => q(`b${i}`)),
    'baseline'
  );
  await renderReview();
  expect(screen.getByText('Question 1 of 45')).toBeTruthy();
});

test('offline with nothing cached: no connection with retry', async () => {
  mockAttempt = { status: 'error', offline: true };
  await renderReview();
  expect(screen.getByText('No connection')).toBeTruthy();
  await fireEvent.press(screen.getByText('Try again'));
  expect(mockRetry).toHaveBeenCalled();
});
