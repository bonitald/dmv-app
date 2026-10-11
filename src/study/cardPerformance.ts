import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PerQuestionResult } from '../api/types';
import { PREFIX, setDeckPass } from '../profile/localFlags';
import { applyQuizResults, gradedByTopic, NO_HISTORY, parseTopicHistory, type TopicHistory } from './cardPerformanceData';

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
