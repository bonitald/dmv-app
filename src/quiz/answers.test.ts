import type { QuizQuestion } from '../api/types';
import { countUnanswered, toAnswerList } from './answers';

const q = (id: string): QuizQuestion => ({
  id,
  text: `Q ${id}`,
  choices: ['a', 'b'],
  type: 'fact',
  chunkId: 'c',
  conceptId: 'k',
});
const questions = [q('1'), q('2'), q('3')];

test('toAnswerList keeps question order and skips unanswered', () => {
  expect(toAnswerList(questions, { '3': 'b', '1': 'a' })).toEqual([
    { questionId: '1', choice: 'a' },
    { questionId: '3', choice: 'b' },
  ]);
});

test('toAnswerList ignores answers for questions not in the set', () => {
  expect(toAnswerList(questions, { '9': 'a' })).toEqual([]);
});

test('countUnanswered', () => {
  expect(countUnanswered(questions, { '2': 'a' })).toBe(2);
  expect(countUnanswered(questions, { '1': 'a', '2': 'a', '3': 'b' })).toBe(0);
});
