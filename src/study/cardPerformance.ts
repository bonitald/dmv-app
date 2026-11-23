import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PerQuestionResult } from '../api/types';
import { PREFIX, setDeckPass } from '../profile/localFlags';
import { applyQuizResults, applyTestResults, gradedByTopic, NO_HISTORY, parseTopicHistory, type TopicHistory } from './cardPerformanceData';

// ph-2-us-6: per-question quiz history on this phone, one AsyncStorage key per user and topic
// so a topic's history loads in one read. Failures are logged and read as "no history"; they
// never reach a screen.

const key = (uid: string, chunkId: string) => `${PREFIX}card-perf:${uid}:${chunkId}`;

export async function readTopicHistory(uid: string, chunkId: string): Promise<TopicHistory> {
  try {
    return parseTopicHistory(await AsyncStorage.getItem(key(uid, chunkId)));
  } catch (error) {
    console.warn('[cardPerformance] read failed', chunkId, error);
    return NO_HISTORY;
  }
}

/**
 * Adds a graded quiz's results. Each recorded topic's saved deck pass is cleared, so the next
 * time its flashcards open they build a fresh pass from this history.
 */
export async function recordQuizResults(uid: string, perQuestion: PerQuestionResult[]): Promise<void> {
  for (const [chunkId, results] of gradedByTopic(perQuestion)) {
    try {
      const next = applyQuizResults(await readTopicHistory(uid, chunkId), results);
      await AsyncStorage.setItem(key(uid, chunkId), JSON.stringify(next));
    } catch (error) {
      console.warn('[cardPerformance] write failed', chunkId, error);
      // Don't let the previous quiz's misses survive: Review Again would drill the wrong cards.
      // With the key gone the topic falls back to a full deck.
      try {
        await AsyncStorage.removeItem(key(uid, chunkId));
      } catch (removeError) {
        console.warn('[cardPerformance] cleanup failed', chunkId, removeError);
      }
    }
    await setDeckPass(uid, chunkId, null);
  }
}

// Slice 5b-2 (ph-4-us-5): test IDs already recorded by recordTestResults, newest last, so a test
// whose results are seen twice (the practice "recovering" path, a retried baseline submit) is
// counted once. Carries the uid so Slice 6's local-data sweep treats it like the other keys.
export const RECORDED_TESTS_LIMIT = 50;
const recordedKey = (uid: string) => `${PREFIX}card-perf-recorded:${uid}`;

/** Null when the set can't be read: the caller then skips recording rather than risk counting twice. */
async function readRecorded(uid: string): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem(recordedKey(uid));
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? data.filter((id): id is string => typeof id === 'string') : [];
  } catch (error) {
    console.warn('[cardPerformance] recorded-set read failed', error);
    return null;
  }
}

/**
 * Adds a practice test's or the completed baseline's results, once per test ID. Unlike
 * recordQuizResults it leaves each topic's last-quiz misses and saved deck pass alone, so a
 * pass in progress keeps going and the new weights apply to the next one. Failures are logged.
 */
export async function recordTestResults(uid: string, testId: string, perQuestion: PerQuestionResult[]): Promise<void> {
  const recorded = await readRecorded(uid);
  if (recorded === null || recorded.includes(testId)) return;
  for (const [chunkId, results] of gradedByTopic(perQuestion)) {
    try {
      const next = applyTestResults(await readTopicHistory(uid, chunkId), results);
      await AsyncStorage.setItem(key(uid, chunkId), JSON.stringify(next));
    } catch (error) {
      // Kept as it was: removing the key would also drop the last mini-quiz's missed cards.
      console.warn('[cardPerformance] test write failed', chunkId, error);
    }
  }
  try {
    await AsyncStorage.setItem(recordedKey(uid), JSON.stringify([...recorded, testId].slice(-RECORDED_TESTS_LIMIT)));
  } catch (error) {
    console.warn('[cardPerformance] recorded-set write failed', error);
  }
}
