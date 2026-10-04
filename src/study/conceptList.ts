import type { Topic } from '../topics/topicsData';
import { progressFor, type ConceptStatus, type ProgressMap } from './conceptProgressData';

// ph-2-us-7: the concept list's rows: every topic in handbook order (toTopics already sorts),
// with the user's status and latest quiz score. No Firebase imports.

export interface ConceptRow {
  chunkId: string;
  title: string;
  description: string;
  status: ConceptStatus;
  /** Latest mini-quiz score as a whole percent, or null if never taken. */
  scorePercent: number | null;
  /** No approved questions yet: shown, but not opened (ph-2-us-7). */
  comingSoon: boolean;
}

export const STATUS_LABEL: Record<ConceptStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  reviewed: 'Reviewed',
  'needs-revisit': 'Needs revisit',
};

export function toConceptRows(topics: Topic[], progress: ProgressMap): ConceptRow[] {
  return topics.map((topic) => {
    const { status, latestMiniQuizScore } = progressFor(progress, topic.chunkId);
    return {
      chunkId: topic.chunkId,
      title: topic.title,
      description: topic.description,
      status,
      scorePercent: latestMiniQuizScore === undefined ? null : Math.round(latestMiniQuizScore * 100),
      comingSoon: topic.approvedQuestionCount === 0,
    };
  });
}
