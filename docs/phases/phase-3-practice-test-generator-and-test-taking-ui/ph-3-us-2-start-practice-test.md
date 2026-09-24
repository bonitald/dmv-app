# Start a practice test that mixes fact and scenario questions

**ID:** ph-3-us-2
**Layer:** Parent
**Children:** ph-3-us-3 (Backend), ph-3-us-4 (Frontend)
**Status:** Not Started

## Story
As a teen user,
I want to start a practice test built from the question bank that mixes plain fact questions with
"what do you do here" scenario questions,
So that I rehearse the real written test the way it's actually asked, not just recall isolated
facts.

## Context
- **Product area**: Phase 3 (`docs/phases.md`, first bullet); `prd.md` Section 5 "Practice test
  generator" and "Scenario/situational question set" (both Must). Scenario questions are the
  app's core differentiator (`prd.md` Section 1).
- **Layer**: cross-cutting.
  - Backend: `assembleTest` (ph-1-us-4) exists but picks 25 questions fully at random, so a test
    isn't guaranteed to include any scenario questions. ph-3-us-3 adds a guaranteed mix.
  - Frontend: nothing exists yet — the Practice tab is still a placeholder. ph-3-us-4 builds the
    test-taking screen, which is also the shared quiz runner for the baseline (ph-3-us-13) and the
    concept mini-quiz (ph-2-us-8).
- Grading and the saved Test Attempt already exist (`scoreTest`, ph-1-us-11). Showing the score
  and reviewing answers is Phase 4.

## Acceptance Criteria
- [ ] Given the teen user opens the Practice tab, when they tap "Start a practice test", then a
  new test is assembled and its first question shows.
- [ ] Given a test is assembled, when its questions are inspected, then it contains both fact and
  scenario questions whenever the approved bank has both.
- [ ] Given the user answers the questions and submits, when grading finishes, then the attempt
  is saved (ph-1-us-11) and the user moves on to their results (Phase 4).

## Dependencies
- **Children**: ph-3-us-3 (mix in `assembleTest`), ph-3-us-4 (test-taking screen).
- **Built in Phase 1**: `assembleTest` (ph-1-us-4), `scoreTest` (ph-1-us-11).
- Related: ph-3-us-1 (offline/force-quit resilience for the same screen), Phase 4 (results).
