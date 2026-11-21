import { act, renderHook } from '@testing-library/react-native';
import { usePracticeAttempts } from './usePracticeAttempts';

let mockUid: string | null = 'u1';
let mockOnChange: (o: any[]) => void;
let mockOnError: (e: unknown) => void;
const mockUnsubscribe = jest.fn();
const mockSubscribe = jest.fn();

jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('./practiceAttempts', () => ({
  subscribePracticeAttempts: (...args: any[]) => mockSubscribe(...args),
}));

const attempt = {
  testId: 't1',
  createdAt: null,
  correctCount: 20,
  totalCount: 25,
  perTopic: [],
  unavailableCount: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUid = 'u1';
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockSubscribe.mockImplementation((_uid, onChange, onError) => {
    mockOnChange = onChange;
    mockOnError = onError;
    return mockUnsubscribe;
  });
});

test('starts loading', async () => {
  const { result } = await renderHook(() => usePracticeAttempts());
  expect(result.current).toEqual({ status: 'loading' });
  expect(mockSubscribe).toHaveBeenCalledWith('u1', expect.any(Function), expect.any(Function));
});

test('onChange gives ready with the attempts', async () => {
  const { result } = await renderHook(() => usePracticeAttempts());
  await act(async () => mockOnChange([attempt]));
  expect(result.current).toEqual({ status: 'ready', attempts: [attempt] });
});

test('error before any data gives error', async () => {
  const { result } = await renderHook(() => usePracticeAttempts());
  await act(async () => mockOnError(new Error('boom')));
  expect(result.current).toEqual({ status: 'error' });
});

test('error after data keeps the last ready', async () => {
  const { result } = await renderHook(() => usePracticeAttempts());
  await act(async () => mockOnChange([attempt]));
  await act(async () => mockOnError(new Error('boom')));
  expect(result.current).toEqual({ status: 'ready', attempts: [attempt] });
});

test('no uid gives ready and empty, without subscribing', async () => {
  mockUid = null;
  const { result } = await renderHook(() => usePracticeAttempts());
  expect(result.current).toEqual({ status: 'ready', attempts: [] });
  expect(mockSubscribe).not.toHaveBeenCalled();
});

test('uid change resubscribes and resets to loading', async () => {
  const { result, rerender } = await renderHook(() => usePracticeAttempts());
  await act(async () => mockOnChange([attempt]));
  expect(result.current.status).toBe('ready');
  mockUid = 'u2';
  await rerender({});
  expect(mockUnsubscribe).toHaveBeenCalled();
  expect(mockSubscribe).toHaveBeenLastCalledWith('u2', expect.any(Function), expect.any(Function));
  expect(result.current).toEqual({ status: 'loading' });
});
