# Persistent anonymous device identifier on first launch

**ID:** ph-0-us-5
**Layer:** Parent
**Children:** ph-0-us-6 (Backend), ph-0-us-7 (Frontend)
**Status:** Done (2026-09-07) — both children (ph-0-us-6, ph-0-us-7) done and verified
end-to-end on Android emulator.

## Story
As a teen user,
I want the app to assign me a persistent anonymous device identifier on first launch, with
no signup/login screen,
So that my practice history, driving log, and pass/fail report can be linked together
across sessions on this device without any account-creation friction.

## Context
- **Product area**: Phase 0 — Project Foundations
- Per `docs/prd.md` Section 7 (Auth) and Section 9 (Open Questions), MVP auth is
  anonymous/device-based, not email/social login — this minimizes COPPA/privacy exposure
  for minor users (Section 8) and matches the "no signup friction" MVP goal (Section 2).
- **Known limitation, carried from `docs/prd.md` Section 9**: this identifier does **not**
  survive a reinstall or device switch. This story doesn't attempt to solve that — it's an
  explicit MVP tradeoff — but does require surfacing the limitation to the user before it
  can cause silent data loss (see ph-0-us-7's acceptance criteria).

## Acceptance Criteria
- [x] Given a user opens the app for the very first time, when it launches, then a device
  identifier is created and persisted with no visible signup/login step in front of it.
- [x] Given the identifier exists, when the user returns to the app on subsequent sessions
  (same install), then the same identifier is reused, not regenerated. Verified via
  force-stop + relaunch on the emulator.
- [x] Given the identifier is meant to link data across the app, when any per-user record is
  written in a later phase (practice test attempts, driving sessions, test outcome), then it
  can be scoped to this identifier in Firestore. Enforced by `firestore.rules`'
  `users/{uid}/{document=**}` rule; every later phase's per-user collections nest under it.

## Dependencies
- **Blocked by**: ph-0-us-2 (Firebase must be wired before device-scoped data can be
  written).
- **Children**: ph-0-us-6 (Backend — Firestore schema/rules for device-scoped data),
  ph-0-us-7 (Frontend — generating and persisting the identifier itself, plus surfacing the
  reinstall-loss limitation).
