import { BASELINE_TOTAL_SECTIONS } from '../baseline/baselineProgressData';
import type { ReviewItem } from '../review/reviewData';
import type { Topic } from '../topics/topicsData';
import { PASS_MARK } from './passMark';

// ph-4-us-6 (baseline results part): the score, how it tracks against the real test's mark,
// and Got it / Missed it per topic. One question per topic, so no "shaky" (prd.md Section 4).
// No Firebase imports, so it runs under plain-Node Jest.

export type TopicResult = 'got-it' | 'missed-it' | 'not-tested';

export interface TopicRow {
  chunkId: string;
  title: string;
  result: TopicResult;
}

export interface BaselineSummary {
  correctCount: number;
  /** Graded questions: removed (deleted) questions don't count. */
  totalCount: number;
  percent: number;
  /** On the raw ratio, so exactly 36 of 45 (80%) is at the mark. */
  atPassMark: boolean;
  /** Handbook order; topics missing from the catalog follow, in baseline order. */
  topics: TopicRow[];
  firstMissedChunkId: string | null;
}

export function summarizeBaseline(items: ReviewItem[], topics: Topic[]): BaselineSummary {
  const graded = items.filter((i) => i.outcome !== 'removed');
  const correctCount = graded.filter((i) => i.outcome === 'right').length;
  const totalCount = graded.length;
  const ratio = totalCount === 0 ? 0 : correctCount / totalCount;

  const resultByChunk = new Map<string, TopicResult>();
  for (const i of graded) {
    if (!i.chunkId) continue;
    // Several questions on one topic (not the case for v1): any miss makes it "missed it".
    if (resultByChunk.get(i.chunkId) === 'missed-it') continue;
    resultByChunk.set(i.chunkId, i.outcome === 'right' ? 'got-it' : 'missed-it');
  }

  const known = new Set(topics.map((t) => t.chunkId));
  const rows: TopicRow[] = [
    ...topics.map((t) => ({
      chunkId: t.chunkId,
      title: t.title,
      result: resultByChunk.get(t.chunkId) ?? ('not-tested' as const),
    })),
    // Without these, a failed topics read would leave the list empty.
    ...[...resultByChunk.entries()]
      .filter(([chunkId]) => !known.has(chunkId))
      .map(([chunkId, result]) => ({ chunkId, title: chunkId, result })),
  ];

  return {
    correctCount,
    totalCount,
    percent: Math.round(ratio * 100),
    atPassMark: totalCount > 0 && ratio >= PASS_MARK,
    topics: rows,
    firstMissedChunkId: rows.find((r) => r.result === 'missed-it')?.chunkId ?? null,
  };
}

/**
 * How the score tracks against the real test. Deliberately never says "pass" or "fail": the
 * baseline is one question per topic, not the real 25-question test.
 */
export function trackingLine(summary: BaselineSummary): string {
  const mark = `The real test needs ${Math.round(PASS_MARK * 100)}%.`;
  return summary.atPassMark
    ? `${mark} You're off to a strong start — practice tests will tell you when you're ready.`
    : `${mark} Here's where to focus first.`;
}

/** The final section's attempt holds `baselineReview` (see scoreTest in functions/README.md). */
export function finalBaselineTestId(version: string): string {
  return `baseline-${version}-${BASELINE_TOTAL_SECTIONS}`;
}
