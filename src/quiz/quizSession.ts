import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QuizQuestion } from '../api/types';
import { clearTestCache, getTestCache, saveTestCache } from '../study/testCache';
import type { SessionTiming } from '../practice/timing';
import type { Answers } from './answers';

// ph-3-us-1: the one in-progress test on this device, so a force-quit or lost connection
// doesn't lose it. Questions live in testCache (ph-1-us-5); this adds which test is active and
// the answers so far, written on every change. One active test per user per kind
// (baseline, practice), so one never drops the other.

export type SessionKind = 'baseline' | 'practice';

export const CACHE_WARNING =
  "This section can't be saved on your phone. Stay connected until you submit.";

export const PRACTICE_CACHE_WARNING =
  "This test can't be saved on your phone. Stay connected until you submit.";

export interface ActiveSession {
  testId: string;
  kind: SessionKind;
  questions: QuizQuestion[];
  answers: Answers;
  /** Practice tests only (ph-3-us-9): when the test started and its limit. Absent on older saves. */
  timing?: SessionTiming;
}

interface StoredSession {
  testId: string;
  kind: SessionKind;
  answers: Answers;
  timing?: SessionTiming;
}

const activeKey = (uid: string, kind: SessionKind) => `dmv-app:active-test:${uid}:${kind}`;
// Before one session per kind, a single unsuffixed key held whichever test was active.
const legacyKey = (uid: string) => `dmv-app:active-test:${uid}`;

async function readStored(uid: string, kind: SessionKind): Promise<StoredSession | null> {
  const raw = await AsyncStorage.getItem(activeKey(uid, kind));
  if (raw !== null) return JSON.parse(raw) as StoredSession;
  // Migrate the legacy session only when it is this kind's; otherwise leave it for its own kind.
  const legacyRaw = await AsyncStorage.getItem(legacyKey(uid));
  if (legacyRaw === null) return null;
  const legacy = JSON.parse(legacyRaw) as StoredSession;
  if (legacy.kind !== kind) return null;
  await AsyncStorage.setItem(activeKey(uid, kind), legacyRaw);
  await AsyncStorage.removeItem(legacyKey(uid));
  return legacy;
}

/**
 * Caches the questions and marks this test active for its kind, replacing any earlier one of
 * that kind. `timing` is stored only when given, so a baseline session carries none. Rejects if
 * the write fails, so the caller can tell the user this test won't survive going offline.
 */
export async function startSession(
  uid: string,
  testId: string,
  kind: SessionKind,
  questions: QuizQuestion[],
  timing?: SessionTiming
): Promise<void> {
  const previous = await readStored(uid, kind).catch(() => null);
  if (previous && previous.testId !== testId) await clearTestCache(previous.testId).catch(() => {});
  await saveTestCache(testId, questions);
  const stored: StoredSession = timing
    ? { testId, kind, answers: {}, timing }
    : { testId, kind, answers: {} };
  await AsyncStorage.setItem(activeKey(uid, kind), JSON.stringify(stored));
}

/** Saves answers for the active test. A failed write is logged, not thrown: taking the test goes on. */
export async function saveAnswers(
  uid: string,
  kind: SessionKind,
  testId: string,
  answers: Answers
): Promise<void> {
  try {
    const stored = await readStored(uid, kind);
    if (stored?.testId !== testId) return;
    await AsyncStorage.setItem(activeKey(uid, kind), JSON.stringify({ ...stored, answers }));
  } catch (error) {
    console.warn('[quizSession] saving answers failed', error);
  }
}

/** The active test of this kind with its questions, or null. A session missing its questions is dropped. */
export async function getActiveSession(uid: string, kind: SessionKind): Promise<ActiveSession | null> {
  try {
    const stored = await readStored(uid, kind);
    if (!stored) return null;
    const questions = (await getTestCache(stored.testId)) as QuizQuestion[] | null;
    if (!questions) {
      await AsyncStorage.removeItem(activeKey(uid, kind));
      return null;
    }
    return { ...stored, questions };
  } catch (error) {
    console.warn('[quizSession] reading the active session failed', error);
    return null;
  }
}

/** Call on submit or abandon: clears the cached questions and the active marker. */
export async function endSession(uid: string, kind: SessionKind, testId: string): Promise<void> {
  try {
    await clearTestCache(testId);
    const stored = await readStored(uid, kind);
    if (stored?.testId === testId) await AsyncStorage.removeItem(activeKey(uid, kind));
  } catch (error) {
    console.warn('[quizSession] ending the session failed', error);
  }
}
