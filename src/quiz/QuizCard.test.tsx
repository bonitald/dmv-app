import { fireEvent, render, screen } from '@testing-library/react-native';
import { QuizCard } from './QuizCard';

const question = { text: 'Q?', choices: ['Stop', 'Go', 'Yield'], type: 'scenario' as const };

test('review marks a wrong pick and the correct answer, and is not pressable', async () => {
  const onSelect = jest.fn();
  await render(
    <QuizCard
      question={question}
      selected={undefined}
      onSelect={onSelect}
      review={{ choice: 'Go', correctAnswer: 'Stop' }}
    />
  );
  expect(screen.getByLabelText('Stop, correct answer')).toBeTruthy();
  expect(screen.getByLabelText('Go, your answer')).toBeTruthy();
  expect(screen.getByText('Correct answer')).toBeTruthy();
  expect(screen.getByText('Your answer')).toBeTruthy();
  expect(screen.getByText('SCENARIO')).toBeTruthy();
  await fireEvent.press(screen.getByText('Yield'));
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.queryByRole('radio')).toBeNull();
});

test('review of a right pick shows one combined tag', async () => {
  await render(
    <QuizCard question={question} selected={undefined} review={{ choice: 'Stop', correctAnswer: 'Stop' }} />
  );
  expect(screen.getByLabelText('Stop, your answer, correct')).toBeTruthy();
  expect(screen.getByText('Your answer · Correct')).toBeTruthy();
});

test('taking a test is unchanged: radios that select', async () => {
  const onSelect = jest.fn();
  await render(<QuizCard question={question} selected="Go" onSelect={onSelect} />);
  expect(screen.getAllByRole('radio')).toHaveLength(3);
  await fireEvent.press(screen.getByText('Yield'));
  expect(onSelect).toHaveBeenCalledWith('Yield');
});
