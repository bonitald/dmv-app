import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getFlashcards } from '../api/callables';
import { CallableError } from '../api/callableErrors';
import type { Flashcard } from '../api/types';
import { markOpened } from './conceptProgress';
import { clearDeckCache } from './flashcardCache';
import { FlashcardScreen } from './FlashcardScreen';
import type { ConceptProgressState } from './useConceptProgress';

// ph-2-us-3 through the real screen, deck logic, cache and flip card. Only the callable, the
// Concept Progress read/write and topics are mocked.
jest.mock('@react-native-firebase/app', () => ({ getApp: jest.fn() }));
jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ status: 'ready', uid: 'u1' }) }));
jest.mock('../api/callables', () => ({ getFlashcards: jest.fn() }));
jest.mock('./conceptProgress', () => ({ markOpened: jest.fn() }));
let mockProgress: ConceptProgressState = { status: 'ready', byChunk: {}, cachedEmpty: false };
jest.mock('./useConceptProgress', () => ({ useConceptProgress: () => mockProgress }));
jest.mock('../topics/useTopics', () => ({
  useTopics: () => ({
    status: 'ready',
    topics: [{ chunkId: 'row', title: 'Right of way', description: '', order: 1, approvedQuestionCount: 2 }],
    retry: jest.fn(),
  }),
}));

const mockGet = getFlashcards as jest.Mock;
const card = (n: number, over: Partial<Flashcard> = {}): Flashcard => ({
  id: `q${n}`,
  text: `Question ${n}`,
  choices: [`Right ${n}`, `Wrong ${n}`],
  correctAnswer: `Right ${n}`,
  type: 'fact',
  chunkId: 'row',
  conceptId: 'k',
  ...over,
});
const deckOf = (...cards: Flashcard[]) => ({ chunkId: 'row', cards });

const Stack = createNativeStackNavigator();
function tree() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Flashcards" component={FlashcardScreen as never} initialParams={{ chunkId: 'row' }} />
        <Stack.Screen name="MiniQuiz">{() => <Text>Mini-quiz screen</Text>}</Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function treeWith(params: object) {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Flashcards" component={FlashcardScreen as never} initialParams={params} />
        <Stack.Screen name="MiniQuiz">{() => <Text>Mini-quiz screen</Text>}</Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

async function seedHistory(missedIds: string[], cards: Record<string, unknown> = {}) {
  await AsyncStorage.setItem('dmv-app:card-perf:u1:row', JSON.stringify({ cards, lastQuizMissedIds: missedIds }));
}
const weak = { graded: 1, missed: 1, correctStreak: 0, lastCorrect: false };

afterEach(() => jest.restoreAllMocks());

beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(Math, 'random').mockReturnValue(0.999);
  clearDeckCache();
  await AsyncStorage.clear();
  mockProgress = { status: 'ready', byChunk: {}, cachedEmpty: false };
});

test('shows the first front with progress and no choices; Next and Previous move', async () => {
  mockGet.mockResolvedValue(deckOf(card(1), card(2)));
  await render(tree());

  expect(await screen.findByLabelText('Question: Question 1')).toBeTruthy();
  expect(screen.getByText('1 of 2')).toBeTruthy();
  expect(screen.queryByText('Wrong 1')).toBeNull();
  expect(mockGet).toHaveBeenCalledWith({ chunkId: 'row' });

  await fireEvent.press(screen.getByText('Next'));
  expect(screen.getByLabelText('Question: Question 2')).toBeTruthy();
  expect(screen.getByText('2 of 2')).toBeTruthy();

  await fireEvent.press(screen.getByText('Previous'));
  expect(screen.getByLabelText('Question: Question 1')).toBeTruthy();
});

test('a card turned to its answer shows its front again after moving away and back', async () => {
  mockGet.mockResolvedValue(deckOf(card(1), card(2)));
  await render(tree());

  await fireEvent.press(await screen.findByLabelText('Question: Question 1'));
  expect(screen.getByLabelText('Answer: Right 1')).toBeTruthy();
  await fireEvent.press(screen.getByText('Next'));
  await fireEvent.press(screen.getByText('Previous'));
  expect(screen.getByLabelText('Question: Question 1')).toBeTruthy();
});

