import { getApp } from '@react-native-firebase/app';
import {
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from '@react-native-firebase/firestore';
import type { DateString } from './testDate';
import { toProfile, type OnboardingChoice, type Profile } from './profileData';

export type { OnboardingChoice, Profile } from './profileData';

// ph-9-us-2: reads and writes of users/{uid}. The rules allow the owner to change only
// `onboarding` and `testDate` (see firestore.rules), so these are the only writes here.
function profileDoc(uid: string) {
  return doc(getFirestore(getApp()), 'users', uid);
}

/**
 * Listens to the profile doc. Firestore's offline persistence delivers the cached copy first,
 * so this also works offline once the doc has been seen on this device.
 */
export function subscribeProfile(
  uid: string,
  onProfile: (profile: Profile) => void,
  onError: (error: Error) => void
): () => void {
  return onSnapshot(
    profileDoc(uid),
    (snapshot) => onProfile(toProfile(snapshot.data() as Record<string, unknown> | undefined)),
    onError
  );
}

/**
 * Saves the first-run choice (and the test date, if one was picked). Resolves only once the
 * server confirms, which never happens offline — callers shouldn't await it before moving on;
 * the write is queued and the local snapshot updates immediately.
 */
export function saveOnboarding(
  uid: string,
  choice: OnboardingChoice,
  testDate: DateString | null
): Promise<void> {
  return updateDoc(profileDoc(uid), {
    onboarding: { choice, completedAt: serverTimestamp() },
    ...(testDate ? { testDate } : {}),
  });
}

/** Sets or clears (`null`) the test date. Same offline behavior as saveOnboarding. */
export function saveTestDate(uid: string, testDate: DateString | null): Promise<void> {
  return updateDoc(profileDoc(uid), { testDate });
}
