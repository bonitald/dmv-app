import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { subscribeConceptProgress } from './conceptProgress';
import type { ProgressMap } from './conceptProgressData';

// ph-2-us-12: the user's Concept Progress, live. It updates when a status is written (from the
// local cache at once, even offline) or when scoreTest saves a new score. 'error' is kept apart
// from an empty map: lists show everything as not started, but nothing writes a status from an
// unknown one, so a failed read can never downgrade a reviewed topic. Signed out: empty, and
// nothing can write without a uid. `cachedEmpty` is true while the local cache is empty and the
// server hasn't answered: lists may show it, but nothing writes a status from it. When the uid changes the state resets to loading at once, so
// a previous user's map is never shown or used for a write.
export type ConceptProgressState =
  | { status: 'loading' }
  /**
   * `cachedEmpty`: nothing in the local cache and the server hasn't answered yet. Lists can
   * show it, but nothing may write a status from it: a stale empty cache must not make a
   * reviewed topic look not started (Slice 4a carry-forward).
   */
  | { status: 'ready'; byChunk: ProgressMap; cachedEmpty: boolean }
  | { status: 'error' };

export function useConceptProgress(): ConceptProgressState {
  const { uid } = useAuth();
  const [state, setState] = useState<ConceptProgressState>({ status: 'loading' });

  useEffect(() => {
    setState({ status: 'loading' });
    if (!uid) {
      setState({ status: 'ready', byChunk: {}, cachedEmpty: false });
      return;
    }
    return subscribeConceptProgress(
      uid,
      (byChunk, cachedEmpty) => setState({ status: 'ready', byChunk, cachedEmpty }),
      (error) => {
        console.warn('[conceptProgress] subscription failed', error);
        // Keep the last good map if there was one.
        setState((prev) => (prev.status === 'ready' ? prev : { status: 'error' }));
      }
    );
  }, [uid]);

  return state;
}
