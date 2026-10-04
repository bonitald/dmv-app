import type { CallableErrorKind } from '../api/callableErrors';

// ph-2-us-3: the flashcard viewer's logic, kept pure so it runs under plain-Node Jest.
// `index === cards.length` is the end-of-deck screen.

export interface DeckState<T> {
  cards: T[];
  index: number;
}

export type DeckAction<T> = { type: 'next' } | { type: 'previous' } | { type: 'restart'; cards: T[] };

export function deckReducer<T>(state: DeckState<T>, action: DeckAction<T>): DeckState<T> {
  switch (action.type) {
    case 'next':
      return { ...state, index: Math.min(state.index + 1, state.cards.length) };
    case 'previous':
      return { ...state, index: Math.max(state.index - 1, 0) };
    case 'restart':
      return { cards: action.cards, index: 0 };
  }
}

/** Fisher–Yates on a copy. "Start this concept over" uses it until ph-2-us-4 orders by misses. */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** How far a swipe must travel to change card. */
export const SWIPE_DISTANCE = 50;

/** Clearly sideways, so the swipe can take the gesture from a long card's vertical scroll. */
export function isHorizontalDrag(dx: number, dy: number): boolean {
  return Math.abs(dx) > 10 && Math.abs(dx) > 2 * Math.abs(dy);
}

export function swipeDirection(dx: number, dy: number): 'next' | 'previous' | null {
  if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < 2 * Math.abs(dy)) return null;
  return dx < 0 ? 'next' : 'previous';
}

export type DeckError = 'empty' | 'rate-limited' | 'offline' | 'error';

/** getFlashcards failures as the viewer shows them (ph-2-us-3 error states). */
export function toDeckError(kind: CallableErrorKind): DeckError {
  switch (kind) {
    case 'not-found':
      return 'empty';
    case 'resource-exhausted':
      return 'rate-limited';
    case 'offline':
      return 'offline';
    default:
      return 'error';
  }
}
