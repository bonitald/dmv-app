import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { QuizQuestion } from '../api/types';
import { QuizRunner, type QuizRunnerProps } from './QuizRunner';

const questions: QuizQuestion[] = [
  { id: 'q1', text: 'First question?', choices: ['Yes', 'No'], type: 'fact', chunkId: 'c1', conceptId: 'k1' },
  {
    id: 'q2',
    text: 'At a four-way stop, who goes first?',
    choices: ['Left car', 'First to stop'],
    type: 'scenario',
    chunkId: 'c2',
    conceptId: 'k2',
  },
];

async function setup(overrides: Partial<QuizRunnerProps> = {}) {
  const onSubmit = jest.fn();
  const onAnswersChange = jest.fn();
  const props: QuizRunnerProps = {
    questions,
    title: 'Section 1 of 3',
    onSubmit,
    onAnswersChange,
    submitState: 'idle',
    isOnline: true,
    ...overrides,
  };
  const utils = await render(<QuizRunner {...props} />);
  return { ...utils, onSubmit: props.onSubmit as jest.Mock, onAnswersChange, props };
}

const isSelected = (label: string) =>
  screen.getByLabelText(label).props.accessibilityState?.selected === true;

beforeEach(() => jest.restoreAllMocks());

test('shows the first question with progress and no right/wrong', async () => {
  await setup();
  expect(screen.getByText('Section 1 of 3')).toBeTruthy();
  expect(screen.getByText('Question 1 of 2')).toBeTruthy();
  expect(screen.getByText('First question?')).toBeTruthy();
  expect(screen.queryByText(/correct/i)).toBeNull();
});

test('selecting, changing and keeping answers across navigation', async () => {
  const { onAnswersChange } = await setup();
  await fireEvent.press(screen.getByText('Yes'));
  await fireEvent.press(screen.getByText('No'));
  expect(onAnswersChange).toHaveBeenLastCalledWith({ q1: 'No' });

  await fireEvent.press(screen.getByText('Next'));
  expect(screen.getByText('Question 2 of 2')).toBeTruthy();
  await fireEvent.press(screen.getByText('Back'));
  expect(isSelected('No')).toBe(true);
  expect(isSelected('Yes')).toBe(false);
});

test('the question strip jumps to any question', async () => {
  await setup();
  await fireEvent.press(screen.getByLabelText('Question 2'));
  expect(screen.getByText('At a four-way stop, who goes first?')).toBeTruthy();
});

test('scenario questions get the scenario badge', async () => {
  await setup();
  expect(screen.queryByText('SCENARIO')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Question 2'));
  expect(screen.getByText('SCENARIO')).toBeTruthy();
});

test('initialAnswers are restored', async () => {
  await setup({ initialAnswers: { q1: 'Yes' } });
  expect(isSelected('Yes')).toBe(true);
  expect(screen.getByLabelText('Question 1, answered')).toBeTruthy();
});

test('submitting with unanswered questions warns first; Submit anyway submits once', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const { onSubmit } = await setup({ initialAnswers: { q1: 'Yes' } });
  await fireEvent.press(screen.getByLabelText('Question 2'));
  await fireEvent.press(screen.getByText('Submit'));

  expect(alert).toHaveBeenCalledWith(
    '1 unanswered',
    'Unanswered questions count as wrong.',
    expect.any(Array)
  );
  expect(onSubmit).not.toHaveBeenCalled();
  const submitAnyway = alert.mock.calls[0][2]!.find((b) => b.text === 'Submit anyway')!;
  submitAnyway.onPress!();
  submitAnyway.onPress!();
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSubmit).toHaveBeenCalledWith({ q1: 'Yes' });
});

test('with everything answered, Submit submits without a warning', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const { onSubmit } = await setup({ initialAnswers: { q1: 'Yes', q2: 'Left car' } });
  await fireEvent.press(screen.getByLabelText('Question 2, answered'));
  await fireEvent.press(screen.getByText('Submit'));
  expect(alert).not.toHaveBeenCalled();
  expect(onSubmit).toHaveBeenCalledWith({ q1: 'Yes', q2: 'Left car' });
});

test('Submit is disabled while submitting', async () => {
  const { onSubmit } = await setup({
    initialAnswers: { q1: 'Yes', q2: 'Left car' },
    submitState: 'submitting',
  });
  await fireEvent.press(screen.getByLabelText('Question 2, answered'));
  await fireEvent.press(screen.getByText('Submitting…'));
  expect(onSubmit).not.toHaveBeenCalled();
});

test('offline banner, waiting-for-connection and error states', async () => {
  const { rerender, props, onSubmit } = await setup({ isOnline: false });
  expect(
    screen.getByText("You're offline. Keep going — your answers are saved on this phone.")
  ).toBeTruthy();

  await rerender(<QuizRunner {...props} isOnline={false} submitState="waiting-for-connection" />);
  expect(
    screen.getByText("Your answers are saved. We'll submit as soon as you're back online.")
  ).toBeTruthy();

  await rerender(<QuizRunner {...props} isOnline submitState="error" />);
  expect(screen.getByText("Couldn't submit. Your answers are saved.")).toBeTruthy();
  await fireEvent.press(screen.getByText('Try again'));
  expect(onSubmit).toHaveBeenCalledTimes(1);
});

test('a notice is shown when given', async () => {
  await setup({ notice: 'This section can’t be saved on your phone.' });
  expect(screen.getByText('This section can’t be saved on your phone.')).toBeTruthy();
});
