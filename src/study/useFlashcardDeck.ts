import { useCallback, useEffect, useState } from 'react';
import { getFlashcards } from '../api/callables';
import { toCallableError } from '../api/callableErrors';
import type { Flashcard } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { toDeckError, type DeckError } from './deck';
import { cacheDeck, getCachedDeck } from './flashcardCache';

// ph-2-us-3: one topic's cards, from this session's cache when loaded before, otherwise from
// getFlashcards. An empty deck shows like `not-found` ("Nothing here yet"). Waits for a uid:
// getFlashcards rejects unauthenticated callers.
export type DeckLoadState =
  | { status: 'loading' }
  | { status: 'ready'; cards: Flashcard[] }
  | { status: 'error'; error: DeckError };

export function useFlashcardDeck(chunkId: string): DeckLoadState & { retry: () => void } {
  const { uid } = useAuth();
  const [state, setState] = useState<DeckLoadState>(() => {
    const cached = getCachedDeck(chunkId);
    return cached ? { status: 'ready', cards: cached } : { status: 'loading' };
  });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const cached = getCachedDeck(chunkId);
    if (cached) {
      setState({ status: 'ready', cards: cached });
      return;
    }
    if (!uid) return;
    let cancelled = false;
    setState({ status: 'loading' });
    getFlashcards({ chunkId })
      .then(({ cards }) => {
        if (cards.length > 0) cacheDeck(chunkId, cards);
        if (cancelled) return;
        setState(cards.length > 0 ? { status: 'ready', cards } : { status: 'error', error: 'empty' });
      })
      .catch((error) => {
        const callableError = toCallableError(error);
        console.warn('[flashcards] load failed', chunkId, callableError.code, callableError.message);
        if (!cancelled) setState({ status: 'error', error: toDeckError(callableError.kind) });
      });
    return () => {
      cancelled = true;
    };
  }, [uid, chunkId, attempt]);

  return { ...state, retry };
}
