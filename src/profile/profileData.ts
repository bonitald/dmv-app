import { parseDateString, type DateString } from './testDate';

// ph-9-us-2: the shape of the user's profile doc, users/{uid}, as the app sees it. Kept free of
// Firebase imports so it can be unit-tested in plain Node.
export type ProfileStatus = 'loading' | 'ready' | 'error';

export type OnboardingChoice = 'baseline' | 'learn';

export interface Profile {
  onboarding: { choice: OnboardingChoice } | null;
  /** A valid 'YYYY-MM-DD' date, or null when unset or malformed (treated as no date). */
  testDate: DateString | null;
}

/** Normalizes raw doc data, so screens never see malformed values. */
export function toProfile(data: Record<string, unknown> | undefined): Profile {
  const onboarding = data?.onboarding as { choice?: unknown } | undefined;
  const choice = onboarding?.choice;
  return {
    onboarding: choice === 'baseline' || choice === 'learn' ? { choice } : null,
    testDate: parseDateString(data?.testDate) ? (data!.testDate as DateString) : null,
  };
}
