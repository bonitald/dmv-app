import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { subscribeProfile } from './profile';
import type { Profile, ProfileStatus } from './profileData';

// ph-9-us-2/us-3: one live subscription to users/{uid}, shared by the onboarding gate, Home and
// Settings, so screens don't each open their own listener or re-derive the profile.
interface ProfileState {
  status: ProfileStatus;
  profile: Profile | null;
}

const ProfileContext = createContext<ProfileState>({ status: 'loading', profile: null });

export function ProfileProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const [state, setState] = useState<ProfileState>({ status: 'loading', profile: null });

  useEffect(() => {
    setState({ status: 'loading', profile: null });
    return subscribeProfile(
      uid,
      (profile) => setState({ status: 'ready', profile }),
      (error) => {
        console.warn('[profile] subscription failed', error);
        // Keep the last good profile if there was one; screens fall back gracefully.
        setState((prev) => ({ status: prev.profile ? 'ready' : 'error', profile: prev.profile }));
      }
    );
  }, [uid]);

  return <ProfileContext.Provider value={state}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileState {
  return useContext(ProfileContext);
}
