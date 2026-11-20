import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { subscribePracticeAttempts } from './practiceAttempts';
import type { PracticeOutcome } from './practiceData';

// ph-4-us-1: recent practice attempts, live. Resets to loading when the uid changes so a
// previous user's attempts are never shown. Signed out: ready and empty. An error before any
// data is 'error'; an error after data keeps the last good list.
export type PracticeAttemptsState =
  | { status: 'loading' }
  | { status: 'ready'; attempts: PracticeOutcome[] }
  | { status: 'error' };

export function usePracticeAttempts(): PracticeAttemptsState {
  const { uid } = useAuth();
  const [state, setState] = useState<PracticeAttemptsState>({ status: 'loading' });

  useEffect(() => {
    setState({ status: 'loading' });
    if (!uid) {
      setState({ status: 'ready', attempts: [] });
      return;
    }
    return subscribePracticeAttempts(
      uid,
      (attempts) => setState({ status: 'ready', attempts }),
      (error) => {
        console.warn('[practiceAttempts] subscription failed', error);
        setState((prev) => (prev.status === 'ready' ? prev : { status: 'error' }));
      }
    );
  }, [uid]);

  return state;
}
