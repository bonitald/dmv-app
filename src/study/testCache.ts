import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY_PREFIX = 'dmv-app:test-cache:';

function cacheKey(testId: string): string {
  return `${CACHE_KEY_PREFIX}${testId}`;
}

/**
 * Stores one session's question set on-device, keyed by `testId` (ph-1-us-5). The shape is
 * whatever the assembling Cloud Function returned; it's stored as-is, not interpreted.
 * Rejects if the write fails, so callers can warn the user rather than lose a test silently.
 */
export async function saveTestCache(testId: string, questions: unknown[]): Promise<void> {
  await AsyncStorage.setItem(cacheKey(testId), JSON.stringify(questions));
}

/** Returns the cached question set for `testId`, or `null` if nothing was cached for it. */
export async function getTestCache(testId: string): Promise<unknown[] | null> {
  const raw = await AsyncStorage.getItem(cacheKey(testId));
  return raw === null ? null : JSON.parse(raw);
}

/** Removes `testId`'s cached question set — call on completion or abandonment. */
export async function clearTestCache(testId: string): Promise<void> {
  await AsyncStorage.removeItem(cacheKey(testId));
}
