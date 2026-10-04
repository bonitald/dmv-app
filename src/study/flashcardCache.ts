import type { Flashcard } from '../api/types';

// ph-2-us-3: decks loaded this app session, by chunkId. Reopening a topic (or Review Again,
// ph-2-us-9) reads from here instead of calling getFlashcards again, so it doesn't use up the
// rate limit, and a loaded topic keeps working offline. Memory only: the answer key is never
// stored on the device (ph-1-us-10).
const decks = new Map<string, Flashcard[]>();

export function getCachedDeck(chunkId: string): Flashcard[] | undefined {
  return decks.get(chunkId);
}

export function cacheDeck(chunkId: string, cards: Flashcard[]): void {
  decks.set(chunkId, cards);
}

/** For tests now, and for sign-out once Slice 6 adds it. */
export function clearDeckCache(): void {
  decks.clear();
}
