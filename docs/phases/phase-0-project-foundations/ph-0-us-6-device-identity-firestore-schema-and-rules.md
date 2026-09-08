# Firestore schema and security rules scoped to the device identity

**ID:** ph-0-us-6
**Layer:** Backend
**Parent:** ph-0-us-5
**Status:** Done (2026-09-08) — rules written, verified with 4 passing emulator tests, and
deployed to `dmv-app-dev`. Prod deploy intentionally deferred to the release checklist, per
this story's own scope.

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
- [x] Given a user's device has signed in anonymously, when any Firestore document under a
  per-user path (e.g. `users/{uid}/...`) is read or written, then rules allow it only when
  `request.auth.uid == uid` — never a broader read/write. See `firestore.rules`; verified by
  `firestore-tests/rules.test.ts`'s same-user-allowed / cross-user-denied cases.
- [x] Given a device has not yet signed in anonymously, when it attempts any Firestore
  operation, then it is rejected — no anonymous-read fallback for per-user data. Verified by
  the "device that has not signed in anonymously is rejected outright" test.
- [x] Given the `users/{uid}` document is created, when it's first written, then it holds
  only minimal fields needed by this phase (e.g. `createdAt`) — no fields belonging to later
  phases' data are pre-created here. This story only defines the rule/schema convention; no
  document is actually created client-side until ph-0-us-7, so nothing is pre-created.
- [x] Given Firestore rules are deployed, when tested against the Firebase emulator's rules
  test suite, then cross-user access attempts (device A reading/writing under device B's
  `uid`) are explicitly verified to fail. 4/4 tests pass locally via `npm run test:rules`
  (`firebase emulators:exec`), and the rules are now deployed to `dmv-app-dev`.

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
- [x] Enable Anonymous Authentication as a sign-in provider in the Firebase console for each
  environment. Done by the user in `docs/phase-0-plan.md` Section B, for both dev and prod.
- [x] Write Firestore security rules enforcing `request.auth.uid == uid` on the `users/{uid}`
  path (and its future subcollections). See `firestore.rules`.
- [x] Set up the Firebase emulator's rules test suite with at least one same-user-allowed and
  one cross-user-denied test case. `firestore-tests/rules.test.ts` has 4 cases: same-user
  read/write allowed, cross-user write denied, cross-user read denied, unauthenticated
  denied. Run via `npm run test:rules` (spins up the Firestore emulator via
  `firebase emulators:exec`, no manual emulator start needed). Added `firebase.json`,
  `.firebaserc` (dev/staging/prod project aliases — staging aliases to the dev project since
  no separate staging Firebase project exists yet), `firestore.indexes.json` (empty), and a
  scoped `jest.rules.config.js` + `firestore-tests/tsconfig.json` so this test suite doesn't
  collide with whatever test setup the app itself eventually adds.
- [x] Deploy rules to dev/staging; confirm prod rules deploy is part of the release checklist
  (not deployed to prod as part of this story). Deployed to `dmv-app-dev` via
  `npx firebase-tools deploy --only firestore:rules --project dev`
  (`.firebaserc`'s `staging` alias also points at `dmv-app-dev`, so this covers both until a
  real staging project exists). Prod (`dmv-app-prod`) intentionally untouched — deploying
  there belongs on the release checklist, not this story.

## Questions
- None outstanding.
