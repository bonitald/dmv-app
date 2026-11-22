import { compareToBaseline, comparisonLine, sinceBaselineLine } from './scoreComparison';

test('baseline 60% (27/45) and 19 of 25 is +16 points', () => {
  const c = compareToBaseline(60, 19, 25)!;
  expect(c).toEqual({ baselinePercent: 60, practicePercent: 76, change: 16 });
  expect(comparisonLine(c, 'This test')).toBe('Baseline 60% → This test 76% · +16 points');
  expect(sinceBaselineLine(c)).toBe('+16 points since your baseline');
});

test('equal scores say so', () => {
  expect(comparisonLine(compareToBaseline(80, 20, 25)!, 'Latest')).toBe('Baseline 80% → Latest 80% · same as your baseline');
});

test('a lower score stays encouraging, with no minus sign', () => {
  const c = compareToBaseline(60, 13, 25)!;
  const line = comparisonLine(c, 'This test');
  expect(line).toBe('Baseline 60% → This test 52%. Keep going — every test shows what to work on.');
  expect(line).not.toMatch(/-|worse|fail/i);
  expect(sinceBaselineLine(c)).toBeNull();
});

test('a test with nothing graded has no comparison', () => {
  expect(compareToBaseline(60, 0, 0)).toBeNull();
});
