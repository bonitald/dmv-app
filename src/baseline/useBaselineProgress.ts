import { useEffect, useState } from 'react';
import { getApp } from '@react-native-firebase/app';
import { doc, getFirestore, onSnapshot } from '@react-native-firebase/firestore';
import { useAuth } from '../auth/AuthProvider';
import { toBaselineProgress, type BaselineProgress } from './baselineProgressData';

// ph-3-us-13: live baseline progress for Home's card and the baseline screen. Firestore's
// offline cache serves the last-seen copy when there's no connection. On a read error it
// stays at the last good value (or 'loading'), and the screens fall back to their defaults.
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
      (error) => console.warn('[baseline] progress subscription failed', error)
    );
  }, [uid]);

  return progress;
}
