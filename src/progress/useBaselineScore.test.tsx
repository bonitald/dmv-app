import { renderHook } from '@testing-library/react-native';
import { useBaselineScore } from './useBaselineScore';

let mockProgress: unknown = { status: 'loading' };
let mockAttempt: unknown = { status: 'loading' };
jest.mock('../baseline/useBaselineProgress', () => ({ useBaselineProgress: () => mockProgress }));
jest.mock('../review/useTestAttempt', () => ({
  useTestAttempt: (id: string | null) => (id ? { ...(mockAttempt as object), retry: jest.fn() } : { status: 'loading', retry: jest.fn() }),
}));

const review = (right: number, total: number, removed = 0) =>
  Array.from({ length: total }, (_, i) => ({
    questionId: `q${i}`, chunkId: `c${i}`, choice: 'x', correctAnswer: 'x', correct: i < right,
    ...(i >= total - removed ? { unavailable: true, correct: null } : {}),
  }));

async function state() {
  return (await renderHook(() => useBaselineScore())).result.current;
}

test('progress states map through', async () => {
  mockProgress = { status: 'not-started' };
  expect(await state()).toEqual({ status: 'none' });
  mockProgress = { status: 'in-progress', currentSection: 2, totalSections: 3 };
  expect(await state()).toEqual({ status: 'in-progress' });
  mockProgress = { status: 'error' };
  expect(await state()).toEqual({ status: 'unknown' });
});

test('complete: the percent from the final attempt', async () => {
  mockProgress = { status: 'complete', version: 'v1' };
  mockAttempt = { status: 'ready', data: { type: 'baseline', perQuestion: [], baselineReview: review(27, 45) } };
  expect(await state()).toEqual({ status: 'ready', percent: 60 });
});

test('a removed question is left out of the total', async () => {
  mockProgress = { status: 'complete', version: 'v1' };
  mockAttempt = { status: 'ready', data: { type: 'baseline', perQuestion: [], baselineReview: review(22, 45, 1) } };
  expect(await state()).toEqual({ status: 'ready', percent: 50 });
});

test('complete but the attempt cannot be read is unknown', async () => {
  mockProgress = { status: 'complete', version: 'v1' };
  mockAttempt = { status: 'error', offline: true };
  expect(await state()).toEqual({ status: 'unknown' });
});
