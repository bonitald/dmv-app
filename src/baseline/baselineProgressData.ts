// ph-3-us-13: users/{uid}/baseline/progress as the app sees it. Written only by the
// startOrResumeBaseline and scoreTest functions; the client just reads it. No Firebase
// imports, so it runs under plain-Node Jest.

export const BASELINE_TOTAL_SECTIONS = 3;

export type BaselineProgress =
  | { status: 'loading' }
  /** The progress doc couldn't be read; the server (startOrResumeBaseline) decides instead. */
  | { status: 'error' }
  | { status: 'not-started' }
  | { status: 'in-progress'; currentSection: number; totalSections: number }
  | { status: 'complete' };

export function toBaselineProgress(data: Record<string, unknown> | undefined): BaselineProgress {
  if (!data) return { status: 'not-started' };
  if (data.completedAt) return { status: 'complete' };
  const section = data.currentSection;
  return {
    status: 'in-progress',
    currentSection:
      typeof section === 'number' && section >= 1 && section <= BASELINE_TOTAL_SECTIONS
        ? section
        : 1,
    totalSections: BASELINE_TOTAL_SECTIONS,
  };
}
