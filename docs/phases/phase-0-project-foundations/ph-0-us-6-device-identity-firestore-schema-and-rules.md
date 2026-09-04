# Firestore schema and security rules scoped to the device identity

**ID:** ph-0-us-6
**Layer:** Backend
**Parent:** ph-0-us-5
**Status:** Not Started

## Story
As a developer,
I want Firestore security rules and a `users` (device) document keyed to the app's identity
mechanism,
So that every later phase's per-user data (test attempts, driving sessions, test outcome)
can be written and read only by the device that owns it.

## Context
- **Product area**: Phase 0 — Project Foundations
- **Layer**: Backend (Firestore security rules)
- **Key decision**: use **Firebase Anonymous Authentication** (`signInAnonymously()`) rather
  than a client-generated UUID stored without auth. An unauthenticated client-generated ID
  can't be verified server-side, so Firestore rules would have no way to stop one device
  from reading/writing another device's data by guessing/spoofing its ID. Anonymous auth
  gives a real `request.auth.uid` that security rules can check, at no cost to the
  no-signup-friction goal — `signInAnonymously()` requires no user interaction.
- This choice also directly explains the reinstall-loss limitation flagged in `docs/prd.md`
  Section 9: an anonymous auth session is tied to the app install/keychain, not a portable
  account, so it doesn't survive a reinstall or device switch — same limitation as a raw
  device ID would have had, but with the added benefit of real server-side enforcement.

## Acceptance Criteria
- [ ] Given a user's device has signed in anonymously, when any Firestore document under a
  per-user path (e.g. `users/{uid}/...`) is read or written, then rules allow it only when
  `request.auth.uid == uid` — never a broader read/write.
- [ ] Given a device has not yet signed in anonymously, when it attempts any Firestore
  operation, then it is rejected — no anonymous-read fallback for per-user data.
- [ ] Given the `users/{uid}` document is created, when it's first written, then it holds
  only minimal fields needed by this phase (e.g. `createdAt`) — no fields belonging to later
  phases' data are pre-created here.
- [ ] Given Firestore rules are deployed, when tested against the Firebase emulator's rules
  test suite, then cross-user access attempts (device A reading/writing under device B's
  `uid`) are explicitly verified to fail.

## Data and API
- **Firestore schema changes**: New top-level `users` collection, one document per anonymous
  `uid`, path `users/{uid}`. Initial fields: `createdAt` (server timestamp). Later phases add
  subcollections/fields under this same `uid` (e.g. `users/{uid}/testAttempts`,
  `users/{uid}/drivingSessions`) rather than introducing a separate identity scheme.
- **Security rules**: `match /users/{uid}/{document=**} { allow read, write: if
  request.auth != null && request.auth.uid == uid; }` as the baseline pattern all later
  per-user collections build on.
- **Cloud Functions**: None required for this story — anonymous auth and the `users/{uid}`
  document are created client-side (ph-0-us-7) under rules enforced here.

## Dependencies
- **Blocked by**: ph-0-us-3 (Firebase project must exist; Anonymous Authentication must be
  enabled as a sign-in provider in the Firebase console).
- **Parent**: ph-0-us-5 — this is the server-enforced half of the device-identity story.

## Test Notes
- **Happy path**: An anonymously-authenticated device can read/write its own `users/{uid}`
  document; a Firestore emulator rules test confirms this.
- **Edge cases**: A signed-out (never-authenticated) client attempts a Firestore call — must
  fail cleanly, not hang or silently no-op.
- **Failure modes**: A rules bug that accidentally allows `request.auth.uid` to be omitted
  from the match (e.g. a wildcard `allow read, write: if request.auth != null;` without the
  `uid` equality check) would let any authenticated device read/write any other device's
  data — this is the specific mistake the emulator test in the acceptance criteria guards
  against.

## Tasks
- [ ] Enable Anonymous Authentication as a sign-in provider in the Firebase console for each
  environment.
- [ ] Write Firestore security rules enforcing `request.auth.uid == uid` on the `users/{uid}`
  path (and its future subcollections).
- [ ] Set up the Firebase emulator's rules test suite with at least one same-user-allowed and
  one cross-user-denied test case.
- [ ] Deploy rules to dev/staging; confirm prod rules deploy is part of the release checklist
  (not deployed to prod as part of this story).

## Questions
- None outstanding.
