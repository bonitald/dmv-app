import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QuizQuestion } from '../api/types';
import { getTestCache, saveTestCache } from '../study/testCache';
import { endSession, getActiveSession, saveAnswers, startSession } from './quizSession';

const questions: QuizQuestion[] = [
  { id: 'q1', text: 'Q1', choices: ['a', 'b'], type: 'fact', chunkId: 'c', conceptId: 'k' },
];

beforeEach(() => AsyncStorage.clear());

test('a started session is found again with its questions and no answers', async () => {
  await startSession('u1', 'baseline-v1-1', 'baseline', questions);
  expect(await getActiveSession('u1', 'baseline')).toEqual({
    testId: 'baseline-v1-1',
    kind: 'baseline',
    questions,
    answers: {},
  });
});

test('saveAnswers persists immediately', async () => {
  await startSession('u1', 't1', 'baseline', questions);
  await saveAnswers('u1', 'baseline', 't1', { q1: 'b' });
  expect((await getActiveSession('u1', 'baseline'))?.answers).toEqual({ q1: 'b' });
});

test('saveAnswers for a test that is not active does nothing', async () => {
  await startSession('u1', 't1', 'baseline', questions);
  await saveAnswers('u1', 'baseline', 'other', { q1: 'b' });
  expect((await getActiveSession('u1', 'baseline'))?.answers).toEqual({});
});

test('sessions are per user', async () => {
  await startSession('u1', 't1', 'baseline', questions);
  expect(await getActiveSession('u2', 'baseline')).toBeNull();
});

test('endSession clears the session and the cached questions', async () => {
  await startSession('u1', 't1', 'baseline', questions);
  await endSession('u1', 'baseline', 't1');
  expect(await getActiveSession('u1', 'baseline')).toBeNull();
  expect(await getTestCache('t1')).toBeNull();
});

test('starting a new session replaces the old one and clears its questions', async () => {
  await startSession('u1', 't1', 'baseline', questions);
  await startSession('u1', 't2', 'baseline', questions);
  expect((await getActiveSession('u1', 'baseline'))?.testId).toBe('t2');
  expect(await getTestCache('t1')).toBeNull();
});

test('a session whose cached questions are gone is treated as none', async () => {
  await startSession('u1', 't1', 'baseline', questions);
  await AsyncStorage.removeItem('dmv-app:test-cache:t1');
  expect(await getActiveSession('u1', 'baseline')).toBeNull();
});

test('baseline and practice sessions live side by side', async () => {
  const pq: QuizQuestion[] = [{ ...questions[0], id: 'p-q1' }];
  await startSession('u1', 'b1', 'baseline', questions);
  await startSession('u1', 'p1', 'practice', pq);
  await saveAnswers('u1', 'baseline', 'b1', { q1: 'a' });
  await saveAnswers('u1', 'practice', 'p1', { 'p-q1': 'b' });
  expect(await getActiveSession('u1', 'baseline')).toEqual({
    testId: 'b1', kind: 'baseline', questions, answers: { q1: 'a' },
  });
  expect(await getActiveSession('u1', 'practice')).toEqual({
    testId: 'p1', kind: 'practice', questions: pq, answers: { 'p-q1': 'b' },
  });
});

test('starting a practice session replaces only the earlier practice session', async () => {
  await startSession('u1', 'b1', 'baseline', questions);
  await startSession('u1', 'p1', 'practice', questions);
  await startSession('u1', 'p2', 'practice', questions);
  expect(await getTestCache('p1')).toBeNull();
  expect((await getActiveSession('u1', 'practice'))?.testId).toBe('p2');
  expect((await getActiveSession('u1', 'baseline'))?.testId).toBe('b1');
  expect(await getTestCache('b1')).not.toBeNull();
});

test('ending one kind leaves the other', async () => {
  await startSession('u1', 'b1', 'baseline', questions);
  await startSession('u1', 'p1', 'practice', questions);
  await endSession('u1', 'practice', 'p1');
  expect(await getActiveSession('u1', 'practice')).toBeNull();
  expect((await getActiveSession('u1', 'baseline'))?.testId).toBe('b1');
});

test('a legacy baseline session migrates', async () => {
  await saveTestCache('b1', questions);
  await AsyncStorage.setItem(
    'dmv-app:active-test:u1',
    JSON.stringify({ testId: 'b1', kind: 'baseline', answers: { q1: 'a' } })
  );
  expect(await getActiveSession('u1', 'practice')).toBeNull();
  expect(await AsyncStorage.getItem('dmv-app:active-test:u1')).not.toBeNull();
  expect(await getActiveSession('u1', 'baseline')).toEqual({
    testId: 'b1', kind: 'baseline', questions, answers: { q1: 'a' },
  });
  expect(await AsyncStorage.getItem('dmv-app:active-test:u1')).toBeNull();
  expect(await AsyncStorage.getItem('dmv-app:active-test:u1:baseline')).not.toBeNull();
});

test('timing round-trips through start, saveAnswers and getActiveSession', async () => {
  const timing = { mode: 'timed' as const, timeLimitSec: 3600, startedAt: 123 };
  await startSession('u1', 'p1', 'practice', questions, timing);
  await saveAnswers('u1', 'practice', 'p1', { q1: 'b' });
  expect((await getActiveSession('u1', 'practice'))?.timing).toEqual(timing);
});

test('a session saved without timing reads with timing undefined', async () => {
  await saveTestCache('p1', questions);
  await AsyncStorage.setItem(
    'dmv-app:active-test:u1:practice',
    JSON.stringify({ testId: 'p1', kind: 'practice', answers: { q1: 'a' } })
  );
  const session = await getActiveSession('u1', 'practice');
  expect(session?.timing).toBeUndefined();
  expect(session?.answers).toEqual({ q1: 'a' });
});

test('baseline sessions have no timing', async () => {
  await startSession('u1', 'b1', 'baseline', questions);
  const raw = JSON.parse((await AsyncStorage.getItem('dmv-app:active-test:u1:baseline')) ?? '{}');
  expect('timing' in raw).toBe(false);
  expect((await getActiveSession('u1', 'baseline'))?.timing).toBeUndefined();
});
