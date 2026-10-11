import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { Topic } from '../topics/topicsData';
import { ConceptListScreen } from './ConceptListScreen';
import type { ConceptProgressState } from './useConceptProgress';

// ph-2-us-7 through the real screen and row logic. Topics and Concept Progress are mocked.
jest.mock('@react-native-firebase/app', () => ({ getApp: jest.fn() }));
const mockRetry = jest.fn();
let mockTopics: { status: string; topics?: Topic[] } = { status: 'loading' };
jest.mock('../topics/useTopics', () => ({ useTopics: () => ({ ...mockTopics, retry: mockRetry }) }));
let mockProgress: ConceptProgressState = { status: 'ready', byChunk: {}, cachedEmpty: false };
jest.mock('./useConceptProgress', () => ({ useConceptProgress: () => mockProgress }));

const topic = (chunkId: string, title: string, order: number, approvedQuestionCount = 3): Topic => ({
  chunkId,
  title,
  description: `About ${title}`,
  order,
  approvedQuestionCount,
});
const TOPICS = [
  topic('a', 'Alpha', 1),
  topic('b', 'Bravo', 2, 0),
  topic('c', 'Charlie', 3),
  topic('d', 'Delta', 4),
];

const Stack = createNativeStackNavigator();
const navRef = createNavigationContainerRef();
async function renderList() {
  return render(
    <NavigationContainer ref={navRef}>
      <Stack.Navigator>
        <Stack.Screen name="StudyHome" component={ConceptListScreen} />
        <Stack.Screen name="Flashcards">{() => <Text>Flashcards screen</Text>}</Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTopics = { status: 'ready', topics: TOPICS };
  mockProgress = { status: 'ready', byChunk: {}, cachedEmpty: false };
});

test('every topic in order with its description, status and latest quiz line', async () => {
  mockProgress = {
    status: 'ready',
    byChunk: { a: { status: 'reviewed', latestMiniQuizScore: 0.8 }, c: { status: 'in-progress' } },
    cachedEmpty: false,
  };
  await renderList();

  expect(screen.getByText('Start any concept, in any order, and start one over any time.')).toBeTruthy();
  expect(screen.getByLabelText('Alpha, Reviewed, Latest quiz: 80%')).toBeTruthy();
  expect(screen.getByLabelText('Bravo, Coming soon')).toBeTruthy();
  expect(screen.getByLabelText('Charlie, In progress')).toBeTruthy();
  expect(screen.getByLabelText('Delta, Not started')).toBeTruthy();
  expect(screen.getByText('About Alpha')).toBeTruthy();
  expect(screen.getByText('Latest quiz: 80%')).toBeTruthy();
  const titles = screen.getAllByText(/^(Alpha|Bravo|Charlie|Delta)$/).map((t) => t.props.children);
  expect(titles).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta']);
});

test("tapping any topic opens its flashcards, whatever its status", async () => {
  mockProgress = { status: 'ready', byChunk: { d: { status: 'reviewed' } }, cachedEmpty: false };
  await renderList();
  await fireEvent.press(screen.getByLabelText('Delta, Reviewed'));
  expect(navRef.getCurrentRoute()).toMatchObject({ name: 'Flashcards', params: { chunkId: 'd' } });
});

test('a coming-soon topic is shown but is not a button', async () => {
  await renderList();
  expect(screen.getByLabelText('Bravo, Coming soon')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Bravo/ })).toBeNull();
});

test('if progress cannot be read, every topic shows not started', async () => {
  mockProgress = { status: 'error' };
  await renderList();
  expect(screen.getByLabelText('Alpha, Not started')).toBeTruthy();
});

test('topics failing to load shows No connection, and Try again retries', async () => {
  mockTopics = { status: 'error' };
  await renderList();
  expect(screen.getByText('No connection')).toBeTruthy();
  await fireEvent.press(screen.getByText('Try again'));
  expect(mockRetry).toHaveBeenCalled();
});

test('while topics load, a labelled spinner shows', async () => {
  mockTopics = { status: 'loading' };
  await renderList();
  expect(screen.getByLabelText('Loading concepts')).toBeTruthy();
});

test('an empty list says so and offers Try again', async () => {
  mockTopics = { status: 'ready', topics: [] };
  await renderList();
  expect(screen.getByText('No concepts yet. Check back soon.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Try again'));
  expect(mockRetry).toHaveBeenCalled();
});

test('a topic whose latest quiz was not passed shows the marker and the quizzes line', async () => {
  mockProgress = {
    status: 'ready',
    byChunk: {
      a: { status: 'reviewed', latestMiniQuizScore: 0.4, latestMiniQuizCorrect: 4, latestMiniQuizTotal: 10, miniQuizPassCount: 2, miniQuizFailCount: 1 },
      c: { status: 'in-progress', latestMiniQuizScore: 0.9, latestMiniQuizCorrect: 9, latestMiniQuizTotal: 10, miniQuizPassCount: 1 },
    },
    cachedEmpty: false,
  };
  await renderList();
  expect(screen.getAllByText('Last quiz not passed')).toHaveLength(1);
  expect(screen.getByText('Quizzes: 2 passed \u00b7 1 not passed \u00b7 latest 4 of 10')).toBeTruthy();
  expect(screen.getByText('Quizzes: 1 passed \u00b7 latest 9 of 10')).toBeTruthy();
  expect(screen.getByLabelText('Alpha, Reviewed, Last quiz not passed, Quizzes: 2 passed \u00b7 1 not passed \u00b7 latest 4 of 10')).toBeTruthy();
});
