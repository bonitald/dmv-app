// ph-4-us-4: a saved attempt (users/{uid}/testAttempts/{testId}) turned into review items.
// Attempts are server-written but read defensively: old attempts (before ph-4-us-3) have no
// question text, and a malformed entry is dropped rather than breaking the review. No Firebase
// imports, so it runs under plain-Node Jest.

export type ReviewOutcome = 'right' | 'wrong' | 'skipped' | 'removed';

export interface ReviewItem {
  questionId: string;
  chunkId: string | null;
  /** Null when the question was removed, or the attempt predates ph-4-us-3. */
  text: string | null;
  choices: string[] | null;
  /** Unknown types (old attempts, removed questions) show as plain fact questions. */
  type: 'fact' | 'scenario';
  choice: string | null;
  correctAnswer: string | null;
  explanation: string | null;
  outcome: ReviewOutcome;
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function toItem(raw: unknown): ReviewItem | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const q = raw as Record<string, unknown>;
  if (typeof q.questionId !== 'string') return null;
  const choice = str(q.choice);
  const outcome: ReviewOutcome =
    q.unavailable === true
      ? 'removed'
      : q.correct === true
        ? 'right'
        : choice === null
          ? 'skipped'
          : 'wrong';
  return {
    questionId: q.questionId,
    chunkId: str(q.chunkId),
    text: str(q.text),
    choices:
      Array.isArray(q.choices) && q.choices.every((c) => typeof c === 'string')
        ? (q.choices as string[])
        : null,
    type: q.type === 'scenario' ? 'scenario' : 'fact',
    choice,
    correctAnswer: str(q.correctAnswer),
    explanation: str(q.explanation),
    outcome,
  };
}

/**
 * The questions to review, or null when there's no review to offer: a missing attempt, or a
 * baseline section before the last (answers withheld until the baseline is complete). The
 * final baseline section's `baselineReview` covers all 45 questions.
 */
export function toReviewItems(attempt: Record<string, unknown> | undefined): ReviewItem[] | null {
  if (!attempt) return null;
  const source = attempt.type === 'baseline' ? attempt.baselineReview : attempt.perQuestion;
  if (!Array.isArray(source)) return null;
  return source.map(toItem).filter((item): item is ReviewItem => item !== null);
}

/** Wrong or skipped. Removed questions aren't counted either way. */
export function isMissed(item: ReviewItem): boolean {
  return item.outcome === 'wrong' || item.outcome === 'skipped';
}

export function countMissed(items: ReviewItem[]): number {
  return items.filter(isMissed).length;
}
