import type { Topic } from '../topics/topicsData';
import { lastQuizNotPassed, progressFor, type ConceptProgress, type ConceptStatus, type ProgressMap } from './conceptProgressData';

// ph-2-us-7: the concept list's rows: every topic in handbook order (toTopics already sorts),
// with the user's status and latest quiz score. No Firebase imports.

export interface ConceptRow {
  chunkId: string;
  title: string;
  description: string;
  status: ConceptStatus;
  /** The latest mini-quiz is below the pass mark (whatever the status). */
  lastQuizNotPassed: boolean;
  /** "Quizzes: ..." counts line, or "Latest quiz: N%" for older records; null if never taken. */
  quizLine: string | null;
  /** No approved questions yet: shown, but not opened (ph-2-us-7). */
  comingSoon: boolean;
}

export const STATUS_LABEL: Record<ConceptStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  reviewed: 'Reviewed',
  'needs-revisit': 'Needs revisit',
};

export function quizLine(p: ConceptProgress): string | null {
  const parts: string[] = [];
  if (p.miniQuizPassCount !== undefined && p.miniQuizPassCount > 0) parts.push(`${p.miniQuizPassCount} passed`);
  if (p.miniQuizFailCount !== undefined && p.miniQuizFailCount > 0) parts.push(`${p.miniQuizFailCount} not passed`);
  if (typeof p.latestMiniQuizCorrect === 'number' && typeof p.latestMiniQuizTotal === 'number') {
    parts.push(`latest ${p.latestMiniQuizCorrect} of ${p.latestMiniQuizTotal}`);
  }
  if (parts.length > 0) return `Quizzes: ${parts.join(' · ')}`;
  if (typeof p.latestMiniQuizScore === 'number') return `Latest quiz: ${Math.round(p.latestMiniQuizScore * 100)}%`;
  return null;
}

export function toConceptRows(topics: Topic[], progress: ProgressMap): ConceptRow[] {
  return topics.map((topic) => {
    const p = progressFor(progress, topic.chunkId);
    return {
      chunkId: topic.chunkId,
      title: topic.title,
      description: topic.description,
      status: p.status,
      lastQuizNotPassed: lastQuizNotPassed(p),
      quizLine: quizLine(p),
      comingSoon: topic.approvedQuestionCount === 0,
    };
  });
}
