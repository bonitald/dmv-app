import { toBaselineProgress } from './baselineProgressData';

test('no doc means not started', () => {
  expect(toBaselineProgress(undefined)).toEqual({ status: 'not-started' });
});

test('a doc with completedAt is complete, with its version', () => {
  expect(
    toBaselineProgress({ currentSection: 3, completedAt: { seconds: 1 }, version: 'v2' })
  ).toEqual({ status: 'complete', version: 'v2' });
});

test('a complete doc with no version falls back to v1', () => {
  expect(toBaselineProgress({ currentSection: 3, completedAt: { seconds: 1 } })).toEqual({
    status: 'complete',
    version: 'v1',
  });
});

test('otherwise it is in progress at currentSection', () => {
  expect(toBaselineProgress({ currentSection: 2, completedAt: null })).toEqual({
    status: 'in-progress',
    currentSection: 2,
    totalSections: 3,
  });
});

test('a malformed currentSection falls back to section 1', () => {
  expect(toBaselineProgress({ currentSection: 'x', completedAt: null })).toEqual({
    status: 'in-progress',
    currentSection: 1,
    totalSections: 3,
  });
});
