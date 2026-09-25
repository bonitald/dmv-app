import { useEffect, useState } from 'react';
import { getApp } from '@react-native-firebase/app';
import { doc, getFirestore, onSnapshot } from '@react-native-firebase/firestore';
import { useAuth } from '../auth/AuthProvider';
import { toBaselineProgress, type BaselineProgress } from './baselineProgressData';

// ph-3-us-13: live baseline progress for Home's card and the baseline screen. Firestore's
// offline cache serves the last-seen copy when there's no connection. On a read error it keeps
// the last good value, or reports 'error' if there was none, so screens never wait forever:
// Home shows its default card and the baseline screen asks the server instead.
export function useBaselineProgress(): BaselineProgress {
  const { uid } = useAuth();
  const [progress, setProgress] = useState<BaselineProgress>({ status: 'loading' });

  useEffect(() => {
    if (!uid) return;
    const ref = doc(getFirestore(getApp()), 'users', uid, 'baseline', 'progress');
    return onSnapshot(
      ref,
      (snapshot) =>
        setProgress(toBaselineProgress(snapshot.data() as Record<string, unknown> | undefined)),
      (error) => {
        console.warn('[baseline] progress subscription failed', error);
        setProgress((prev) => (prev.status === 'loading' ? { status: 'error' } : prev));
      }
    );
  }, [uid]);

  return progress;
}
