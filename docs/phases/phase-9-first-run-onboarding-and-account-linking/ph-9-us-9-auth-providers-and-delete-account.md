# Sign-in providers and the `deleteAccount` function

**ID:** ph-9-us-9
**Layer:** Backend
**Parent:** ph-9-us-8
**Status:** Not Started

## Story
As a developer,
I want Google and Apple sign-in enabled for linking, and a server-side function that fully
deletes a user's data and account,
So that teens can keep their progress across phones, and anyone can delete everything the app
holds about them, as the App Store requires.

## Context
- **Product area**: Phase 9 (`docs/phases.md`, third bullet).
- **Layer**: Backend (Firebase Auth configuration, Cloud Functions).
- **Why deletion needs a function**: a user's data sits in `users/{uid}` and its subcollections
  (`testAssignments`, `testAttempts`, `baseline`, `conceptProgress`, `rateLimits`, and Phase 6's
  driving sessions later). Most are server-written and client-read-only by design, so the client
  can't delete them, and the Auth user itself should be deleted with Admin rights. A callable
  function deletes both.
- Deletion is offered to **everyone**, anonymous users included: it's a privacy right for minors
  (`prd.md` Section 8), not just an App Store rule.
- **Apple**: apps using Sign in with Apple must revoke the user's Apple token when the account is
  deleted. The Firebase client SDK does this with a fresh Apple authorization code
  (`revokeToken`), so the frontend (ph-9-us-10) does it just before calling `deleteAccount`.
- Follows the `cloud-function-documentation` skill.

## Acceptance Criteria
- [ ] Given the Firebase project (dev and prod), when Auth is configured, then Google and Apple
  providers are enabled, with the Android SHA fingerprints and iOS Apple service settings in place.
- [ ] Given a signed-in caller (anonymous or linked), when they call `deleteAccount`, then
  `users/{uid}` and every subcollection under it are deleted, then their Auth user is deleted.
- [ ] Given `deleteAccount` is called without auth, when it runs, then it rejects with
  `unauthenticated` and deletes nothing.
- [ ] Given a caller, when `deleteAccount` runs, then it only ever deletes the caller's own uid —
  it takes no uid input.
- [ ] Given the Firestore delete succeeds but the Auth delete fails, when the function returns,
  then it reports an `internal` error, and calling it again finishes the job (idempotent).
- [ ] Given shared data (`questions`, `topics`, `baselineTests`), when an account is deleted, then
  it's untouched.

## Data and API
- **Auth**: enable Google and Apple sign-in providers. Anonymous stays enabled.
- **Cloud Functions**: callable `deleteAccount()` — no input. Admin SDK
  `recursiveDelete(users/{uid})`, then `auth().deleteUser(uid)`. Returns `{ deleted: true }`.
- **Firestore / rules**: no changes. Client deletes of `users/{uid}` stay denied (ph-9-us-2).

## Dependencies
- **Blocked by**: none (the functions project exists, ph-1-us-4).
- **Parent**: ph-9-us-8 — the server side of linking and deletion.
- **Consumed by**: ph-9-us-10.
- **Keep in sync**: any new per-user subcollection (Phase 5 outcomes, Phase 6 driving sessions)
  is covered automatically by the recursive delete; note this in those phases' stories.

## Test Notes
- **Happy path**: emulator test seeds a user with every subcollection, calls `deleteAccount`, and
  checks nothing is left under `users/{uid}` and the Auth user is gone (Auth emulator).
- **Edge cases**: user with no profile doc (still deletes the Auth user); second call after a
  partial failure.
- **Failure modes**: unauthenticated; Auth delete failure surfaces `internal`.

## Tasks
- [ ] Enable Google and Apple providers in both Firebase projects; record the setup steps in the
  README (SHA-1/SHA-256, Apple service ID and key).
- [ ] Implement `deleteAccount` in `functions/src/`, export it from `index.ts`.
- [ ] Emulator tests (add the Auth emulator to `test:functions` if needed).
- [ ] Document it in `functions/README.md`.

## Questions
- Should anonymous users who never linked have their data cleaned up automatically after a long
  inactivity period (orphaned uids from reinstalls)? Not in MVP scope; flag for Phase 8.
