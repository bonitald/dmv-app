# Sign in anonymously and persist device identity on first launch

**ID:** ph-0-us-7
**Layer:** Frontend
**Parent:** ph-0-us-5
**Status:** Done (2026-09-07) — core flow verified end-to-end on Android emulator: first
launch signs in anonymously with no visible UI, creates `users/{uid}`, and a relaunch
restores the same session (same `uid`/`creationTime`, no second `signInAnonymously` call).
The offline/no-connection path is implemented but not device-tested — see AC4 below.

## Story
As a teen user,
I want the app to sign me in anonymously the first time I open it, with no visible
signup/login screen,
So that I can start studying immediately and my activity is linked to this device going
forward.

## Context
- **Product area**: Phase 0 — Project Foundations
- **Layer**: Frontend (Expo/React Native)
- Implements the client side of ph-0-us-6's `signInAnonymously()` + rules-enforced identity
  approach. The resulting `request.auth.uid` is the identifier referenced everywhere else in
  `docs/phases.md` as "device identifier."
- Must surface the reinstall/device-switch data-loss limitation (`docs/prd.md` Section 9) at
  the point it becomes relevant, not bury it — this story defines the "before driving-log
  export" trigger point called out in `docs/phases.md`'s Phase 0 entry.

## Acceptance Criteria
- [x] Given a user opens the app for the first time, when it launches, then
  `signInAnonymously()` is called automatically and completes with no user-visible
  login/signup UI. Verified live on Android emulator via logcat (`Auth: signInAnonymously` →
  `signInAnonymously:onComplete:success`) — no auth UI rendered, per `src/auth/AuthProvider.tsx`.
- [x] Given anonymous sign-in succeeds, when it's the very first sign-in for this
  install, then the `users/{uid}` document (ph-0-us-6) is created client-side with
  `createdAt` set. Verified: on-screen smoke test read back "Firebase OK" after writing
  under `users/{uid}/_smoke_test/...`, which only succeeds if the `users/{uid}` doc write
  (and rules check) went through.
- [x] Given the user closes and reopens the app, when it launches again, then the existing
  Firebase Auth session is restored automatically — no new anonymous user is created, and no
  second `users/{uid}` document is written. Verified: force-stop + relaunch showed the exact
  same `uid` and `creationTime` in the auth-state event, with no second
  `Auth: signInAnonymously` log line.
- [~] Given the app is offline on first launch, when `signInAnonymously()` cannot complete,
  then the app shows a clear "no connection" state rather than crashing or silently
  proceeding as if signed in — since all later phases depend on `request.auth.uid` existing.
  Implemented (`AuthProvider`'s `status: 'offline'` branch + `NoConnectionScreen` with a
  retry button in `App.tsx`), but **not device-tested** — didn't simulate airplane
  mode/no-network on the emulator as part of this pass.
- [x] Given a user is about to export their driving log (Phase 7) or has meaningfully
  accumulated data, when they encounter a point where the reinstall/device-switch data-loss
  risk becomes relevant, then the app has a defined place to surface that limitation (the
  actual copy/placement is Phase 7's concern; this story only guarantees the underlying
  identity is stable enough to reason about, and exposes whether an anonymous session
  exists so later phases can build the warning on top of it). `useAuth()` exposes
  `{ status, uid }` app-wide for exactly this purpose.

## UI/UX Notes
- **Screens/flows**: No dedicated login/signup screen. Sign-in happens behind a brief app
  launch/splash state.
- **Empty/error/offline states**: A no-connection state on first launch (see acceptance
  criteria) — the app cannot function without an anonymous session, so this is a real
  blocking state, not a silent degradation.
- **Analytics events**: Log a `first_open_signed_in` (or equivalent) Analytics event on
  successful first-time anonymous sign-in, since Firebase Analytics is already wired
  (ph-0-us-4) and this is the natural first funnel event for the app.

## Dependencies
- **Blocked by**: ph-0-us-4 (Firebase SDK must be wired in).
- **Parent**: ph-0-us-5 — this is the client-side half of the device-identity story.
- **Backed by**: ph-0-us-6 (Firestore rules enforcing the identity). Not yet built as of this
  story's authoring — sequence ph-0-us-6 before or alongside this story so the client isn't
  writing against unenforced rules.

## Test Notes
- **Happy path**: First launch signs in anonymously and creates `users/{uid}` with no visible
  auth UI; subsequent launches restore the same session without re-creating the document.
- **Edge cases**: App is force-quit mid-first-launch before sign-in completes — relaunching
  should retry sign-in cleanly rather than getting stuck in a bad state; app is opened
  offline for the very first time ever (no prior session to restore) — shows the
  no-connection state until connectivity returns.
- **Failure modes**: `signInAnonymously()` fails for a reason other than connectivity (e.g.
  Anonymous Auth disabled in the Firebase console for that environment, per ph-0-us-6's
  setup task) — should fail visibly/loggably, not silently leave the app in a state where
  later Firestore calls fail with confusing permission errors.

## Tasks
- [x] Call `signInAnonymously()` on app launch if no existing session is restored. See
  `src/auth/AuthProvider.tsx`'s `onAuthStateChanged` handler + `attemptSignIn()`.
- [x] On first-ever successful sign-in, create the `users/{uid}` document (`createdAt`).
  `ensureUserDocument()` reads first, only writes if the doc doesn't already exist.
- [x] Handle the offline-on-first-launch case with a dedicated no-connection UI state.
  `AuthProvider` sets `status: 'offline'` on `auth/network-request-failed`; `App.tsx` renders
  `NoConnectionScreen` with a retry button. Implemented, not device-tested (no
  airplane-mode/no-network run performed).
- [x] Log the first-sign-in Analytics event. `first_open_signed_in`, logged only inside
  `ensureUserDocument()`'s first-write branch (not on every launch).
- [x] Expose the current `uid`/auth-ready state via app-wide state (context/store) so every
  later phase's Firestore reads/writes can depend on it without re-deriving identity logic.
  `useAuth()` hook (`{ status, uid, error, retry }`).

## Questions
- None outstanding.
