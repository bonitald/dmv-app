import type { ScoreTestResult } from '../api/types';
import type { Topic } from '../topics/topicsData';
import {
  fromAttempt,
  fromScoreResult,
  lastQuizIds,
  nextTopicId,
  recommendationLine,
  recommendedChoice,
  rememberQuiz,
  routesForNextTopic,
  scoreLine,
} from './miniQuizData';

const pq = (id: string, correct: boolean, choice: string | null = 'x') => ({
  questionId: id, chunkId: 'row', choice, correctAnswer: 'y', correct, text: `Q ${id}`, choices: ['x', 'y'], type: 'fact' as const,
});
const result: ScoreTestResult = {
  testId: 't1', type: 'mini-quiz', score: 0.7, correctCount: 7, totalCount: 10, perTopic: [],
  perQuestion: [pq('a', false), pq('b', true), pq('c', false, null)], recommendation: 'review-again',
};

test('fromScoreResult keeps the counts and lists missed (wrong and skipped) questions', () => {
  const o = fromScoreResult(result);
  expect(o).toMatchObject({ testId: 't1', correctCount: 7, totalCount: 10, recommendation: 'review-again' });
  expect(o.missed.map((m) => [m.questionId, m.outcome])).toEqual([['a', 'wrong'], ['c', 'skipped']]);
});

test('a null recommendation falls back to the score', () => {
  expect(fromScoreResult({ ...result, recommendation: null, score: 0.8 }).recommendation).toBe('move-on');
  expect(fromScoreResult({ ...result, recommendation: null, score: 0.79 }).recommendation).toBe('review-again');
});

test('fromAttempt reads a saved attempt, and rejects one that is missing or malformed', () => {
  const data = { type: 'mini-quiz', score: 1, correctCount: 2, totalCount: 2, perQuestion: [pq('a', true)], recommendation: 'move-on' };
  expect(fromAttempt('t1', data)).toMatchObject({ testId: 't1', correctCount: 2, totalCount: 2, recommendation: 'move-on', missed: [] });
  expect(fromAttempt('t1', undefined)).toBeNull();
  expect(fromAttempt('t1', { type: 'mini-quiz', score: 'x' })).toBeNull();
});

test('copy', () => {
  expect(scoreLine(fromScoreResult(result))).toBe('7 of 10 · 70%');
  expect(recommendationLine('move-on')).toBe("You've got this one — ready to move on.");
  expect(recommendationLine('review-again')).toBe('Worth another look before moving on.');
  expect(recommendedChoice('move-on')).toBe('mark-reviewed');
  expect(recommendedChoice('review-again')).toBe('review-again');
});

test('remembers the last quiz per topic for excludeIds', () => {
  expect(lastQuizIds('row')).toEqual([]);
  rememberQuiz('row', ['a', 'b']);
  rememberQuiz('signs', ['s']);
  expect(lastQuizIds('row')).toEqual(['a', 'b']);
});

const topic = (chunkId: string, order: number, approvedQuestionCount = 5): Topic => ({
  chunkId, title: chunkId, description: '', order, approvedQuestionCount,
});

test('nextTopicId skips topics with no approved questions and returns null at the end', () => {
  const topics = [topic('a', 1), topic('b', 2, 0), topic('c', 3), topic('d', 4, 0)];
  expect(nextTopicId(topics, 'a')).toBe('c');
  expect(nextTopicId(topics, 'c')).toBeNull();
  expect(nextTopicId(topics, 'unknown')).toBeNull();
});

test('routesForNextTopic replaces the trailing Flashcards and MiniQuiz with the next topic', () => {
  const routes = [
    { name: 'Main', key: 'm' },
    { name: 'Review', key: 'r', params: { testId: 'x' } },
    { name: 'Flashcards', key: 'f', params: { chunkId: 'a' } },
    { name: 'MiniQuiz', key: 'q', params: { chunkId: 'a' } },
  ];
  expect(routesForNextTopic(routes, 'c')).toEqual([
    { name: 'Main', key: 'm' },
    { name: 'Review', key: 'r', params: { testId: 'x' } },
    { name: 'Flashcards', params: { chunkId: 'c' } },
  ]);
});
