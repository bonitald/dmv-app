# Firebase project provisioned and wired into the app

**ID:** ph-0-us-2
**Layer:** Parent
**Children:** ph-0-us-3 (Backend), ph-0-us-4 (Frontend)
**Status:** Done (2026-09-07) — both children (ph-0-us-3, ph-0-us-4) done; Firebase is
provisioned in dev/prod and the SDK is wired and verified end-to-end.

## Story
As a developer,
I want a Firebase project provisioned (Firestore, Hosting, Analytics) and wired into the
app via environment config,
So that later phases can read/write real data instead of building against a stub.

## Context
- **Product area**: Phase 0 — Project Foundations
- Per `docs/prd.md` Section 7, Firebase is the chosen backend for hosting question-bank
  content, driving-session/test-outcome logs, and Firebase Analytics for usage/pass-rate
  tracking. This story is the one-time provisioning + wiring; no data model is defined here
  — that's Phase 1 (Question Bank) and later phases' schemas.

## Acceptance Criteria
- [x] Given the Firebase project exists, when a developer runs the app locally, then it
  connects to a **dev/staging** Firebase project — never directly against a prod project
  from a local machine. Default `APP_ENV=development` in `app.config.ts`.
- [x] Given the app is wired to Firebase, when it starts, then Firestore and Analytics SDKs
  initialize successfully with no runtime config errors. Verified live on Android emulator.
- [x] Given environment-specific config (API keys, project IDs) is needed, when the app is
  built for a given environment, then that config is read from environment variables /
  `.env` files (already `.gitignore`d per the repo's existing `.gitignore`), never
  hardcoded or committed. See ph-0-us-4's notes for the `firebase-config/`+`APP_ENV`
  implementation (a deliberate variant on literal `.env.*` files).

## Dependencies
- **Blocked by**: ph-0-us-1 (project scaffold must exist first).
- **Children**: ph-0-us-3 (Backend — provisioning), ph-0-us-4 (Frontend — SDK wiring). Split
  because provisioning the Firebase project itself and integrating its SDK into the Expo app
  are genuinely separate pieces of work with different owners/skills, even though one person
  may do both.
