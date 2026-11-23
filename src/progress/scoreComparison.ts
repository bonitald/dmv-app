// ph-4-us-7 (Slice 5b-2): a practice score next to the baseline, in whole percentage points. The
// two use different questions (45 fixed vs 25 random), so it's a rough guide, and a lower score
// is worded to encourage, never as "worse". No Firebase imports, so it runs under plain-Node Jest.

export interface Comparison {
  baselinePercent: number;
  practicePercent: number;
  /** practicePercent − baselinePercent. */
  change: number;
}

export function compareToBaseline(baselinePercent: number, correctCount: number, totalCount: number): Comparison | null {
  if (totalCount <= 0) return null;
  const practicePercent = Math.round((correctCount / totalCount) * 100);
  return { baselinePercent, practicePercent, change: practicePercent - baselinePercent };
}

/** `label` names the practice side: "This test" on results, "Latest" on the Progress tab. */
export function comparisonLine(c: Comparison, label: 'This test' | 'Latest'): string {
  const head = `Baseline ${c.baselinePercent}% → ${label} ${c.practicePercent}%`;
  if (c.change > 0) return `${head} · +${c.change} points`;
  if (c.change === 0) return `${head} · same as your baseline`;
  return `${head}. Keep going — every test shows what to work on.`;
}

/** Home's short form: "+16 points since your baseline", or nothing when it isn't up. */
export function sinceBaselineLine(c: Comparison): string | null {
  return c.change > 0 ? `+${c.change} points since your baseline` : null;
}
