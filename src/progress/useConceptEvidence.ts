import { useMemo } from 'react';
import { useBaselineProgress } from '../baseline/useBaselineProgress';
import { finalBaselineTestId, summarizeBaseline } from '../results/baselineResultsData';
import { toReviewItems } from '../review/reviewData';
import { useTestAttempt } from '../review/useTestAttempt';
import { useConceptProgress } from '../study/useConceptProgress';
import { useTopics } from '../topics/useTopics';
import { toReportRows, type ReportRow } from './conceptStrength';

// ph-4-us-6: everything the concept report needs, combined: topics (titles, order), live
// Concept Progress (mini-quiz scores) and the final baseline attempt (one question per topic).
// Practice-test evidence joins in Slice 5a. A baseline that can't be read leaves its rows
// "not tested" with a flag for the screen to say so, rather than blocking the report.
export type EvidenceState =
  | { status: 'loading' }
  | { status: 'topics-error'; retry: () => void }
  | { status: 'ready'; rows: ReportRow[]; baselineError: boolean; retryBaseline: () => void };

export function useConceptEvidence(): EvidenceState {
  const topics = useTopics();
  const progress = useConceptProgress();
  const baseline = useBaselineProgress();
  const attempt = useTestAttempt(baseline.status === 'complete' ? finalBaselineTestId(baseline.version) : null);

  const baselineLoading = baseline.status === 'loading' || (baseline.status === 'complete' && attempt.status === 'loading');
  const baselineError = baseline.status === 'error' || (baseline.status === 'complete' && attempt.status === 'error');
  const attemptData = attempt.status === 'ready' ? attempt.data : undefined;

  const rows = useMemo(() => {
    if (topics.status !== 'ready') return [];
    const results = new Map<string, 'got-it' | 'missed-it'>();
    const items = baseline.status === 'complete' ? toReviewItems(attemptData) : null;
    if (items) {
      for (const row of summarizeBaseline(items, topics.topics).topics) {
        if (row.result !== 'not-tested') results.set(row.chunkId, row.result);
      }
    }
    return toReportRows(topics.topics, progress.status === 'ready' ? progress.byChunk : {}, results);
  }, [topics, progress, baseline.status, attemptData]);

  if (topics.status === 'error') return { status: 'topics-error', retry: topics.retry };
  if (topics.status === 'loading' || progress.status === 'loading' || baselineLoading) return { status: 'loading' };
  return { status: 'ready', rows, baselineError, retryBaseline: attempt.retry };
}