test('end of deck: start over reuses the session copy; the mini-quiz opens its screen', async () => {
  mockGet.mockResolvedValue(deckOf(card(1), card(2)));
  await render(tree());
  await screen.findByLabelText('Question: Question 1');

  await fireEvent.press(screen.getByText('Next'));
  await fireEvent.press(screen.getByText('Next'));
  expect(screen.getByText('End of this concept')).toBeTruthy();

  await fireEvent.press(screen.getByText('Back to the last card'));
  expect(screen.getByText('2 of 2')).toBeTruthy();
  await fireEvent.press(screen.getByText('Next'));

  await fireEvent.press(screen.getByText('Start this concept over'));
  expect(screen.getByText('1 of 2')).toBeTruthy();
  expect(mockGet).toHaveBeenCalledTimes(1);

  await fireEvent.press(screen.getByText('Next'));
  await fireEvent.press(screen.getByText('Next'));
  await fireEvent.press(screen.getByText('Take the mini-quiz'));
  expect(await screen.findByText('Mini-quiz screen')).toBeTruthy();
});

test('one-card topic: Previous is disabled and Next goes straight to the end', async () => {
  mockGet.mockResolvedValue(deckOf(card(1)));
  await render(tree());
  await screen.findByLabelText('Question: Question 1');

  expect(screen.getByRole('button', { name: 'Previous' }).props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(screen.getByText('Next'));
  expect(screen.getByText('End of this concept')).toBeTruthy();
  expect(screen.getByText(/You've been through the only card in this concept\./)).toBeTruthy();

  await fireEvent.press(screen.getByText('Start this concept over'));
  expect(screen.getByText('1 of 1')).toBeTruthy();
});

test('a scenario card is badged inside the same flow', async () => {
  mockGet.mockResolvedValue(deckOf(card(1, { type: 'scenario' }), card(2)));
  await render(tree());
  expect(await screen.findByLabelText('Scenario question: Question 1')).toBeTruthy();
  expect(screen.getByText('SCENARIO')).toBeTruthy();
});

test('opening marks a not-started topic and remembers it for Home', async () => {
  mockGet.mockResolvedValue(deckOf(card(1)));
  await render(tree());
  await screen.findByLabelText('Question: Question 1');

  await waitFor(() => expect(markOpened).toHaveBeenCalledWith('u1', 'row', 'not-started'));
  expect(markOpened).toHaveBeenCalledTimes(1);
  await waitFor(async () =>
    expect(await AsyncStorage.getItem('dmv-app:study:last-opened:u1')).toBe('row')
  );
});

test('a reviewed topic is passed as reviewed, so markOpened leaves it alone', async () => {
  mockProgress = { status: 'ready', byChunk: { row: { status: 'reviewed' } }, cachedEmpty: false };
  mockGet.mockResolvedValue(deckOf(card(1)));
  await render(tree());
  await screen.findByLabelText('Question: Question 1');
  await waitFor(() => expect(markOpened).toHaveBeenCalledWith('u1', 'row', 'reviewed'));
});

test.each([{ status: 'loading' }, { status: 'error' }] as ConceptProgressState[])(
  'never writes status while progress is %o, but still remembers the topic',
  async (progress) => {
    mockProgress = progress;
    mockGet.mockResolvedValue(deckOf(card(1)));
    await render(tree());
    // While progress is still loading the first pass waits for it (so a needs-revisit topic
    // doesn't open full); a failed read opens the full deck.
    if (progress.status === 'error') await screen.findByLabelText('Question: Question 1');
    await waitFor(async () =>
      expect(await AsyncStorage.getItem('dmv-app:study:last-opened:u1')).toBe('row')
    );
    expect(markOpened).not.toHaveBeenCalled();
  }
);

test('a cache-only empty progress snapshot never writes a status', async () => {
  mockProgress = { status: 'ready', byChunk: {}, cachedEmpty: true };
  mockGet.mockResolvedValue(deckOf(card(1)));
  await render(tree());
  await screen.findByLabelText('Question: Question 1');
  await waitFor(async () =>
    expect(await AsyncStorage.getItem('dmv-app:study:last-opened:u1')).toBe('row')
  );
  expect(markOpened).not.toHaveBeenCalled();
});

test('reopening a topic this session makes no new call', async () => {
  mockGet.mockResolvedValue(deckOf(card(1)));
  const first = await render(tree());
  await screen.findByLabelText('Question: Question 1');
  await first.unmount();

  await render(tree());
  expect(await screen.findByLabelText('Question: Question 1')).toBeTruthy();
  expect(mockGet).toHaveBeenCalledTimes(1);
});

test('reopening a topic resumes on the card it was left on', async () => {
  mockGet.mockResolvedValue(deckOf(card(1), card(2), card(3)));
  const first = await render(tree());
  await screen.findByLabelText('Question: Question 1');
  await fireEvent.press(screen.getByText('Next'));
  await fireEvent.press(screen.getByText('Next'));
  await waitFor(async () =>
    expect(JSON.parse((await AsyncStorage.getItem('dmv-app:study:deck-position:u1:row')) ?? 'null')?.cardId).toBe('q3')
  );
  await first.unmount();

  await render(tree());
  expect(await screen.findByLabelText('Question: Question 3')).toBeTruthy();
  expect(screen.getByText('3 of 3')).toBeTruthy();
});

test('finishing the deck clears the position, so the topic reopens on the first card', async () => {
  mockGet.mockResolvedValue(deckOf(card(1), card(2)));
  await AsyncStorage.setItem('dmv-app:study:deck-position:u1:row', JSON.stringify({ mode: 'full', cardIds: ['q1', 'q2'], cardId: 'q2' }));
  const first = await render(tree());
  expect(await screen.findByLabelText('Question: Question 2')).toBeTruthy();
  await fireEvent.press(screen.getByText('Next'));
  expect(screen.getByText('End of this concept')).toBeTruthy();
  await waitFor(async () =>
    expect(await AsyncStorage.getItem('dmv-app:study:deck-position:u1:row')).toBeNull()
  );
  await first.unmount();

  await render(tree());
  expect(await screen.findByLabelText('Question: Question 1')).toBeTruthy();
});

test('a saved card that is no longer in the deck opens the first card', async () => {
  mockGet.mockResolvedValue(deckOf(card(1), card(2)));
  await AsyncStorage.setItem('dmv-app:study:deck-position:u1:row', JSON.stringify({ mode: 'full', cardIds: ['gone'], cardId: 'gone' }));
  await render(tree());
  expect(await screen.findByLabelText('Question: Question 1')).toBeTruthy();
});

test.each([
  [new CallableError('not-found', 'not-found', 'none'), 'Nothing here yet'],
  [new CallableError('resource-exhausted', 'resource-exhausted', 'slow'), 'Take a short break'],
  [new CallableError('offline', 'unavailable', 'net'), 'No connection'],
  [new CallableError('unknown', 'internal', 'boom'), 'Something went wrong'],
])('a %s failure shows "%s" and writes nothing', async (error, title) => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockGet.mockRejectedValue(error);
  await render(tree());

  expect(await screen.findByText(title)).toBeTruthy();
  expect(markOpened).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('dmv-app:study:last-opened:u1')).toBeNull();
});

test('an empty deck shows "Nothing here yet" with a Back button', async () => {
  mockGet.mockResolvedValue(deckOf());
  await render(tree());
  expect(await screen.findByText('Nothing here yet')).toBeTruthy();
  expect(screen.getByText('Back')).toBeTruthy();
  expect(markOpened).not.toHaveBeenCalled();
});

test('retry after a connection failure loads the deck', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockGet
    .mockRejectedValueOnce(new CallableError('offline', 'unavailable', 'net'))
    .mockResolvedValueOnce(deckOf(card(1)));
  await render(tree());

  await fireEvent.press(await screen.findByText('Try again'));
  expect(await screen.findByLabelText('Question: Question 1')).toBeTruthy();
});

