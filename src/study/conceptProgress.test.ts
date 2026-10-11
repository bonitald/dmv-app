import { onSnapshot } from '@react-native-firebase/firestore';
import { markOpened, setStatusFromChoice, subscribeConceptProgress } from './conceptProgress';

// The Firestore calls are mocked so the write rules run under plain-Node Jest.
const mockSetDoc = jest.fn((..._args: unknown[]) => Promise.resolve());
jest.mock('@react-native-firebase/app', () => ({ getApp: jest.fn() }));
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') })),
  doc: jest.fn((parent: { path: string }, id: string) => ({ path: `${parent.path}/${id}` })),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TS'),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
}));

beforeEach(() => jest.clearAllMocks());

test('opening a not-started topic writes in-progress with the server time, merged', () => {
  markOpened('u1', 'row', 'not-started');
  expect(mockSetDoc).toHaveBeenCalledWith(
    { path: 'users/u1/conceptProgress/row' },
    { status: 'in-progress', statusUpdatedAt: 'SERVER_TS' },
    { merge: true }
  );
});

test.each(['in-progress', 'reviewed', 'needs-revisit'] as const)(
  'opening a %s topic writes nothing',
  (current) => {
    markOpened('u1', 'row', current);
    expect(mockSetDoc).not.toHaveBeenCalled();
  }
);

test.each([
  ['review-again', 'in-progress'],
  ['come-back-later', 'needs-revisit'],
  ['mark-reviewed', 'reviewed'],
] as const)('choice %s writes %s', (choice, status) => {
  setStatusFromChoice('u1', 'row', choice);
  expect(mockSetDoc).toHaveBeenCalledWith(
    { path: 'users/u1/conceptProgress/row' },
    { status, statusUpdatedAt: 'SERVER_TS' },
    { merge: true }
  );
});

test('a rejected write is logged, not thrown', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockSetDoc.mockImplementationOnce(() => Promise.reject(new Error('permission-denied')));

  expect(() => markOpened('u1', 'row', 'not-started')).not.toThrow();
  await new Promise((resolve) => setImmediate(resolve));

  expect(warn).toHaveBeenCalledWith(
    '[conceptProgress] status write failed',
    'row',
    'in-progress',
    expect.any(Error)
  );
  warn.mockRestore();
});

test('subscribes with metadata changes and reports a cache-only empty snapshot', () => {
  const onChange = jest.fn();
  const onError = jest.fn();
  subscribeConceptProgress('u1', onChange, onError);

  const [ref, options, next, err] = (onSnapshot as jest.Mock).mock.calls[0];
  expect(ref).toEqual({ path: 'users/u1/conceptProgress' });
  expect(options).toEqual({ includeMetadataChanges: true });
  expect(err).toBe(onError);

  next({ docs: [], empty: true, metadata: { fromCache: true } });
  expect(onChange).toHaveBeenLastCalledWith({}, true);
  next({ docs: [], empty: true, metadata: { fromCache: false } });
  expect(onChange).toHaveBeenLastCalledWith({}, false);
  next({
    docs: [{ id: 'row', data: () => ({ status: 'reviewed' }) }],
    empty: false,
    metadata: { fromCache: true },
  });
  expect(onChange).toHaveBeenLastCalledWith({ row: { status: 'reviewed' } }, false);
});
