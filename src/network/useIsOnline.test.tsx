import { isOnline } from './useIsOnline';

// Unknown (null) counts as online, so the app never blocks the user before NetInfo's first read.
test.each([
  [{ isConnected: true, isInternetReachable: true }, true],
  [{ isConnected: true, isInternetReachable: null }, true],
  [{ isConnected: null, isInternetReachable: null }, true],
  [{ isConnected: false, isInternetReachable: null }, false],
  [{ isConnected: true, isInternetReachable: false }, false],
])('%o is online: %s', (state, expected) => {
  expect(isOnline(state)).toBe(expected);
});
