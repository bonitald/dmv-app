# "Save your progress": link to a real sign-in and recover on a new phone

**ID:** ph-9-us-8
**Layer:** Parent
**Children:** ph-9-us-9 (Backend), ph-9-us-10 (Frontend)
**Status:** Not Started

## Story
As a teen user,
I want to save my progress to a real sign-in when it's worth it, and sign in on a new phone to get
it back,
So that I don't lose my baseline, study progress or driving log when I change or reset my phone.

## Context
- **Product area**: Phase 9 (`docs/phases.md`, third bullet); `prd.md` Section 7 (auth: anonymous
  plus optional linking) and Section 8 (compliance).
- **Layer**: cross-cutting.
  - Backend (ph-9-us-9): enable sign-in providers, and an account-deletion function. Apple
    requires in-app account deletion once accounts exist, and the client can't delete the
    server-owned subcollections (rules deny writes there).
  - Frontend (ph-9-us-10): prompts at the right moments, linking, signing in on a new phone,
    Settings with account status, sign-out and delete.
- **Linking keeps the uid** (Firebase `linkWithCredential`), so everything already under
  `users/{uid}` just stays. There's no data migration.
- **Only email and auth ID are collected**, held by Firebase Auth. Nothing about the account is
  copied into Firestore, and no name or profile (`prd.md` Section 7).
- **Providers** (`prd.md` Section 9, open): recommendation is **Apple + Google**. Apple is required
  on iOS if Google is offered. Email link is optional. The stories assume Apple (iOS) + Google (both
  platforms), email link deferred.
- **Never a wall**: offered at high-value moments — after baseline results (ph-4-us-6), before
  driving-log export (Phase 7) — and always available in Settings.

## Acceptance Criteria
- [ ] Given an anonymous user at a prompt moment or in Settings, when they choose Google or Apple
  and finish sign-in, then their account is linked, the uid is unchanged, and all their data is
  still there.
- [ ] Given a user on a new phone, when they sign in with the same provider, then they get their
  previous data (baseline, concept progress, attempts, test date).
- [ ] Given a prompt, when the user dismisses it, then nothing is blocked and that moment doesn't
  prompt again.
- [ ] Given any user, when they choose "Delete my data" in Settings and confirm, then all their
  server data and their account are deleted, and the app starts fresh.

## Dependencies
- **Children**: ph-9-us-9 (providers + deleteAccount), ph-9-us-10 (linking UI, Settings).
- **Prompt moments**: ph-4-us-6 (after baseline results), Phase 7 (before export — to add when
  Phase 7's stories are written).
