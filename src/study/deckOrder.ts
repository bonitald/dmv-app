import { cardHistory, type CardHistory, type TopicHistory } from './cardPerformanceData';

// ph-2-us-4 (Slice 4b): the order a pass through a topic's flashcards takes. A `full` pass is
// every card once, with cards missed in quizzes tending to come first (a weighted shuffle, not
// a spaced-repetition schedule). A `missed-only` pass is just the cards missed in the topic's
// last quiz (Review Again, or reopening a "needs revisit" topic). Pure, so it runs under Node.

export type PassMode = 'missed-only' | 'full';

/** A pass saved on the phone so reopening the topic resumes the same sequence. */
export interface SavedPass {
  mode: PassMode;
  cardIds: string[];
  /** The card showing when it was saved. */
  cardId: string;
}

/** A card missed before and not yet right this many times in a row is boosted. */
export const LEARNED_STREAK = 2;
export const WEAK_WEIGHT = 3;

export function cardWeight(history: CardHistory | null): number {
  if (!history) return 1; // never graded: neutral, not "known well"
  return history.missed > 0 && history.correctStreak < LEARNED_STREAK ? WEAK_WEIGHT : 1;
}

/**
 * Weighted random order (Efraimidis–Spirakis): each item gets key random^(1/weight) and the
 * highest keys come first, so heavier items tend to be earlier. Ties keep input order.
 */
export function weightedShuffle<T>(
  items: readonly T[],
  weight: (item: T) => number,
  random: () => number = Math.random
): T[] {
  return items
    .map((item, i) => ({ item, i, key: random() ** (1 / weight(item)) }))
    .sort((a, b) => b.key - a.key || a.i - b.i)
    .map(({ item }) => item);
}

export function buildPass<T extends { id: string }>(
  cards: readonly T[],
  history: TopicHistory,
  mode: PassMode,
  random: () => number = Math.random
): { mode: PassMode; cards: T[] } {
  const byWeight = (c: T) => cardWeight(cardHistory(history, c.id));
  if (mode === 'missed-only') {
    const missed = new Set(history.lastQuizMissedIds);
    const only = cards.filter((c) => missed.has(c.id));
    if (only.length > 0) return { mode, cards: weightedShuffle(only, () => 1, random) };
  }
  return { mode: 'full', cards: weightedShuffle(cards, byWeight, random) };
}

export function restorePass<T extends { id: string }>(
  cards: readonly T[],
  saved: SavedPass
): { mode: PassMode; cards: T[]; index: number } | null {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const kept = saved.cardIds.map((id) => byId.get(id)).filter((c): c is T => c !== undefined);
  if (kept.length === 0) return null;
  // A full pass promises every card: cards added since it was saved go at the end.
  const keptIds = new Set(kept.map((c) => c.id));
  const ordered = saved.mode === 'full' ? [...kept, ...cards.filter((c) => !keptIds.has(c.id))] : kept;
  return { mode: saved.mode, cards: ordered, index: Math.max(0, ordered.findIndex((c) => c.id === saved.cardId)) };
}

/** Stored JSON back to a pass. A 4a plain card id, corrupt or malformed value reads as none. */
export function parseSavedPass(raw: string | null): SavedPass | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Record<string, unknown>;
    if (
      (d.mode === 'full' || d.mode === 'missed-only') &&
      Array.isArray(d.cardIds) &&
      d.cardIds.every((id) => typeof id === 'string') &&
      typeof d.cardId === 'string'
    ) {
      return { mode: d.mode, cardIds: d.cardIds as string[], cardId: d.cardId };
    }
  } catch {
    // fall through
  }
  return null;
}
