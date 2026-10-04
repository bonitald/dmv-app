import { act, renderHook } from '@testing-library/react-native';
import { useConceptProgress } from './useConceptProgress';

// A uid change must drop the previous user's map straight away, back to loading.
let mockUid: string | null = 'u1';
jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ uid: mockUid }) }));
const mockListeners: Record<string, (m: Record<string, unknown>) => void> = {};
jest.mock('./conceptProgress', () => ({
  subscribeConceptProgress: (uid: string, onData: (m: Record<string, unknown>) => void) => {
    mockListeners[uid] = onData;
    return () => {};
  },
}));

test('changing uid resets to loading until the new user data arrives', async () => {
  mockUid = 'u1';
  const { result, rerender } = await renderHook(() => useConceptProgress());
  await act(async () => mockListeners.u1({ a: { status: 'reviewed' } }));
  expect(result.current).toMatchObject({ status: 'ready', byChunk: { a: { status: 'reviewed' } } });

  mockUid = 'u2';
  await rerender({});
  expect(result.current).toEqual({ status: 'loading' });
  await act(async () => mockListeners.u2({}));
  expect(result.current).toEqual({ status: 'ready', byChunk: {} });
});
