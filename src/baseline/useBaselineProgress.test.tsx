import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { onSnapshot } from '@react-native-firebase/firestore';
import { useBaselineProgress } from './useBaselineProgress';

jest.mock('@react-native-firebase/app', () => ({ getApp: jest.fn() }));
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(),
  doc: jest.fn(),
  onSnapshot: jest.fn(() => () => {}),
}));
jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ status: 'ready', uid: 'u1' }) }));

function Probe() {
  return <Text>{useBaselineProgress().status}</Text>;
}

const listenerArgs = () => (onSnapshot as jest.Mock).mock.calls[0];

beforeEach(() => jest.clearAllMocks());

test('a snapshot sets the progress', async () => {
  await render(<Probe />);
  await act(() => listenerArgs()[1]({ data: () => ({ currentSection: 2, completedAt: null }) }));
  expect(screen.getByText('in-progress')).toBeTruthy();
});

test('a read error before any snapshot reports error, not loading forever', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  await render(<Probe />);
  await act(() => listenerArgs()[2](new Error('permission-denied')));
  expect(screen.getByText('error')).toBeTruthy();
});

test('a read error after a good snapshot keeps the last good value', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  await render(<Probe />);
  await act(() => listenerArgs()[1]({ data: () => undefined }));
  await act(() => listenerArgs()[2](new Error('unavailable')));
  expect(screen.getByText('not-started')).toBeTruthy();
});