test('a full pass puts weak cards first', async () => {
  await seedHistory([], { q3: weak });
  mockGet.mockResolvedValue(deckOf(card(1), card(2), card(3)));
  await render(tree());
  expect(await screen.findByLabelText('Question: Question 3')).toBeTruthy();
  expect(screen.getByText('1 of 3')).toBeTruthy();
});

test('a needs-revisit topic opens on only the cards missed in its last quiz', async () => {
  mockProgress = { status: 'ready', byChunk: { row: { status: 'needs-revisit' } }, cachedEmpty: false } as ConceptProgressState;
  await seedHistory(['q2', 'q3'], { q2: weak, q3: weak });
  mockGet.mockResolvedValue(deckOf(card(1), card(2), card(3)));
  await render(tree());
  expect(await screen.findByText('Reviewing the 2 you missed')).toBeTruthy();
  expect(screen.getByLabelText('Question: Question 2')).toBeTruthy();
  expect(screen.getByText('1 of 2')).toBeTruthy();

  await fireEvent.press(screen.getByText('Show all cards'));
  expect(screen.queryByText('Reviewing the 2 you missed')).toBeNull();
  expect(screen.getByText('1 of 3')).toBeTruthy();
});

test('a needs-revisit topic with no history opens the full deck without a banner', async () => {
  mockProgress = { status: 'ready', byChunk: { row: { status: 'needs-revisit' } }, cachedEmpty: false } as ConceptProgressState;
  mockGet.mockResolvedValue(deckOf(card(1), card(2)));
  await render(tree());
  await screen.findByLabelText('Question: Question 1');
  expect(screen.queryByText(/you missed/)).toBeNull();
  expect(screen.getByText('1 of 2')).toBeTruthy();
});

