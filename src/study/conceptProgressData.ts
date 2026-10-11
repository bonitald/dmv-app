// ph-2-us-10 / ph-2-us-12: Concept Progress as the app sees it, and the one place the status
// transitions table on ph-2-us-10 is applied. No Firebase imports, so it runs under plain-Node
// Jest.

export type ConceptStatus = 'not-started' | 'in-progress' | 'reviewed' | 'needs-revisit';
/** The statuses a client may store; `not-started` is the absence of a doc. */
export type StoredStatus = Exclude<ConceptStatus, 'not-started'>;

export interface ConceptProgress {
  status: ConceptStatus;
  /** 0–1, written only by scoreTest (ph-2-us-11). */
  latestMiniQuizScore?: number;
  /** Right answers and questions in that quiz (Slice 4b). Missing on older records. */
  latestMiniQuizCorrect?: number;
  latestMiniQuizTotal?: number;
  latestMiniQuizAt?: Date;
  /** Quizzes passed (>= 80%) and not passed on this topic; written only by scoreTest. Absent until first counted. */
  miniQuizPassCount?: number;
  miniQuizFailCount?: number;
}

export type ProgressMap = Record<string, ConceptProgress>;

/** The three choices on the post-quiz recommendation screen (ph-2-us-9). */
export type NextStepChoice = 'review-again' | 'come-back-later' | 'mark-reviewed';

const STORED: readonly string[] = ['in-progress', 'reviewed', 'needs-revisit'];

function toDate(value: unknown): Date | undefined {
  // Firestore Timestamps have toDate(). A server timestamp still pending reads as null.
  const maybe = value as { toDate?: () => Date } | null | undefined;
  return typeof maybe?.toDate === 'function' ? maybe.toDate() : undefined;
}

export function toProgress(data: Record<string, unknown> | undefined): ConceptProgress {
  if (!data) return { status: 'not-started' };
  const score = typeof data.latestMiniQuizScore === 'number' ? data.latestMiniQuizScore : undefined;
  const at = toDate(data.latestMiniQuizAt);
  const correct = typeof data.latestMiniQuizCorrect === 'number' ? data.latestMiniQuizCorrect : undefined;
  const total = typeof data.latestMiniQuizTotal === 'number' ? data.latestMiniQuizTotal : undefined;
  const passCount = typeof data.miniQuizPassCount === 'number' ? data.miniQuizPassCount : undefined;
  const failCount = typeof data.miniQuizFailCount === 'number' ? data.miniQuizFailCount : undefined;
  // A doc scoreTest created before the topic was ever opened has a score but no status.
  const status: ConceptStatus =
    typeof data.status === 'string' && STORED.includes(data.status)
      ? (data.status as StoredStatus)
      : score !== undefined
        ? 'in-progress'
        : 'not-started';
  return {
    status,
    ...(score !== undefined ? { latestMiniQuizScore: score } : {}),
    ...(correct !== undefined ? { latestMiniQuizCorrect: correct } : {}),
    ...(total !== undefined ? { latestMiniQuizTotal: total } : {}),
    ...(at ? { latestMiniQuizAt: at } : {}),
    ...(passCount !== undefined ? { miniQuizPassCount: passCount } : {}),
    ...(failCount !== undefined ? { miniQuizFailCount: failCount } : {}),
  };
}

export function progressFor(map: ProgressMap, chunkId: string): ConceptProgress {
  return map[chunkId] ?? { status: 'not-started' };
}

export function statusForChoice(choice: NextStepChoice): StoredStatus {
  switch (choice) {
    case 'review-again':
      return 'in-progress';
    case 'come-back-later':
      return 'needs-revisit';
    case 'mark-reviewed':
      return 'reviewed';
  }
}

/** The status to write for an event, or null to write nothing. */
export function nextStatus(
  current: ConceptStatus,
  event: 'opened' | NextStepChoice
): StoredStatus | null {
  if (event === 'opened') return current === 'not-started' ? 'in-progress' : null;
  return statusForChoice(event);
}
