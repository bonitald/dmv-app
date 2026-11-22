import { useMemo } from 'react';
import { useBaselineProgress } from '../baseline/useBaselineProgress';
import { finalBaselineTestId, summarizeBaseline } from '../results/baselineResultsData';
import { toReviewItems } from '../review/reviewData';
import { useTestAttempt } from '../review/useTestAttempt';

// ph-4-us-7: the baseline's percent (correct / graded of 45), from the final section's attempt,
// with the states the comparison needs. `unknown`: the baseline is done but its attempt can't be
// read (e.g. offline, nothing cached), so comparisons just hide.
export type BaselineScoreState =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'in-progress' }
  | { status: 'ready'; percent: number }
  | { status: 'unknown' };

export function useBaselineScore(): BaselineScoreState {
  const progress = useBaselineProgress();
  const attempt = useTestAttempt(progress.status === 'complete' ? finalBaselineTestId(progress.version) : null);
  const data = attempt.status === 'ready' ? attempt.data : undefined;

  return useMemo((): BaselineScoreState => {
    if (progress.status === 'loading') return { status: 'loading' };
    if (progress.status === 'not-started') return { status: 'none' };
    if (progress.status === 'in-progress') return { status: 'in-progress' };
    if (progress.status === 'error') return { status: 'unknown' };
    if (attempt.status === 'loading') return { status: 'loading' };
    const items = attempt.status === 'ready' ? toReviewItems(data) : null;
    if (!items || items.length === 0) return { status: 'unknown' };
    const summary = summarizeBaseline(items, []);
    return summary.totalCount > 0 ? { status: 'ready', percent: summary.percent } : { status: 'unknown' };
  }, [progress.status, attempt.status, data]);
}