test('the end of a missed-only pass offers the quiz and all cards', async () => {
  await seedHistory(['q2']);
  mockGet.mockResolvedValue(deckOf(card(1), card(2)));
  await render(treeWith({ chunkId: 'row', pass: { mode: 'missed-only', nonce: 1 } }));
  await screen.findByLabelText('Question: Question 2');
  await fireEvent.press(screen.getByText('Next'));
  expect(screen.getByText("You've been through the 1 you missed.", { exact: false })).toBeTruthy();
  expect(screen.getByText('Take the mini-quiz')).toBeTruthy();
  await fireEvent.press(screen.getByText('See all cards'));
  expect(screen.getByText('1 of 2')).toBeTruthy();
});

test('a missed-only pass param after a perfect score opens the full deck', async () => {
  await seedHistory([]);
  mockGet.mockResolvedValue(deckOf(card(1), card(2)));
  await render(treeWith({ chunkId: 'row', pass: { mode: 'missed-only', nonce: 1 } }));
  await screen.findByLabelText('Question: Question 1');
  expect(screen.queryByText(/you missed/)).toBeNull();
  expect(screen.getByText('1 of 2')).toBeTruthy();
});

test('a new pass param restarts the open viewer', async () => {
  mockGet.mockResolvedValue(deckOf(card(1), card(2), card(3)));
  const ref = createNavigationContainerRef();
  await render(
    <NavigationContainer ref={ref}>
      <Stack.Navigator>
        <Stack.Screen name="Flashcards" component={FlashcardScreen as never} initialParams={{ chunkId: 'row' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
  await screen.findByLabelText('Question: Question 1');
  await fireEvent.press(screen.getByText('Next'));
  await seedHistory(['q3']);
  await act(() => ref.setParams({ chunkId: 'row', pass: { mode: 'missed-only', nonce: 2 } } as never));
  expect(await screen.findByText('Reviewing the 1 you missed')).toBeTruthy();
  expect(screen.getByLabelText('Question: Question 3')).toBeTruthy();
  expect(mockGet).toHaveBeenCalledTimes(1);
});

test('Skip to quiz shows on every card, not at the end, and opens the quiz', async () => {
  mockGet.mockResolvedValue(deckOf(card(1), card(2)));
  await render(tree());
  await screen.findByLabelText('Question: Question 1');
  expect(screen.getByText('Skip to quiz')).toBeTruthy();
  await fireEvent.press(screen.getByText('Next'));
  expect(screen.getByText('Skip to quiz')).toBeTruthy();
  await fireEvent.press(screen.getByText('Next'));
  expect(screen.getByText('End of this concept')).toBeTruthy();
  expect(screen.queryByText('Skip to quiz')).toBeNull();
  await fireEvent.press(screen.getByText('Back to the last card'));
  await fireEvent.press(screen.getByText('Skip to quiz'));
  expect(await screen.findByText('Mini-quiz screen')).toBeTruthy();
});

test('resuming restores the saved pass order and card', async () => {
  await AsyncStorage.setItem(
    'dmv-app:study:deck-position:u1:row',
    JSON.stringify({ mode: 'full', cardIds: ['q3', 'q1', 'q2'], cardId: 'q1' })
  );
  mockGet.mockResolvedValue(deckOf(card(1), card(2), card(3)));
  await render(tree());
  expect(await screen.findByLabelText('Question: Question 1')).toBeTruthy();
  expect(screen.getByText('2 of 3')).toBeTruthy();
  await fireEvent.press(screen.getByText('Next'));
  expect(screen.getByLabelText('Question: Question 2')).toBeTruthy();
});

test('Show all cards saves the new full pass, so reopening does not resume the old missed-only one', async () => {
  await seedHistory(['q2', 'q3']);
  mockGet.mockResolvedValue(deckOf(card(1), card(2), card(3)));
  const first = await render(treeWith({ chunkId: 'row', pass: { mode: 'missed-only', nonce: 1 } }));
  await screen.findByText('Reviewing the 2 you missed');
  await fireEvent.press(screen.getByText('Next'));
  await fireEvent.press(screen.getByText('Show all cards'));
  expect(screen.getByText('1 of 3')).toBeTruthy();
  await waitFor(async () =>
    expect(JSON.parse((await AsyncStorage.getItem('dmv-app:study:deck-position:u1:row')) ?? 'null')?.mode).toBe('full')
  );
  await first.unmount();

  await render(tree());
  await screen.findByLabelText('Question: Question 1');
  expect(screen.queryByText(/you missed/)).toBeNull();
  expect(screen.getByText('1 of 3')).toBeTruthy();
});
