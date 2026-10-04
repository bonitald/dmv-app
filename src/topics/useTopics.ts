import { useCallback, useEffect, useState } from 'react';
import { getApp } from '@react-native-firebase/app';
import { collection, getDocs, getFirestore } from '@react-native-firebase/firestore';
import { toTopics, type Topic } from './topicsData';

// The topic catalog (titles, handbook order), read once per screen. Firestore's offline cache
// serves it when there's no connection and it was read before. Results and review treat
// 'error' as "no titles" and fall back to chunkIds; the concept list shows "No connection" and
// calls retry().
export type TopicsState =
  | { status: 'loading' }
  | { status: 'ready'; topics: Topic[] }
  | { status: 'error' };

export function useTopics(): TopicsState & { retry: () => void } {
  const [state, setState] = useState<TopicsState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    getDocs(collection(getFirestore(getApp()), 'topics'))
      .then((snapshot) => {
        if (cancelled) return;
        const docs = snapshot.docs.map((d) => ({
          id: d.id,
          data: d.data() as Record<string, unknown>,
        }));
        setState({ status: 'ready', topics: toTopics(docs) });
      })
      .catch((error) => {
        console.warn('[topics] read failed', error);
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { ...state, retry };
}
