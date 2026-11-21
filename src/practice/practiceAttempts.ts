import { getApp } from '@react-native-firebase/app';
import {
  collection,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from '@react-native-firebase/firestore';
import { fromPracticeAttempt, RECENT_PRACTICE_LIMIT, type PracticeOutcome } from './practiceData';

// ph-4-us-1: the user's most recent practice attempts, newest first, live. Needs the
// testAttempts (type ASC, createdAt DESC) index in firestore.indexes.json. Docs that don't
// parse as a practice attempt are dropped.
export function subscribePracticeAttempts(
  uid: string,
  onChange: (outcomes: PracticeOutcome[]) => void,
  onError: (error: unknown) => void
): () => void {
  const attempts = query(
    collection(getFirestore(getApp()), 'users', uid, 'testAttempts'),
    where('type', '==', 'practice'),
    orderBy('createdAt', 'desc'),
    limit(RECENT_PRACTICE_LIMIT)
  );
  return onSnapshot(
    attempts,
    (snapshot) => {
      const outcomes: PracticeOutcome[] = [];
      snapshot.docs.forEach((d) => {
        const outcome = fromPracticeAttempt(d.id, d.data() as Record<string, unknown>);
        if (outcome) outcomes.push(outcome);
      });
      onChange(outcomes);
    },
    onError
  );
}
