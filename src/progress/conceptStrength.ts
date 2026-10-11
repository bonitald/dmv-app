import { progressFor, type ProgressMap } from '../study/conceptProgressData';
import type { Topic } from '../topics/topicsData';

// ph-4-us-6: how well each topic is known, from answers (not the user's own status). The one
// place the strength rule lives: the latest mini-quiz, else enough practice answers, else the
// one baseline question, else not tested. Always shown as a rough guide. Pure, so it runs
// under Node.

export type Strength = 'strong' | 'shaky' | 'likely-gap' | 'got-it' | 'missed-it' | 'not-tested';
export type StrengthSource = 'mini-quiz' | 'practice' | 'baseline' | 'none';

export interface ConceptEvidence {
  miniQuiz?: { score: number; correct?: number; total?: number };
  /** Practice-test answers on this topic. Filled from Slice 5a. */
  practice?: { correct: number; total: number };
  baseline?: 'got-it' | 'missed-it';
}

export interface StrengthResult {
  strength: Strength;
  source: StrengthSource;
  correct?: number;
  total?: number;
  /** Whole percent, for mini-quiz scores saved without counts. */
  percent?: number;
}

export const STRONG_AT = 0.8; // matches the real test's pass mark
export const SHAKY_AT = 0.5;
export const MIN_PRACTICE_ANSWERS = 3;

export const STRENGTH_LABEL: Record<Strength, string> = {
  strong: 'Strong',
  shaky: 'Shaky',
  'likely-gap': 'Likely gap',
  'got-it': 'Got it',
  'missed-it': 'Missed it',
  'not-tested': 'Not tested yet',
};

function band(ratio: number): Strength {
  return ratio >= STRONG_AT ? 'strong' : ratio >= SHAKY_AT ? 'shaky' : 'likely-gap';
}

export function conceptStrength(e: ConceptEvidence): StrengthResult {
  if (e.miniQuiz) {
    const { score, correct, total } = e.miniQuiz;
    return correct !== undefined && total !== undefined
      ? { strength: band(score), source: 'mini-quiz', correct, total }
      : { strength: band(score), source: 'mini-quiz', percent: Math.round(score * 100) };
  }
  if (e.practice && e.practice.total >= MIN_PRACTICE_ANSWERS) {
    const { correct, total } = e.practice;
    return { strength: band(correct / total), source: 'practice', correct, total };
  }
  if (e.baseline) return { strength: e.baseline, source: 'baseline' };
  return { strength: 'not-tested', source: 'none' };
}

export function basisLine(r: StrengthResult): string {
  switch (r.source) {
    case 'mini-quiz':
      return r.correct !== undefined && r.total !== undefined
        ? `${r.correct} of ${r.total} right in your latest quiz`
        : `${r.percent}% in your latest quiz`;
    case 'practice':
      return `${r.correct} of ${r.total} right in practice tests`;
    case 'baseline':
      return 'From 1 baseline question';
    case 'none':
      return 'Not tested yet';
  }
}

export interface ReportRow {
  chunkId: string;
  title: string;
  comingSoon: boolean;
  result: StrengthResult;
}

export type ReportSort = 'handbook' | 'needs-work';

export function toReportRows(
  topics: Topic[],
  progress: ProgressMap,
  baseline: Map<string, 'got-it' | 'missed-it'>
): ReportRow[] {
  return topics.map((t) => {
    const p = progressFor(progress, t.chunkId);
    const evidence: ConceptEvidence = {
      ...(p.latestMiniQuizScore !== undefined
        ? { miniQuiz: { score: p.latestMiniQuizScore, correct: p.latestMiniQuizCorrect, total: p.latestMiniQuizTotal } }
        : {}),
      ...(baseline.has(t.chunkId) ? { baseline: baseline.get(t.chunkId) } : {}),
    };
    return { chunkId: t.chunkId, title: t.title, comingSoon: t.approvedQuestionCount === 0, result: conceptStrength(evidence) };
  });
}

const NEEDS_WORK_RANK: Record<Strength, number> = {
  'likely-gap': 0,
  'missed-it': 0,
  shaky: 1,
  'not-tested': 2,
  strong: 3,
  'got-it': 3,
};

/** Rows arrive in handbook order; the sort is stable, so that order holds within a group. */
export function sortRows(rows: ReportRow[], sort: ReportSort): ReportRow[] {
  if (sort === 'handbook') return rows;
  return [...rows].sort((a, b) => NEEDS_WORK_RANK[a.result.strength] - NEEDS_WORK_RANK[b.result.strength]);
}

export function hasEvidence(rows: ReportRow[]): boolean {
  return rows.some((r) => r.result.source !== 'none');
}
