import { renderHook } from '@testing-library/react-native';
import { useConceptEvidence } from './useConceptEvidence';

let mockBaseline: any;
let mockAttempt: any;
let mockPractice: any = { status: 'ready', attempts: [] };
const mockAttemptRetry = jest.fn();
const mockTopics = {
  status: 'ready',
  topics: [{ chunkId: 'a', title: 'Topic a', description: '', order: 1, approvedQuestionCount: 5 }],
  retry: jest.fn(),
};

jest.mock('../topics/useTopics', () => ({ useTopics: () => mockTopics }));
jest.mock('../study/useConceptProgress', () => ({
  useConceptProgress: () => ({ status: 'ready', byChunk: {}, cachedEmpty: false }),
}));
jest.mock('../baseline/useBaselineProgress', () => ({ useBaselineProgress: () => mockBaseline }));
jest.mock('../review/useTestAttempt', () => ({
  useTestAttempt: () => ({ ...mockAttempt, retry: mockAttemptRetry }),
}));

jest.mock('../practice/usePracticeAttempts', () => ({ usePracticeAttempts: () => mockPractice }));

beforeEach(() => {
  jest.clearAllMocks();
  mockPractice = { status: 'ready', attempts: [] };
});

test('baseline not started: ready, no baseline evidence, no error', async () => {
  mockBaseline = { status: 'not-started' };
  mockAttempt = { status: 'loading' };
  const { result } = await renderHook(() => useConceptEvidence());
  expect(result.current).toMatchObject({ status: 'ready', baselineError: false, retryBaseline: null });
  if (result.current.status === 'ready') expect(result.current.rows[0].result.strength).toBe('not-tested');
});

test('baseline in progress: ready', async () => {
  mockBaseline = { status: 'in-progress', currentSection: 1, totalSections: 3 };
  mockAttempt = { status: 'loading' };
  const { result } = await renderHook(() => useConceptEvidence());
  expect(result.current).toMatchObject({ status: 'ready', baselineError: false });
});

test('baseline complete but the attempt fails: error flagged, retry works', async () => {
  mockBaseline = { status: 'complete', version: 'v1' };
  mockAttempt = { status: 'error', offline: false };
  const { result } = await renderHook(() => useConceptEvidence());
  expect(result.current).toMatchObject({ status: 'ready', baselineError: true });
  if (result.current.status !== 'ready' || !result.current.retryBaseline) throw new Error('expected retryable');
  result.current.retryBaseline();
  expect(mockAttemptRetry).toHaveBeenCalled();
});

test('baseline subscription error: flagged but not retryable', async () => {
  mockBaseline = { status: 'error' };
  mockAttempt = { status: 'loading' };
  const { result } = await renderHook(() => useConceptEvidence());
  expect(result.current).toMatchObject({ status: 'ready', baselineError: true, retryBaseline: null });
});

test('baseline complete and attempt loading: loading', async () => {
  mockBaseline = { status: 'complete', version: 'v1' };
  mockAttempt = { status: 'loading' };
  const { result } = await renderHook(() => useConceptEvidence());
  expect(result.current).toEqual({ status: 'loading' });
});

const outcome = (testId: string) => ({
  testId, createdAt: new Date(0), correctCount: 1, totalCount: 1, unavailableCount: 0,
  perTopic: [{ chunkId: 'a', correct: 1, total: 1 }],
});

test('practice attempts rate a topic from practice, summed across tests', async () => {
  mockBaseline = { status: 'not-started' };
  mockAttempt = { status: 'loading' };
  mockPractice = { status: 'ready', attempts: [outcome('t1'), outcome('t2')] };
  const { result } = await renderHook(() => useConceptEvidence());
  if (result.current.status !== 'ready') throw new Error('expected ready');
  expect(result.current.rows[0].result).toMatchObject({ strength: 'strong', source: 'practice', correct: 2, total: 2 });
});

test('a practice read error does not block the report', async () => {
  mockBaseline = { status: 'not-started' };
  mockAttempt = { status: 'loading' };
  mockPractice = { status: 'error' };
  const { result } = await renderHook(() => useConceptEvidence());
  expect(result.current).toMatchObject({ status: 'ready', baselineError: false });
  if (result.current.status === 'ready') expect(result.current.rows[0].result.source).toBe('none');
});

test('practice loading keeps the report loading', async () => {
  mockBaseline = { status: 'not-started' };
  mockAttempt = { status: 'loading' };
  mockPractice = { status: 'loading' };
  const { result } = await renderHook(() => useConceptEvidence());
  expect(result.current).toEqual({ status: 'loading' });
});
