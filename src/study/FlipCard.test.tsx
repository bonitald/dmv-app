import { fireEvent, render, screen } from '@testing-library/react-native';
import { FlipCard } from './FlipCard';

const card = {
  text: 'Who goes first at a 4-way stop?',
  correctAnswer: 'The first car to stop',
  type: 'fact' as const,
};

test('starts on the front: the question, labelled as one, and a hint', async () => {
  await render(<FlipCard card={card} />);
  expect(screen.getByLabelText('Question: Who goes first at a 4-way stop?')).toBeTruthy();
  expect(screen.getByText('Tap to see the answer')).toBeTruthy();
  expect(screen.queryByText('SCENARIO')).toBeNull();
});

test('a tap turns it to the answer, and another tap turns it back', async () => {
  await render(<FlipCard card={card} />);
  await fireEvent.press(screen.getByLabelText('Question: Who goes first at a 4-way stop?'));
  expect(screen.getByLabelText('Answer: The first car to stop')).toBeTruthy();
  expect(screen.getByText('ANSWER')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Answer: The first car to stop'));
  expect(screen.getByLabelText('Question: Who goes first at a 4-way stop?')).toBeTruthy();
});

test('rapid taps never stick: an even number of taps ends on the front', async () => {
  await render(<FlipCard card={card} />);
  for (let i = 0; i < 4; i++) {
    await fireEvent.press(screen.getByRole('button'));
  }
  expect(screen.getByLabelText('Question: Who goes first at a 4-way stop?')).toBeTruthy();
});

test('a scenario card shows the badge and says so', async () => {
  await render(<FlipCard card={{ ...card, type: 'scenario' }} />);
  expect(screen.getByText('SCENARIO')).toBeTruthy();
  expect(screen.getByLabelText('Scenario question: Who goes first at a 4-way stop?')).toBeTruthy();
});

test('an unknown type gets the plain fact styling', async () => {
  await render(<FlipCard card={{ ...card, type: 'diagram' as never }} />);
  expect(screen.queryByText('SCENARIO')).toBeNull();
  expect(screen.getByLabelText('Question: Who goes first at a 4-way stop?')).toBeTruthy();
});
