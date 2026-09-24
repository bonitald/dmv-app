# Tentative test date and countdown

**ID:** ph-9-us-4
**Layer:** Parent
**Children:** ph-9-us-5 (Frontend)
**Status:** Not Started

## Story
As a teen user,
I want to enter roughly when my written test is (or skip it) and see a countdown on the home screen,
So that I always know how much study time I have left.

## Context
- **Product area**: Phase 9 (`docs/phases.md`, second bullet); `prd.md` Section 5 "First-run
  onboarding + test-date countdown" (Must).
- **Layer**: Frontend. The field and its rule are ph-9-us-2 (`users/{uid}.testDate`, a
  `YYYY-MM-DD` string). No separate Backend child, since that work already lives on ph-9-us-2.
- **Split with Phase 5**: this story captures the date (onboarding), shows the countdown, and lets
  the user change it by tapping the countdown. Phase 5 adds the test outcome: the "how did it go?"
  prompt once the date has passed, and the Test Outcome record. Phase 5's "edit flow" bullet is
  covered by the tap-to-edit here.
- Optional everywhere: skipping never blocks anything.

## Acceptance Criteria
- [ ] Given onboarding, when the user reaches the date step, then they can pick a date or skip.
- [ ] Given a test date is set, when the user opens Home, then a countdown shows ("12 days until
  your test", "Your test is tomorrow", "Test day — good luck!").
- [ ] Given no test date, when the user opens Home, then a small "Add your test date" prompt shows
  instead, which they can dismiss.
- [ ] Given a test date is set, when the user taps the countdown, then they can change or remove
  the date.
- [ ] Given the date has passed, when Home shows, then the countdown is replaced by a neutral card
  that Phase 5 turns into the outcome prompt.

## Dependencies
- **Children**: ph-9-us-5 (date step + countdown card).
- **Backed by**: ph-9-us-2 (profile `testDate`).
- **Handoff**: Phase 5 (outcome prompt after the date, Test Outcome record).
