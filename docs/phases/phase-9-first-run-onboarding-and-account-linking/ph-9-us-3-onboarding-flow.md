# Onboarding flow: welcome, route choice, optional test date

**ID:** ph-9-us-3
**Layer:** Frontend
**Parent:** ph-9-us-1
**Status:** Not Started

## Story
As a teen user opening the app for the first time,
I want a quick, friendly start that asks me how I want to begin and, optionally, when my test is,
So that I'm studying within a minute without filling in forms.

## Context
- **Product area**: Phase 9 (`docs/phases.md`, first and second bullets). Goal: into the right
  starting point in under a minute.
- **Layer**: Frontend (Expo/React Native).
- Backed by ph-9-us-2 (profile fields and rules) — not built yet.
- Sign-in is already silent and anonymous (`AuthProvider`, ph-0-us-7). Onboarding sits after
  auth is `ready` and before `RootNavigator`'s tabs.
- **Whether to show onboarding**: show it when `users/{uid}.onboarding` is absent. Also keep a
  local "onboarding done" flag (AsyncStorage) so a returning user skips it instantly, even
  offline, without waiting for Firestore.
- Steps:
  1. **Welcome**: one line on what the app does, Colorado handbook based (ph-3-us-11), plus a small
     "Already have an account? Sign in" link for users on a new phone (ph-9-us-10).
  2. **Choice**: "Test what I know" (about 15 min per section, 3 sections, pause any time) vs.
     "Learn first" (go concept by concept). Two equal cards; neither is marked "recommended".
  3. **Test date (optional)**: the date step from ph-9-us-5, with a clear "Skip".
  Then save `onboarding` (and `testDate` if given) and navigate into the chosen route.

## Acceptance Criteria
- [ ] Given auth is ready and the profile has no `onboarding`, when the app opens, then the
  welcome step shows instead of the tabs.
- [ ] Given the choice step, when the user picks a route, then the test date step shows, with
  Skip and Continue.
- [ ] Given the user finishes the date step (skip or date), when they continue, then
  `onboarding: { choice, completedAt }` is saved, the local flag is set, and they land in the
  baseline intro (ph-3-us-13) or the concept list (ph-2-us-7), with the tabs underneath so Back
  reaches Home.
- [ ] Given onboarding was finished, when the app opens again (even offline), then it goes straight
  to Home (ph-9-us-7).
- [ ] Given the save fails because the device is offline, when the user continues, then they
  still go into their route. The write is queued by Firestore offline persistence and the local
  flag stops onboarding from repeating.
- [ ] Given a user signs in to an existing account from the welcome step (ph-9-us-10), when that
  account already has `onboarding`, then onboarding is skipped and they land on Home.
- [ ] Given the whole flow, when timed from first screen to the first question or concept, then it
  takes three taps if the date is skipped.

## UI/UX Notes
- **Screens/flows**: app launch → (auth) → welcome → choice → test date → baseline intro or concept
  list. Welcome → "Sign in" → ph-9-us-10.
- Uses locked tokens and type only. No account creation, name, age or other questions (`prd.md`
  Section 7: no PII by default).
- Back works between steps; no progress bar needed for three steps.

## Dependencies
- **Parent**: ph-9-us-1 — the user-facing onboarding.
- **Backed by**: ph-9-us-2 (not built yet).
- **Blocked by**: ph-3-us-13 (baseline route) and ph-2-us-7 (concept list) as destinations. Either
  can be stubbed to a placeholder so onboarding can be built first.
- **Uses**: ph-9-us-5 (date step), ph-9-us-10 (sign in on a new phone).

## Test Notes
- **Happy path**: new install → welcome → "Test what I know" → skip date → baseline intro; relaunch
  → Home.
- **Edge cases**: "Learn first" with a date; kill the app mid-onboarding (onboarding shows again);
  reinstall (new uid → onboarding again, expected); offline during onboarding.
- **Failure modes**: profile read fails (fall back to the local flag; if neither, show
  onboarding); save rejected by rules (log, still navigate).

## Tasks
- [ ] Add an onboarding gate between `AuthProvider` and `RootNavigator` (profile `onboarding` +
  local flag).
- [ ] Build the welcome and choice steps; embed ph-9-us-5's date step.
- [ ] Save the profile fields and navigate into the chosen route.
- [ ] Log a simple analytics event with the chosen route (`onboarding_complete`, `{ choice }`) —
  for insight only, not a success metric.

## Questions
- Should the choice step mention the baseline is also the user's "free test" (`prd.md` Section 4)?
  Assumed no: nothing is gated in MVP, so it would only confuse.
