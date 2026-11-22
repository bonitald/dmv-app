import { getApp } from '@react-native-firebase/app';
import { collection, getFirestore, limit, onSnapshot, orderBy, query } from '@react-native-firebase/firestore';
import type { AttemptDoc } from './missedQuestions';

// ph-4-us-5 (Slice 5b-2): the user's newest graded attempts of every type, live, for the missed
// questions list. A single-field order, so no composite index. Reads through Firestore's offline
// cache. Reading only the newest 30 means a question missed long ago and not seen since can drop
// off the list (ph-4-us-5 Questions; fine for MVP).
export const MISSED_ATTEMPTS_LIMIT = 30;

export function subscribeRecentAttempts(
  uid: string,
  onChange: (attempts: AttemptDoc[]) => void,
  onError: (error: unknown) => void
): () => void {
  const attempts = query(
    collection(getFirestore(getApp()), 'users', uid, 'testAttempts'),
    orderBy('createdAt', 'desc'),
    limit(MISSED_ATTEMPTS_LIMIT)
  );
  return onSnapshot(
    attempts,
    (snapshot) => {
      onChange(
        snapshot.docs.map((d) => {
          const data = (d.data() ?? {}) as Record<string, unknown>;
          const createdAt = data.createdAt as { toMillis?: () => number } | null | undefined;
          return { testId: d.id, createdAtMs: createdAt?.toMillis?.() ?? null, data };
        })
      );
    },
    onError
  );
}
