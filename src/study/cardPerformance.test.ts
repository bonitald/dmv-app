import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PerQuestionResult } from '../api/types';
import { readTopicHistory, recordQuizResults } from './cardPerformance';

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
