import { fireEvent, render, screen } from '@testing-library/react-native';
import { ConceptReportScreen } from './ConceptReportScreen';
import type { EvidenceState } from './useConceptEvidence';
import { toReportRows } from './conceptStrength';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
}));
let mockState: EvidenceState = { status: 'loading' };
jest.mock('./useConceptEvidence', () => ({ useConceptEvidence: () => mockState }));

const topic = (chunkId: string, order: number, approvedQuestionCount = 5) => ({ chunkId, title: `Topic ${chunkId}`, description: '', order, approvedQuestionCount });
const rows = toReportRows(
  [topic('a', 1), topic('b', 2), topic('c', 3), topic('d', 4, 0)],
  { a: { status: 'reviewed', latestMiniQuizScore: 0.9, latestMiniQuizCorrect: 9, latestMiniQuizTotal: 10 }, c: { status: 'in-progress', latestMiniQuizScore: 0.6 } },
  new Map([['b', 'missed-it' as const]])
);
const retryBaseline = jest.fn();

beforeEach(() => jest.clearAllMocks());

test('rows in handbook order with label and basis; a row opens its flashcards', async () => {
  mockState = { status: 'ready', rows, baselineError: false, retryBaseline: null };
  await render(<ConceptReportScreen />);
  expect(screen.getByText('A rough guide from your quizzes and baseline.')).toBeTruthy();
  const titles = screen.getAllByText(/^Topic /).map((n) => n.props.children);
  expect(titles).toEqual(['Topic a', 'Topic b', 'Topic c', 'Topic d']);
  expect(screen.getByText('9 of 10 right in your latest quiz')).toBeTruthy();
  expect(screen.getByText('Strong')).toBeTruthy();
  expect(screen.getByText('Missed it')).toBeTruthy();
  expect(screen.getByText('60% in your latest quiz')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText(/^Topic c, Shaky/));
  expect(mockNavigate).toHaveBeenCalledWith('Flashcards', { chunkId: 'c' });
});

test('needs work first reorders the rows', async () => {
  mockState = { status: 'ready', rows, baselineError: false, retryBaseline: null };
  await render(<ConceptReportScreen />);
  await fireEvent.press(screen.getByText('Needs work first'));
  const titles = screen.getAllByText(/^Topic /).map((n) => n.props.children);
  expect(titles).toEqual(['Topic b', 'Topic c', 'Topic d', 'Topic a']);
});

test('a coming-soon topic is not pressable', async () => {
  mockState = { status: 'ready', rows, baselineError: false, retryBaseline: null };
  await render(<ConceptReportScreen />);
  await fireEvent.press(screen.getByLabelText(/^Topic d/));
  expect(mockNavigate).not.toHaveBeenCalled();
});

test('no evidence anywhere shows what fills it in, with the baseline and the concept list', async () => {
  mockState = { status: 'ready', rows: toReportRows([topic('a', 1)], {}, new Map()), baselineError: false, retryBaseline: null };
  await render(<ConceptReportScreen />);
  expect(screen.getByText(/Take the baseline or a concept's mini-quiz/)).toBeTruthy();
  await fireEvent.press(screen.getByText('Start your baseline'));
  expect(mockNavigate).toHaveBeenCalledWith('Baseline');
  await fireEvent.press(screen.getByText('Go to the concept list'));
  expect(mockNavigate).toHaveBeenLastCalledWith('Main', { screen: 'Study', params: { screen: 'StudyHome' } });
});

test('a retryable baseline failure says so with Try again, and still shows the report', async () => {
  mockState = { status: 'ready', rows, baselineError: true, retryBaseline };
  await render(<ConceptReportScreen />);
  expect(screen.getByText("Couldn't load your baseline.")).toBeTruthy();
  await fireEvent.press(screen.getByText('Try again'));
  expect(retryBaseline).toHaveBeenCalled();
  expect(screen.getByText('Topic a')).toBeTruthy();
});

test('a baseline failure that cannot be retried shows the note without a button', async () => {
  mockState = { status: 'ready', rows, baselineError: true, retryBaseline: null };
  await render(<ConceptReportScreen />);
  expect(screen.getByText("Couldn't load your baseline.")).toBeTruthy();
  expect(screen.queryByText('Try again')).toBeNull();
  expect(screen.getByText('Topic a')).toBeTruthy();
});

test('topics failing shows No connection', async () => {
  const retry = jest.fn();
  mockState = { status: 'topics-error', retry };
  await render(<ConceptReportScreen />);
  expect(screen.getByText('No connection')).toBeTruthy();
});
