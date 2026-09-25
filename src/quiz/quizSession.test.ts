import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QuizQuestion } from '../api/types';
import { getTestCache } from '../study/testCache';
import { endSession, getActiveSession, saveAnswers, startSession } from './quizSession';

const questions: QuizQuestion[] = [
  { id: 'q1', text: 'Q1', choices: ['a', 'b'], type: 'fact', chunkId: 'c', conceptId: 'k' },
];

beforeEach(() => AsyncStorage.clear());

test('a started session is found again with its questions and no answers', async () => {
  await startSession('u1', 'baseline-v1-1', 'baseline', questions);
  expect(await getActiveSession('u1')).toEqual({
    testId: 'baseline-v1-1',
    kind: 'baseline',
    questions,
    answers: {},
  });
});

test('saveAnswers persists immediately', async () => {
  await startSession('u1', 't1', 'baseline', questions);
  await saveAnswers('u1', 't1', { q1: 'b' });
  expect((await getActiveSession('u1'))?.answers).toEqual({ q1: 'b' });
});

test('saveAnswers for a test that is not active does nothing', async () => {
  await startSession('u1', 't1', 'baseline', questions);
  await saveAnswers('u1', 'other', { q1: 'b' });
  expect((await getActiveSession('u1'))?.answers).toEqual({});
});

test('sessions are per user', async () => {
  await startSession('u1', 't1', 'baseline', questions);
  expect(await getActiveSession('u2')).toBeNull();
});

test('endSession clears the session and the cached questions', async () => {
  await startSession('u1', 't1', 'baseline', questions);
  await endSession('u1', 't1');
  expect(await getActiveSession('u1')).toBeNull();
  expect(await getTestCache('t1')).toBeNull();
});

test('starting a new session replaces the old one and clears its questions', async () => {
  await startSession('u1', 't1', 'baseline', questions);
  await startSession('u1', 't2', 'baseline', questions);
  expect((await getActiveSession('u1'))?.testId).toBe('t2');
  expect(await getTestCache('t1')).toBeNull();
});

test('a session whose cached questions are gone is treated as none', async () => {
  await startSession('u1', 't1', 'baseline', questions);
  await AsyncStorage.removeItem('dmv-app:test-cache:t1');
  expect(await getActiveSession('u1')).toBeNull();
});
