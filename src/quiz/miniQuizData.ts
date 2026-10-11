import type { PerQuestionResult, ScoreTestResult } from '../api/types';
import { isMissed, toReviewItems, type ReviewItem } from '../review/reviewData';
import type { NextStepChoice } from '../study/conceptProgressData';
import type { Topic } from '../topics/topicsData';

// ph-2-us-8 / ph-2-us-9: the mini-quiz's logic outside the screen: its graded outcome (from
// scoreTest, or from the saved attempt when it was already graded), the results copy, the
// previous quiz per topic for excludeIds, and where "Come Back Later" goes. No Firebase
// imports, so it runs under plain-Node Jest.

export type Recommendation = 'move-on' | 'review-again';

export interface MiniQuizOutcome {
  testId: string;
  correctCount: number;
  totalCount: number;
  score: number;
  recommendation: Recommendation;
  /** Wrong or skipped, in quiz order. */
  missed: ReviewItem[];
  /** Raw results, for recording card performance (ph-2-us-6). */
  perQuestion: PerQuestionResult[];
}

/** Client copy of scoreTest's MINI_QUIZ_PASS_THRESHOLD, used only if a result lacks one. */
export const MINI_QUIZ_PASS_THRESHOLD = 0.8;

function outcome(
  testId: string,
  score: number,
  correctCount: number,
  totalCount: number,
  recommendation: unknown,
  perQuestion: PerQuestionResult[]
): MiniQuizOutcome {
  const items = toReviewItems({ type: 'mini-quiz', perQuestion } as Record<string, unknown>) ?? [];
  return {
    testId,
    score,
    correctCount,
    totalCount,
    recommendation:
      recommendation === 'move-on' || recommendation === 'review-again'
        ? recommendation
        : score >= MINI_QUIZ_PASS_THRESHOLD
          ? 'move-on'
          : 'review-again',
    missed: items.filter(isMissed),
    perQuestion,
  };
}

export function fromScoreResult(result: ScoreTestResult): MiniQuizOutcome {
  return outcome(result.testId, result.score, result.correctCount, result.totalCount, result.recommendation, result.perQuestion);
}

/** A saved attempt (users/{uid}/testAttempts/{testId}), or null if it isn't a usable one. */
export function fromAttempt(testId: string, data: Record<string, unknown> | undefined): MiniQuizOutcome | null {
  if (
    !data ||
    typeof data.score !== 'number' ||
    typeof data.correctCount !== 'number' ||
    typeof data.totalCount !== 'number' ||
    !Array.isArray(data.perQuestion)
  ) {
    return null;
  }
  return outcome(testId, data.score, data.correctCount, data.totalCount, data.recommendation, data.perQuestion as PerQuestionResult[]);
}

export function scoreLine(o: MiniQuizOutcome): string {
  return `${o.correctCount} of ${o.totalCount} · ${Math.round(o.score * 100)}%`;
}

export function recommendationLine(r: Recommendation): string {
  return r === 'move-on' ? "You've got this one — ready to move on." : 'Worth another look before moving on.';
}

/** The choice the recommendation highlights. The others stay available (prd.md: not a gate). */
export function recommendedChoice(r: Recommendation): NextStepChoice {
  return r === 'move-on' ? 'mark-reviewed' : 'review-again';
}

// In memory only: a retake in this session avoids the previous set (ph-2-us-8).
const lastQuiz = new Map<string, string[]>();

export function rememberQuiz(chunkId: string, questionIds: string[]): void {
  lastQuiz.set(chunkId, questionIds);
}

export function lastQuizIds(chunkId: string): string[] {
  return lastQuiz.get(chunkId) ?? [];
}

/** The next topic in handbook order that has approved questions, or null after the last one. */
export function nextTopicId(topics: Topic[], chunkId: string): string | null {
  const at = topics.findIndex((t) => t.chunkId === chunkId);
  if (at === -1) return null;
  return topics.slice(at + 1).find((t) => t.approvedQuestionCount > 0)?.chunkId ?? null;
}

export interface RouteLike {
  name: string;
  key?: string;
  params?: object;
}

/**
 * The root stack after "Come Back Later": the trailing Flashcards and MiniQuiz of the finished
 * topic are replaced by the next topic's Flashcards, so Back goes where the topic was opened from.
 */
export function routesForNextTopic<R extends RouteLike>(routes: R[], nextChunkId: string): RouteLike[] {
  let end = routes.length;
  while (end > 0 && (routes[end - 1].name === 'MiniQuiz' || routes[end - 1].name === 'Flashcards')) end--;
  return [...routes.slice(0, end), { name: 'Flashcards', params: { chunkId: nextChunkId } }];
}
