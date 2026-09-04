# Provision the Firebase project (Firestore, Hosting, Analytics)

**ID:** ph-0-us-3
**Layer:** Backend
**Parent:** ph-0-us-2
**Status:** Not Started

## Story
As a developer,
I want a Firebase project created with Firestore, Hosting, and Analytics enabled, separate
dev/staging/prod environments, and least-privilege service credentials,
So that the app has real backend infrastructure to build against and prod data stays
isolated from local development.

## Context
- **Product area**: Phase 0 — Project Foundations
- **Layer**: Backend (Firebase provisioning)
- Per `docs/prd.md` Section 7, no custom API/server is planned for MVP — Firebase is used
  directly as a BaaS, so "backend" work in this app means Firebase project config, Firestore
  security rules, and Cloud Functions, not a separate service.
- Scale is expected to be small (hundreds–low thousands of users per `docs/prd.md` Section
  8), so this story provisions on Firebase's free/Spark or low-tier Blaze plan — no need to
  plan for high-scale infra here.

## Acceptance Criteria
- [ ] Given the app needs isolated environments, when the Firebase project(s) are created,
  then dev/staging and prod are separate Firebase projects (not a single project with
  environment-prefixed collections), so a bug in dev/staging cannot touch prod data.
- [ ] Given Firestore is enabled, when the database is created, then it starts in a locked
  (deny-all) security-rules mode — no collection is open to public read/write by default;
  actual rules are defined per-collection starting in Phase 1.
- [ ] Given Firebase Hosting is enabled, when checked, then it's provisioned but unused for
  MVP (the app is mobile-only per `docs/prd.md` Section 7) — noted as available for a future
  web/admin surface, not actively deployed to in this story.
- [ ] Given Firebase Analytics is enabled, when the project is provisioned, then it's ready
  to receive events once the app SDK is wired in (ph-0-us-4) — no custom events are defined
  in this story.
- [ ] Given developers need local access, when a service account / API key is issued for
  each environment, then it's scoped to that environment only and never checked into the
  repo (`.env` pattern per ph-0-us-4).

## Data and API
- **Firestore schema changes**: None yet — database created empty; schema starts in Phase 1
  (Question Bank).
- **Security rules**: Default deny-all on project creation. Per-collection rules are out of
  scope for this story and begin in Phase 1.
- **Cloud Functions**: None provisioned in this story — no functions exist yet.

## Dependencies
- **Blocked by**: None.
- **Parent**: ph-0-us-2 — this is the "provision" half of "provisioned and wired."

## Test Notes
- **Happy path**: A developer can open the Firebase console for the dev project and see
  Firestore (empty, locked), Hosting (provisioned, no deploys), and Analytics (enabled)
  all present.
- **Edge cases**: A developer accidentally targets the prod project locally — should be
  structurally prevented by ph-0-us-4's environment-config pattern, not just a warning.
- **Failure modes**: Firestore rules left in test-mode (open read/write, Firebase's default
  for a 30-day trial) instead of locked — must be explicitly set to deny-all, not left at
  whatever the console's quick-start default is.

## Tasks
- [ ] Create separate Firebase projects for dev/staging and prod.
- [ ] Enable Firestore (native mode) on each, with security rules explicitly set to deny-all
  by default rather than left on Firebase's test-mode default.
- [ ] Enable Hosting (provisioned only, no deploy) and Analytics on each.
- [ ] Issue environment-scoped API keys/config and hand them off for ph-0-us-4's `.env`
  wiring — not committed anywhere in this story.

## Questions
- None outstanding.
