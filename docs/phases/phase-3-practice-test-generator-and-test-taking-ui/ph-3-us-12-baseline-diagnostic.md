# Take the baseline diagnostic, with pauses between sections

**ID:** ph-3-us-12
**Layer:** Parent
**Children:** ph-3-us-13 (Frontend)
**Status:** In Progress (code-complete 2026-09-25 via ph-3-us-13; closes after device testing, which needs `baselineTests/v1` published)

## Story
As a teen user,
I want to take a one-time baseline test in three short sections, and stop between sections and
come back later,
So that I find out where I stand across the whole handbook without having to sit through 45
questions at once.

## Context
- **Product area**: Phase 3 (`docs/phases.md`, seventh bullet); `prd.md` Section 4 "Baseline
  diagnostic" and Section 5 (Must).
- **Layer**: Frontend only. The backend was built in Phase 1:
  - `startOrResumeBaseline` (ph-1-us-8) serves the user's current section (15 questions, handbook
    order, same fixed set for every user) from server-side progress in
    `users/{uid}/baseline/progress`, so a paused baseline resumes on any device.
  - `scoreTest` (ph-1-us-11) grades each section, advances progress, holds back answers until the
    last section, then returns `baselineReview` and sets `completedAt` / `freeTestUsedAt`.
  No Backend child is needed: it would be empty.
- **Where it sits in the user journey**: this is the "test what I know" route of first-run
  onboarding (Phase 9), and it's also reachable any time from the Practice tab until it's done.
  Results are Phase 4 ("got it / missed it" per topic, `prd.md` Section 4).

## Acceptance Criteria
- [ ] Given a user who hasn't started the baseline, when they start it, then section 1 (15
  questions) opens in the test runner.
- [ ] Given a user finishes section 1 or 2, when it's graded, then they're asked whether to keep
  going or take a break, and both are fine.
- [ ] Given a user took a break (or closed the app, or switched devices), when they come back to
  the baseline, then it resumes at the next unfinished section.
- [ ] Given a user finishes section 3, when it's graded, then the baseline is complete, and they
  go to their baseline results (Phase 4).
- [ ] Given a user has completed the baseline, when they look for it again, then it's shown as
  done (with a link to its results), not offered again.

## Dependencies
- **Children**: ph-3-us-13 (baseline flow UI).
- **Built in Phase 1**: ph-1-us-8 (`startOrResumeBaseline`, baseline content), ph-1-us-11
  (`scoreTest` baseline grading).
- **Related**: ph-3-us-14 (baseline recorded separately; complete), Phase 4 (baseline results),
  Phase 9 (first-run route into the baseline).
