import type { Topic } from '../topics/topicsData';
import { isMissed, toReviewItem, type ReviewItem } from './reviewData';

// ph-4-us-5 (Slice 5b-2): the questions whose latest graded result is a miss, across practice
// tests, mini-quizzes and the completed baseline, from the user's recent attempts. A question
// answered right later drops off. No Firebase imports, so it runs under plain-Node Jest.

/** One `users/{uid}/testAttempts` doc. `createdAtMs` is null while the server time is pending. */
export interface AttemptDoc {
  testId: string;
  createdAtMs: number | null;
  data: Record<string, unknown>;
}

export interface MissedQuestion {
  questionId: string;
  chunkId: string | null;
  /** The attempt holding the latest (missed) result, to open in Review. */
  testId: string;
  item: ReviewItem;
}

export interface MissedGroup {
  /** Null for questions with no topic. */
  chunkId: string | null;
  title: string;
  questions: MissedQuestion[];
}

/**
 * The graded entries of one attempt. A baseline counts only through its final section's
 * `baselineReview` (all 45); earlier sections have answers withheld. Removed questions and
 * entries with no right/wrong yet are left out: they neither add a miss nor clear one.
 */
function gradedEntries(data: Record<string, unknown>): unknown[] {
  const source = data.type === 'baseline' ? data.baselineReview : data.perQuestion;
  if (!Array.isArray(source)) return [];
  return source.filter((raw) => {
    const q = raw as { unavailable?: unknown; correct?: unknown } | null;
    return typeof q === 'object' && q !== null && q.unavailable !== true && typeof q.correct === 'boolean';
  });
}

export function latestMisses(attempts: AttemptDoc[]): MissedQuestion[] {
  // Newest first; a pending server time means "just now".
  const newestFirst = [...attempts].sort(
    (a, b) => (b.createdAtMs ?? Number.POSITIVE_INFINITY) - (a.createdAtMs ?? Number.POSITIVE_INFINITY)
  );
  const seen = new Set<string>();
  const misses: MissedQuestion[] = [];
  for (const attempt of newestFirst) {
    for (const raw of gradedEntries(attempt.data)) {
      const item = toReviewItem(raw);
      if (!item || seen.has(item.questionId)) continue;
      seen.add(item.questionId);
      if (isMissed(item)) {
        misses.push({ questionId: item.questionId, chunkId: item.chunkId, testId: attempt.testId, item });
      }
    }
  }
  return misses;
}

/** Handbook order (the catalog's order); topics missing from it follow, then "Other". */
export function groupByTopic(misses: MissedQuestion[], topics: Topic[]): MissedGroup[] {
  const byChunk = new Map<string | null, MissedQuestion[]>();
  for (const m of misses) byChunk.set(m.chunkId, [...(byChunk.get(m.chunkId) ?? []), m]);
  const groups: MissedGroup[] = [];
  for (const t of topics) {
    const questions = byChunk.get(t.chunkId);
    if (questions) groups.push({ chunkId: t.chunkId, title: t.title, questions });
    byChunk.delete(t.chunkId);
  }
  for (const [chunkId, questions] of byChunk) {
    if (chunkId !== null) groups.push({ chunkId, title: chunkId, questions });
  }
  const other = byChunk.get(null);
  if (other) groups.push({ chunkId: null, title: 'Other', questions: other });
  return groups;
}
