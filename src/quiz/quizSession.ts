import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QuizQuestion } from '../api/types';
import { clearTestCache, getTestCache, saveTestCache } from '../study/testCache';
import type { Answers } from './answers';

// ph-3-us-1: the one in-progress test on this device, so a force-quit or lost connection
// doesn't lose it. Questions live in testCache (ph-1-us-5); this adds which test is active and
// the answers so far, written on every change. One active test per user at a time.

export type SessionKind = 'baseline' | 'practice' | 'mini-quiz';

export interface ActiveSession {
  testId: string;
  kind: SessionKind;
  questions: QuizQuestion[];
  answers: Answers;
}

interface StoredSession {
  testId: string;
  kind: SessionKind;
  answers: Answers;
}

const activeKey = (uid: string) => `dmv-app:active-test:${uid}`;

async function readStored(uid: string): Promise<StoredSession | null> {
  const raw = await AsyncStorage.getItem(activeKey(uid));
  return raw === null ? null : (JSON.parse(raw) as StoredSession);
}

/**
 * Caches the questions and marks this test active, replacing any earlier one. Rejects if the
 * write fails, so the caller can tell the user this test won't survive going offline.
 */
export async function startSession(
  uid: string,
  testId: string,
  kind: SessionKind,
  questions: QuizQuestion[]
): Promise<void> {
  const previous = await readStored(uid).catch(() => null);
  if (previous && previous.testId !== testId) await clearTestCache(previous.testId).catch(() => {});
  await saveTestCache(testId, questions);
  await AsyncStorage.setItem(activeKey(uid), JSON.stringify({ testId, kind, answers: {} }));
}

/** Saves answers for the active test. A failed write is logged, not thrown: taking the test goes on. */
export async function saveAnswers(uid: string, testId: string, answers: Answers): Promise<void> {
  try {
    const stored = await readStored(uid);
    if (stored?.testId !== testId) return;
    await AsyncStorage.setItem(activeKey(uid), JSON.stringify({ ...stored, answers }));
  } catch (error) {
    console.warn('[quizSession] saving answers failed', error);
  }
}

/** The active test with its questions, or null. A session missing its questions is dropped. */
export async function getActiveSession(uid: string): Promise<ActiveSession | null> {
  try {
    const stored = await readStored(uid);
    if (!stored) return null;
    const questions = (await getTestCache(stored.testId)) as QuizQuestion[] | null;
    if (!questions) {
      await AsyncStorage.removeItem(activeKey(uid));
      return null;
    }
    return { ...stored, questions };
  } catch (error) {
    console.warn('[quizSession] reading the active session failed', error);
    return null;
  }
}

/** Call on submit or abandon: clears the cached questions and the active marker. */
export async function endSession(uid: string, testId: string): Promise<void> {
  try {
    await clearTestCache(testId);
    const stored = await readStored(uid);
    if (stored?.testId === testId) await AsyncStorage.removeItem(activeKey(uid));
  } catch (error) {
    console.warn('[quizSession] ending the session failed', error);
  }
}
