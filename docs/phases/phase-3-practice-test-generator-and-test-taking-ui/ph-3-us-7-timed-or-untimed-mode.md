# Timed or untimed practice test mode

**ID:** ph-3-us-7
**Layer:** Parent
**Children:** ph-3-us-8 (Backend), ph-3-us-9 (Frontend)
**Status:** Not Started

## Story
As a teen user,
I want to choose whether a practice test is timed, with untimed as the default,
So that I can learn without pressure at first, then practice under exam-like time pressure when
I'm ready.

## Context
- **Product area**: Phase 3 (`docs/phases.md`, fourth bullet: "I can choose (or the app defaults
  to) a timed or untimed test mode").
- **Layer**: cross-cutting, mostly Frontend. The timer runs on the device (ph-3-us-9). The
  backend only records which mode was used and how long the test took on the Test Attempt
  (ph-3-us-8), so Phase 4/5 can compare timed and untimed scores.
- **Practice tests only.** The baseline (sections with pause points, `prd.md` Section 4) and
  concept mini-quizzes are always untimed.
- The real Colorado written test is timed: **60 minutes for 25 questions** (`prd.md` Section 9).
  Timed mode uses the same 60-minute limit, so practice matches exam conditions.

## Acceptance Criteria
- [ ] Given the user starts a practice test, when they haven't chosen a mode, then it's untimed.
- [ ] Given the user picks timed mode before starting, when the test runs, then a 60-minute
  countdown is visible, and the test is submitted automatically when time runs out.
- [ ] Given a practice test is graded, when its Test Attempt is saved, then the attempt records
  the mode and how long the test took.

## Dependencies
- **Children**: ph-3-us-8 (record mode/duration), ph-3-us-9 (mode picker + timer).
- **Builds on**: ph-3-us-4 (runner), ph-3-us-1 (persisted state, so a timed test survives a
  force-quit).
