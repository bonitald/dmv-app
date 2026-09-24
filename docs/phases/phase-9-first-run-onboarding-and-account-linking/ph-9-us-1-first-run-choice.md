# First-run choice: "test what I know" or "learn first"

**ID:** ph-9-us-1
**Layer:** Parent
**Children:** ph-9-us-2 (Backend), ph-9-us-3 (Frontend)
**Status:** Not Started

## Story
As a teen user opening the app for the first time,
I want to choose between finding out what I already know and starting to learn,
So that I start in the place that suits me, without being locked into it.

## Context
- **Product area**: Phase 9 (`docs/phases.md`, first bullet); `prd.md` Section 2 (quick first-time
  orientation) and Section 4 (first-run onboarding, Must).
- **Layer**: cross-cutting.
  - Backend: the choice and the test date live on the user's profile doc `users/{uid}`, which
    today accepts any owner write. ph-9-us-2 defines the fields and tightens the rule.
  - Frontend: ph-9-us-3 builds the onboarding flow and routes into the right starting point.
- **Where each route goes**: "test what I know" → the baseline (ph-3-us-13's `Baseline` route);
  "learn first" → the concept list (ph-2-us-7).
- The choice is **not binding**, and it's **not a success metric** (`prd.md` Section 2). It's
  saved only so onboarding isn't shown again and for simple analytics.
- **Journey position**: this is the first screen a new user sees. It's numbered last because it
  routes into Phase 2 and 3 screens, but in build order it comes as soon as the baseline flow
  exists.

## Acceptance Criteria
- [ ] Given a brand-new install, when the app opens after sign-in, then onboarding shows before
  any tab.
- [ ] Given onboarding, when the user picks "Test what I know", then they land in the baseline
  intro. When they pick "Learn first", they land on the concept list.
- [ ] Given the user has finished onboarding, when they open the app again, then onboarding
  doesn't show; they land on Home (ph-9-us-7).
- [ ] Given either choice, when the user is anywhere in the app afterward, then they can still
  start a test or open any concept.

## Dependencies
- **Children**: ph-9-us-2 (profile fields + rules), ph-9-us-3 (onboarding flow).
- **Routes into**: ph-3-us-13 (baseline), ph-2-us-7 (concept list).
- **Related**: ph-9-us-4 (test date step in the same flow), ph-9-us-6 (Home after onboarding).
