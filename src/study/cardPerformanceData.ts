import type { PerQuestionResult } from '../api/types';

// ph-2-us-6: what this phone remembers about each question from graded quizzes, so the
// flashcards can put missed cards first (ph-2-us-4) or show only them (Slice 4b). Local only.
// No Firebase or storage imports, so it runs under plain-Node Jest.

export interface CardHistory {
  graded: number;
  missed: number;
  /** Correct answers in a row, most recent last; a miss resets it. */
  correctStreak: number;
  lastCorrect: boolean;
}

export interface TopicHistory {
  cards: Record<string, CardHistory>;
  /** Questions missed (wrong or skipped) in this topic's most recent quiz. */
  lastQuizMissedIds: string[];
}

export const NO_HISTORY: TopicHistory = { cards: {}, lastQuizMissedIds: [] };

/** Graded results by topic. Removed questions and ungraded entries are left out, not misses. */
export function gradedByTopic(perQuestion: PerQuestionResult[]): Map<string, PerQuestionResult[]> {
  const out = new Map<string, PerQuestionResult[]>();
  for (const q of perQuestion) {
    if (q.unavailable || q.correct === null || !q.chunkId) continue;
    out.set(q.chunkId, [...(out.get(q.chunkId) ?? []), q]);
  }
  return out;
}

/** One quiz's graded results for one topic, added to that topic's history. */
export function applyQuizResults(history: TopicHistory, results: PerQuestionResult[]): TopicHistory {
  const cards = { ...history.cards };
  const missedIds: string[] = [];
  for (const q of results) {
    const correct = q.correct === true;
    const prev = cards[q.questionId] ?? { graded: 0, missed: 0, correctStreak: 0, lastCorrect: false };
    cards[q.questionId] = {
      graded: prev.graded + 1,
      missed: prev.missed + (correct ? 0 : 1),
      correctStreak: correct ? prev.correctStreak + 1 : 0,
      lastCorrect: correct,
    };
    if (!correct) missedIds.push(q.questionId);
  }
  return { cards, lastQuizMissedIds: missedIds };
}

function isCardHistory(value: unknown): value is CardHistory {
  const v = value as Record<string, unknown> | null;
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.graded === 'number' &&
    typeof v.missed === 'number' &&
    typeof v.correctStreak === 'number' &&
    typeof v.lastCorrect === 'boolean'
  );
}

/** Stored JSON back to history. Anything unreadable is dropped, never thrown. */
export function parseTopicHistory(raw: string | null): TopicHistory {
  if (!raw) return NO_HISTORY;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return NO_HISTORY;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return NO_HISTORY;
  const d = data as Record<string, unknown>;
  const cards: Record<string, CardHistory> = {};
  if (typeof d.cards === 'object' && d.cards !== null && !Array.isArray(d.cards)) {
    for (const [id, value] of Object.entries(d.cards)) {
      if (isCardHistory(value)) cards[id] = value;
    }
  }
  const missed = Array.isArray(d.lastQuizMissedIds)
    ? d.lastQuizMissedIds.filter((id): id is string => typeof id === 'string')
    : [];
  return { cards, lastQuizMissedIds: missed };
}

/** A question's history, or null when it has never been graded on this phone. */
export function cardHistory(history: TopicHistory, questionId: string): CardHistory | null {
  return history.cards[questionId] ?? null;
}
