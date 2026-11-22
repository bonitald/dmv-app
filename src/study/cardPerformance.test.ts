import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PerQuestionResult } from '../api/types';
import { readTopicHistory, recordQuizResults, recordTestResults, RECORDED_TESTS_LIMIT } from './cardPerformance';

const r = (questionId: string, chunkId: string, correct: boolean): PerQuestionResult => ({
  questionId, chunkId, choice: 'x', correctAnswer: 'y', correct,
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('records per topic and user, and survives a re-read', async () => {
  await recordQuizResults('u1', [r('q1', 'row', false), r('q2', 'row', true), r('s1', 'signs', false)]);
  const row = await readTopicHistory('u1', 'row');
  expect(row.lastQuizMissedIds).toEqual(['q1']);
  expect(row.cards.q2).toEqual({ graded: 1, missed: 0, correctStreak: 1, lastCorrect: true });
  expect((await readTopicHistory('u1', 'signs')).lastQuizMissedIds).toEqual(['s1']);
  expect((await readTopicHistory('u2', 'row')).lastQuizMissedIds).toEqual([]);
  expect(await AsyncStorage.getItem('dmv-app:card-perf:u1:row')).not.toBeNull();
});

test("recording clears the topic's saved deck pass", async () => {
  await AsyncStorage.setItem('dmv-app:study:deck-position:u1:row', 'q2');
  await recordQuizResults('u1', [r('q1', 'row', false)]);
  expect(await AsyncStorage.getItem('dmv-app:study:deck-position:u1:row')).toBeNull();
});

test('a storage failure reads as no history and a write failure does not throw', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
  expect(await readTopicHistory('u1', 'row')).toEqual({ cards: {}, lastQuizMissedIds: [] });
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
  await expect(recordQuizResults('u1', [r('q1', 'row', false)])).resolves.toBeUndefined();
  warn.mockRestore();
});

test('a failed history write drops the old missed ids so Review Again cannot drill a previous quiz', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await recordQuizResults('u1', [r('old', 'row', false)]);
  expect((await readTopicHistory('u1', 'row')).lastQuizMissedIds).toEqual(['old']);
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
  await recordQuizResults('u1', [r('q1', 'row', false)]);
  expect((await readTopicHistory('u1', 'row')).lastQuizMissedIds).toEqual([]);
  expect(warn).toHaveBeenCalled();
});

test('recordTestResults records a test once', async () => {
  await recordTestResults('u1', 't1', [r('q1', 'row', false)]);
  await recordTestResults('u1', 't1', [r('q1', 'row', false)]);
  expect((await readTopicHistory('u1', 'row')).cards.q1.graded).toBe(1);
});

test('recordTestResults keeps the saved deck pass and the last quiz misses', async () => {
  await recordQuizResults('u1', [r('q9', 'row', false)]);
  await AsyncStorage.setItem('dmv-app:study:deck-position:u1:row', 'pass');
  await recordTestResults('u1', 't1', [r('q1', 'row', false)]);
  const row = await readTopicHistory('u1', 'row');
  expect(row.lastQuizMissedIds).toEqual(['q9']);
  expect(row.cards.q1).toMatchObject({ graded: 1, missed: 1 });
  expect(await AsyncStorage.getItem('dmv-app:study:deck-position:u1:row')).toBe('pass');
});

test('recordTestResults skips recording when the recorded set cannot be read', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
  await recordTestResults('u1', 't1', [r('q1', 'row', false)]);
  jest.restoreAllMocks();
  expect(await AsyncStorage.getItem('dmv-app:card-perf:u1:row')).toBeNull();
  warn.mockRestore();
});

test('recordTestResults keeps only the newest test IDs', async () => {
  for (let i = 0; i <= RECORDED_TESTS_LIMIT; i++) await recordTestResults('u1', `t${i}`, []);
  const ids = JSON.parse((await AsyncStorage.getItem('dmv-app:card-perf-recorded:u1')) as string);
  expect(ids).toHaveLength(RECORDED_TESTS_LIMIT);
  expect(ids[0]).toBe('t1');
});

test('recordTestResults ignores removed and ungraded questions', async () => {
  await recordTestResults('u1', 't1', [
    { ...r('q1', 'row', false), unavailable: true },
    { ...r('q2', 'row', false), correct: null },
  ]);
  expect((await readTopicHistory('u1', 'row')).cards).toEqual({});
});

afterEach(() => jest.restoreAllMocks());
