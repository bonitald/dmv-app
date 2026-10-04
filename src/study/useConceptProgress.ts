import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { subscribeConceptProgress } from './conceptProgress';
import type { ProgressMap } from './conceptProgressData';

// ph-2-us-12: the user's Concept Progress, live. It updates when a status is written (from the
// local cache at once, even offline) or when scoreTest saves a new score. 'error' is kept apart
// from an empty map: lists show everything as not started, but nothing writes a status from an
// unknown one, so a failed read can never downgrade a reviewed topic. Signed out: empty, and
// nothing can write without a uid.
export type ConceptProgressState =
  | { status: 'loading' }
  | { status: 'ready'; byChunk: ProgressMap }
  | { status: 'error' };

export function useConceptProgress(): ConceptProgressState {
  const { uid } = useAuth();
  const [state, setState] = useState<ConceptProgressState>({ status: 'loading' });

  useEffect(() => {
    if (!uid) {
      setState({ status: 'ready', byChunk: {} });
      return;
    }
    return subscribeConceptProgress(
      uid,
      (byChunk) => setState({ status: 'ready', byChunk }),
      (error) => {
        console.warn('[conceptProgress] subscription failed', error);
        // Keep the last good map if there was one.
        setState((prev) => (prev.status === 'ready' ? prev : { status: 'error' }));
      }
    );
  }, [uid]);

  return state;
}
