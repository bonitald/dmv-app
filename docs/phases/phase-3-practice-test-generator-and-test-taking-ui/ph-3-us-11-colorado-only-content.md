# Colorado-only content, no state selector

**ID:** ph-3-us-11
**Layer:** Parent
**Status:** Not Started

## Story
As a teen user,
I want everything I study and every test I take to be about Colorado's rules,
So that I'm not confused by other states' laws or asked to pick a state.

## Context
- **Product area**: Phase 3 (`docs/phases.md`, sixth bullet); `prd.md` scopes MVP to Colorado
  only.
- **Layer**: Frontend (copy/UI) with a content check. No Backend split: there is one question
  bank, built only from the CO DMV handbook (DR 2337) by the ingestion pipeline, with no state
  field and no multi-state support to add. A backend child would be empty.
- This is mostly a guardrail: it's satisfied by *not* building something (a state picker), plus
  making sure the copy says Colorado where it matters.

## Acceptance Criteria
- [ ] Given any screen in the app, when it's reviewed, then there's no state selector, state
  setting, or "choose your state" onboarding step.
- [ ] Given the Practice tab and the baseline intro, when they render, then their copy says the
  tests are based on the Colorado driver handbook.
- [ ] Given questions in the bank, when content is reviewed (the human review already underway),
  then any question that depends on another state's rule, or on federal/general info that
  contradicts CO law, is flagged or rejected — checked as part of review, not by code.

## UI/UX Notes
- One short line on the Practice tab home and the baseline intro, e.g. "Based on the Colorado
  Driver Handbook". Keep "DMV" wording consistent with the app name decision (still a
  placeholder, `docs/design/mockups.md`).

## Dependencies
- **Uses**: ph-3-us-4 (Practice tab home), ph-3-us-13 (baseline intro).
- Content review is tracked outside the story docs (`phase-1-summary.md`).

## Test Notes
- **Happy path**: walk every tab and first-run screen; no state choice anywhere.
- **Edge cases**: none.
- **Failure modes**: none.

## Tasks
- [ ] Add the Colorado line to the Practice tab home and baseline intro copy.
- [ ] Add "no other-state rules" to the content review checklist in
  `scripts/question-bank/README.md`.

## Questions
None outstanding.
