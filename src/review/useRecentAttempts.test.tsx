import { act, renderHook } from '@testing-library/react-native';
import { useRecentAttempts } from './useRecentAttempts';

let mockUid: string | null = 'u1';
let mockOnChange: (o: any[]) => void;
let mockOnError: (e: unknown) => void;
const mockUnsubscribe = jest.fn();
const mockSubscribe = jest.fn();

jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('./recentAttempts', () => ({
  subscribeRecentAttempts: (...args: any[]) => mockSubscribe(...args),
}));

const doc = { testId: 't1', createdAtMs: 1, data: { type: 'practice', perQuestion: [] } };

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

test('starts loading, then ready with the attempts', async () => {
  const { result } = await renderHook(() => useRecentAttempts());
  expect(result.current).toEqual({ status: 'loading' });
  await act(async () => mockOnChange([doc]));
  expect(result.current).toEqual({ status: 'ready', attempts: [doc] });
});

test('an error before data is error; after data the data stays', async () => {
  const { result } = await renderHook(() => useRecentAttempts());
  await act(async () => mockOnError(new Error('x')));
  expect(result.current).toEqual({ status: 'error' });
  await act(async () => mockOnChange([doc]));
  await act(async () => mockOnError(new Error('y')));
  expect(result.current).toEqual({ status: 'ready', attempts: [doc] });
});

test('a uid change resubscribes from loading; signed out is ready and empty', async () => {
  const { result, rerender } = await renderHook(() => useRecentAttempts());
  await act(async () => mockOnChange([doc]));
  mockUid = 'u2';
  await rerender({});
  expect(result.current).toEqual({ status: 'loading' });
  expect(mockUnsubscribe).toHaveBeenCalled();
  mockUid = null;
  await rerender({});
  expect(result.current).toEqual({ status: 'ready', attempts: [] });
});
