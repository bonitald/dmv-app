import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import type { AttemptDoc } from './missedQuestions';
import { subscribeRecentAttempts } from './recentAttempts';

// ph-4-us-5: recent attempts of every type, live. Same rules as usePracticeAttempts: resets to
// loading on a uid change, signed out is ready and empty, an error after data keeps the data.
export type RecentAttemptsState =
  | { status: 'loading' }
  | { status: 'ready'; attempts: AttemptDoc[] }
  | { status: 'error' };

export function useRecentAttempts(): RecentAttemptsState {
  const { uid } = useAuth();
  const [state, setState] = useState<RecentAttemptsState>({ status: 'loading' });

  useEffect(() => {
    setState({ status: 'loading' });
    if (!uid) {
      setState({ status: 'ready', attempts: [] });
      return;
    }
    return subscribeRecentAttempts(
      uid,
      (attempts) => setState({ status: 'ready', attempts }),
      (error) => {
        console.warn('[recentAttempts] subscription failed', error);
        setState((prev) => (prev.status === 'ready' ? prev : { status: 'error' }));
      }
    );
  }, [uid]);

  return state;
}
