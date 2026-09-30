import { useCallback, useEffect, useState } from 'react';
import { getApp } from '@react-native-firebase/app';
import { doc, getDoc, getFirestore } from '@react-native-firebase/firestore';
import { useAuth } from '../auth/AuthProvider';

// ph-4-us-4: one saved attempt, users/{uid}/testAttempts/{testId}. getDoc falls back to
// Firestore's offline cache when there's no connection, so a review opened before still loads.
// With nothing cached it fails with code 'firestore/unavailable', shown as "No connection".
export type AttemptState =
  | { status: 'loading' }
  | { status: 'ready'; data: Record<string, unknown> | undefined }
  | { status: 'error'; offline: boolean };

/** Pass null to skip the read (e.g. the results are already in memory). */
export function useTestAttempt(testId: string | null): AttemptState & { retry: () => void } {
  const { uid } = useAuth();
  const [state, setState] = useState<AttemptState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!uid || !testId) return;
    let cancelled = false;
    setState({ status: 'loading' });
    getDoc(doc(getFirestore(getApp()), 'users', uid, 'testAttempts', testId))
      .then((snapshot) => {
        if (cancelled) return;
        setState({ status: 'ready', data: snapshot.data() as Record<string, unknown> | undefined });
      })
      .catch((error: { code?: string }) => {
        console.warn('[review] attempt read failed', error);
        if (!cancelled) {
          setState({ status: 'error', offline: error?.code === 'firestore/unavailable' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [uid, testId, attempt]);

  return { ...state, retry };
}
