import { useEffect, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

// ph-3-us-1: whether the phone can reach the internet right now. Unknown counts as online, so
// the app never blocks the user before NetInfo's first reading; a real failure still surfaces
// through the callable's own `offline` error.
export function isOnline(
  state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>
): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

export function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => NetInfo.addEventListener((state) => setOnline(isOnline(state))), []);
  return online;
}
