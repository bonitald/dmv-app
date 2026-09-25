import type { Profile, ProfileStatus } from '../profile/profileData';

// ph-9-us-3: decides whether launch opens onboarding or the tabs.
export type InitialRoute = 'Welcome' | 'Main';

/**
 * - Local "onboarding done" flag set → tabs straight away, even offline, without waiting on
 *   Firestore.
 * - Otherwise wait for the profile: `onboarding` present → tabs; absent → onboarding.
 * - Profile can't be read and no local flag → onboarding (the story's failure mode).
 * Returns null while there isn't enough to decide yet.
 */
export function resolveInitialRoute(
  localFlag: boolean | null,
  profileStatus: ProfileStatus,
  profile: Profile | null
): InitialRoute | null {
  if (localFlag === null) return null;
  if (localFlag) return 'Main';
  if (profileStatus === 'loading') return null;
  if (profileStatus === 'ready' && profile?.onboarding) return 'Main';
  return 'Welcome';
}
