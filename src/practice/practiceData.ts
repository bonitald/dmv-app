import type { AttemptTiming, PerTopicResult, ScoreTestResult } from '../api/types';
import { PASS_MARK } from '../results/passMark';
import type { Topic } from '../topics/topicsData';
import { isTimedOut } from './timing';

// ph-4-us-1 / ph-4-us-6 (practice part): a finished practice test as one shape (fresh from
// scoreTest or read back from a saved attempt), the pass line against the real test's mark,
// and the topics to work on. Never says "fail". No Firebase imports, so it runs under
// plain-Node Jest.

export const RECENT_PRACTICE_LIMIT = 10;
export const TOPICS_TO_WORK_ON_LIMIT = 5;

export interface PracticeOutcome {
  testId: string;
  /** Null for a result fresh from scoreTest (not yet read back from Firestore). */
  createdAt: Date | null;
  correctCount: number;
  totalCount: number;
  perTopic: PerTopicResult[];
  /** Questions removed from the bank since the test was built; they aren't scored. */
  unavailableCount: number;
  /** The saved timing, or null for a test saved without one (or before timing existed). */
  timing: AttemptTiming | null;
  /** Questions the taker left without a choice (removed questions don't count). */
  unansweredCount: number;
}

function countUnavailable(perQuestion: unknown): number {
  if (!Array.isArray(perQuestion)) return 0;
  return perQuestion.filter((q) => (q as { unavailable?: unknown } | null)?.unavailable === true)
    .length;
}

function countUnanswered(perQuestion: unknown): number {
  if (!Array.isArray(perQuestion)) return 0;
  return perQuestion.filter((q) => {
    const item = q as { choice?: unknown; unavailable?: unknown } | null;
    return item?.choice === null && item?.unavailable !== true;
  }).length;
}

/** A saved timing is read only when it has a valid mode; anything else reads as no timing. */
function readTiming(raw: unknown): AttemptTiming | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as { mode?: unknown; timeLimitSec?: unknown; elapsedSec?: unknown };
  if (t.mode !== 'timed' && t.mode !== 'untimed') return null;
  return {
    mode: t.mode,
    ...(typeof t.timeLimitSec === 'number' ? { timeLimitSec: t.timeLimitSec } : {}),
    elapsedSec: typeof t.elapsedSec === 'number' ? t.elapsedSec : null,
  };
}

export function fromPracticeScore(result: ScoreTestResult): PracticeOutcome {
  return {
    testId: result.testId,
    createdAt: null,
    correctCount: result.correctCount,
    totalCount: result.totalCount,
    perTopic: result.perTopic,
    unavailableCount: countUnavailable(result.perQuestion),
    timing: result.timing ?? null,
    unansweredCount: countUnanswered(result.perQuestion),
  };
}

export function fromPracticeAttempt(
  testId: string,
  data: Record<string, unknown> | undefined,
): PracticeOutcome | null {
  if (!data || data.type !== 'practice') return null;
  const { correctCount, totalCount, perTopic } = data;
  if (typeof correctCount !== 'number' || typeof totalCount !== 'number') return null;
  if (!Array.isArray(perTopic)) return null;
  const createdAt = (data.createdAt as { toDate?: () => Date } | undefined)?.toDate?.() ?? null;
  return {
    testId,
    createdAt,
    correctCount,
    totalCount,
    perTopic: perTopic as PerTopicResult[],
    unavailableCount: countUnavailable(data.perQuestion),
    timing: readTiming(data.timing),
    unansweredCount: countUnanswered(data.perQuestion),
  };
}

/** The epsilon keeps float noise (0.8 * 25) from rounding a whole number up. */
export function neededToPass(totalCount: number): number {
  return Math.max(0, Math.ceil(PASS_MARK * totalCount - 1e-9));
}

export function passed(o: Pick<PracticeOutcome, 'correctCount' | 'totalCount'>): boolean {
  return o.correctCount >= neededToPass(o.totalCount);
}

export function scoreLine(o: PracticeOutcome): string {
  return `${o.correctCount} of ${o.totalCount} correct`;
}

export function percentLine(o: PracticeOutcome): string {
  const p = o.totalCount === 0 ? 0 : Math.round((o.correctCount / o.totalCount) * 100);
  return `${p}%`;
}

export function passLine(o: PracticeOutcome): string {
  const needed = neededToPass(o.totalCount);
  if (passed(o)) return `You'd pass the real test. It needs ${needed} of ${o.totalCount}.`;
  const k = needed - o.correctCount;
  return `${k} more right ${k === 1 ? 'answer' : 'answers'} to pass (${needed} of ${o.totalCount} needed). Every test helps.`;
}

export function leftOutLine(o: PracticeOutcome): string | null {
  const n = o.unavailableCount;
  if (n <= 0) return null;
  return `${n} ${n === 1 ? 'question was' : 'questions were'} removed from the bank, so this test is scored out of ${o.totalCount}.`;
}

/** Shown only for a timed test that used its whole limit; null otherwise. */
export function timedOutLine(o: PracticeOutcome): string | null {
  if (!isTimedOut(o.timing)) return null;
  const n = o.unansweredCount;
  if (n === 0) return 'Time ran out — you answered every question.';
  return `Time ran out — ${n} ${n === 1 ? 'question' : 'questions'} unanswered.`;
}

export interface TopicToWorkOn {
  chunkId: string;
  title: string;
  missed: number;
}

/**
 * Most-missed first, ties in handbook order. Topics missing from the catalog (still loading or
 * failed to load) are kept, titled by their chunkId, after the known ones (misses, then chunkId),
 * so a miss is never hidden. Topics with no misses are left out.
 */
export function topicsToWorkOn(
  perTopic: PerTopicResult[],
  topics: Topic[],
  limit: number = TOPICS_TO_WORK_ON_LIMIT,
): { shown: TopicToWorkOn[]; moreCount: number } {
  const byChunk = new Map(topics.map((t) => [t.chunkId, t]));
  const rows = perTopic
    .map((p) => ({ chunkId: p.chunkId, topic: byChunk.get(p.chunkId), missed: p.total - p.correct }))
    .filter((r) => r.missed > 0)
    .sort((a, b) => {
      if (a.topic && b.topic) return b.missed - a.missed || a.topic.order - b.topic.order;
      if (a.topic) return -1;
      if (b.topic) return 1;
      return b.missed - a.missed || (a.chunkId < b.chunkId ? -1 : a.chunkId > b.chunkId ? 1 : 0);
    })
    .map((r) => ({ chunkId: r.chunkId, title: r.topic?.title ?? r.chunkId, missed: r.missed }));
  return { shown: rows.slice(0, limit), moreCount: Math.max(0, rows.length - limit) };
}

export function sumPracticeEvidence(
  outcomes: PracticeOutcome[],
): Map<string, { correct: number; total: number }> {
  const sums = new Map<string, { correct: number; total: number }>();
  for (const o of outcomes) {
    for (const t of o.perTopic) {
      const cur = sums.get(t.chunkId) ?? { correct: 0, total: 0 };
      cur.correct += t.correct;
      cur.total += t.total;
      sums.set(t.chunkId, cur);
    }
  }
  return sums;
}

export function attemptDateLabel(date: Date | null): string {
  if (!date) return 'Just now';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
