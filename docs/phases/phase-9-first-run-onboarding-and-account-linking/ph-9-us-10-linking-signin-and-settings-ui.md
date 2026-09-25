# Linking prompts, sign-in on a new phone, and Settings

**ID:** ph-9-us-10
**Layer:** Frontend
**Parent:** ph-9-us-8
**Status:** Not Started

## Story
As a teen user,
I want a simple "save your progress" option with Google or Apple, a way to sign back in on a new
phone, and a Settings screen where I can see my account and delete my data,
So that my progress is safe and I stay in control of it.

## Context
- **Product area**: Phase 9 (`docs/phases.md`, third bullet).
- **Layer**: Frontend (Expo/React Native).
- Backed by ph-9-us-9 (providers enabled, `deleteAccount`) — not built yet.
- **Native pieces** (each needs a dev client rebuild, via config plugins, no eject — consistent with
  `docs/phase-0-findings.md`):
  - Google: `@react-native-google-signin/google-signin`
  - Apple (iOS only): `expo-apple-authentication`
  Check both against Expo SDK 57 before adding.
- **Three auth paths**, all through `@react-native-firebase/auth`:
  1. **Link** (anonymous → linked): `linkWithCredential`. The uid is unchanged, so no data moves.
  2. **Credential already in use** (the Google/Apple account is already linked to another user,
     e.g. their old phone): offer "Sign in to that account instead". Warn that progress made on
     this phone since installing won't carry over, then `signInWithCredential`.
  3. **Sign in on a new phone** (from onboarding's welcome step or Settings): `signInWithCredential`.
     The empty anonymous user from this launch is simply left behind.
  `AuthProvider` should expose the current user's state (anonymous / linked + provider) so screens
  don't re-derive it (ph-0-us-7 rule).
- **Local data** (AsyncStorage: card performance, test cache, dismissed prompts, onboarding flag)
  belongs to the device, not the account. Clear it on sign-out, account switch and deletion, so
  one user's local history never mixes with another's.

## Acceptance Criteria
- [ ] Given an anonymous user reaches the baseline results (ph-4-us-6), when the screen settles,
  then a non-blocking "Save your progress" card offers Google and (on iOS) Apple, with "Not now".
- [ ] Given "Not now", when the user dismisses a prompt, then that prompt moment doesn't appear
  again (stored locally), and Home's save-progress card remains dismissible separately.
- [ ] Given the user completes Google or Apple sign-in from a prompt, when linking succeeds, then
  they see "Progress saved to <provider>", the uid is unchanged, and prompts stop appearing.
- [ ] Given linking fails with `credential-already-in-use`, when it happens, then the user is
  offered to sign in to that account instead, with the warning above, or to cancel.
- [ ] Given the user cancels the provider sheet, when it closes, then nothing changes and there's
  no error message.
- [ ] Given onboarding's welcome step or Settings, when the user taps "Sign in" on a new phone and
  completes it, then the app reloads their data. If that account finished onboarding, they land
  on Home.
- [ ] Given Settings, when it opens, then it shows the account state ("Not saved — progress lives
  on this phone only" or "Saved with Google/Apple"), the test date editor (ph-9-us-5), sign-out
  (linked users only), and "Delete my data".
- [ ] Given a linked user signs out, when they confirm (with a note that they can sign back in),
  then local data is cleared and the app restarts as a fresh anonymous user at onboarding.
- [ ] Given "Delete my data", when the user confirms twice (explicit wording that this can't be
  undone), then for an Apple-linked user the Apple token is revoked first, then `deleteAccount`
  runs, local data is cleared, and the app restarts at onboarding.
- [ ] Given `deleteAccount` fails, when it returns an error, then the user is told it didn't
  finish and can retry. Nothing claims success early.
- [ ] Given the device is offline, when the user tries to link, sign in or delete, then they're
  told a connection is needed.

## UI/UX Notes
- **Screens/flows**: prompt card on baseline results and Home; Settings (gear on Home's header);
  "Sign in" link on onboarding welcome. Phase 7 adds a prompt before driving-log export.
- Copy explains the why in one line: "Changing phones? Save your progress so you can pick up where
  you left off." No mention of accounts, profiles or email fields.
- Use the platforms' official Google and Apple button styles (Apple's guidelines require it).

## Dependencies
- **Parent**: ph-9-us-8.
- **Backed by**: ph-9-us-9 (not built yet).
- **Blocked by**: ph-4-us-6 (baseline results prompt spot), ph-9-us-7 (Home, Settings entry),
  ph-9-us-3 (welcome step sign-in link).

## Test Notes
- **Happy path**: anonymous → take baseline → link with Google → uninstall → reinstall → Sign in
  with Google → baseline results are there.
- **Edge cases**: credential already in use (old phone); cancel provider sheet; Apple on Android
  (not offered); sign-out then onboarding; linked user deletes data.
- **Failure modes**: offline; Google Play Services missing on the emulator; `deleteAccount`
  failure; Apple revoke failure (don't delete until revoke succeeds, or tell the user).

## Tasks
- [ ] Add the Google and Apple sign-in libraries with config plugins; rebuild dev clients.
- [ ] Extend `AuthProvider` with account state and link / sign-in / sign-out / delete actions.
- [ ] Build the save-progress prompt card (baseline results, Home) with per-moment dismissal.
- [ ] Build Settings (account state, test date, sign-out, delete) behind Home's gear.
- [ ] Add the "Sign in" path to onboarding's welcome step.
- [ ] A shared `clearLocalData()` for sign-out, switch and deletion.
- [ ] Manual test plan on both platforms (sign-in flows can't be unit-tested well).

## Questions
- **Providers**: Apple + Google assumed (the `prd.md` recommendation); email link deferred. Confirm.
- `prd.md` Section 8 asks for a review of Colorado and federal privacy rules for minors before
  launch, now that an email can be held. Not an engineering task, but it should happen before
  Phase 8.
