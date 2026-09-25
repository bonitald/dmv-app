import AsyncStorage from '@react-native-async-storage/async-storage';

// Small per-user flags kept on the device (ph-9-us-3, ph-9-us-5). Keyed by uid so a different
// user on the same phone (after sign-out, ph-9-us-10) starts fresh. These are conveniences, not
// the record: the profile doc is the source of truth for onboarding and the test date.
const PREFIX = 'dmv-app:';

export const ONBOARDING_DONE = 'onboarding-done';
export const ADD_DATE_DISMISSED = 'home:add-date-dismissed';

export type LocalFlag = typeof ONBOARDING_DONE | typeof ADD_DATE_DISMISSED;

function key(flag: LocalFlag, uid: string): string {
  return `${PREFIX}${flag}:${uid}`;
}

/** Reads a flag. A storage failure reads as "not set", which only costs showing a step again. */
export async function getLocalFlag(flag: LocalFlag, uid: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(flag, uid))) === '1';
  } catch (error) {
    console.warn('[localFlags] read failed', flag, error);
    return false;
  }
}

export async function setLocalFlag(flag: LocalFlag, uid: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key(flag, uid), '1');
  } catch (error) {
    console.warn('[localFlags] write failed', flag, error);
  }
}
