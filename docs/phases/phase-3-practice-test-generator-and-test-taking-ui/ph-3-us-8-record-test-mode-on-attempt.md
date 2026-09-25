# Record test mode and duration on the Test Attempt

**ID:** ph-3-us-8
**Layer:** Backend
**Parent:** ph-3-us-7
**Status:** Not Started

## Story
As a product owner,
I want each practice test's attempt to record whether it was timed and how long it took,
So that later reporting (Phase 4 score comparison, Phase 5 pass-rate analysis) can tell timed
practice apart from relaxed practice.

## Context
- **Product area**: Phase 3 (`docs/phases.md`, fourth and fifth bullets).
- **Layer**: Backend (Cloud Functions).
- `scoreTest` (ph-1-us-11) writes `users/{uid}/testAttempts/{testId}` and takes
  `{ testId, answers }`. This story adds one optional input, `timing`, and saves it on the
  attempt.
- `timing` is **client-reported** and used only for analytics, never for grading. It's validated
  for shape and range, not trusted for anything else.
- Follows the `cloud-function-documentation` skill.

## Acceptance Criteria
- [ ] Given a practice test is submitted with `timing: { mode: 'timed', timeLimitSec, elapsedSec }`
  or `{ mode: 'untimed', elapsedSec }`, when `scoreTest` saves the attempt, then those values are
  stored on it as `timing`.
- [ ] Given `timing` is missing, when a practice test is scored, then the attempt is saved with
  `timing: null` — old clients keep working.
- [ ] Given `timing` is malformed (unknown mode, negative or non-numeric seconds, `elapsedSec`
  over 24 hours), when `scoreTest` runs, then `timing` is saved as `null` and grading still
  succeeds. Bad analytics data must never fail a submission.
- [ ] Given a mini-quiz or baseline section is submitted with `timing`, when it's scored, then
  `timing` is ignored (those are always untimed).
- [ ] Given a timed test that ran out of time, when it's submitted with unanswered questions, then
  grading is unchanged: unanswered questions count as wrong.

## Data and API
- **Cloud Functions**: `scoreTest` input gains optional
  `timing: { mode: 'timed' | 'untimed', timeLimitSec?: number, elapsedSec: number }`.
- **Firestore schema**: `users/{uid}/testAttempts/{testId}.timing` — the validated object or
  `null`. Practice attempts only.
- **Security rules**: no changes (attempts stay server-written, client-read-only).

## Dependencies
- **Blocked by**: ph-1-us-11 (Complete).
- **Parent**: ph-3-us-7 — the saved record of which mode was used.
- **Consumed by**: ph-3-us-9 (sends `timing`), Phase 4/5 reporting.

## Test Notes
- **Happy path**: timed and untimed submissions store the right `timing`.
- **Edge cases**: no `timing` (null); `timing` on a mini-quiz (ignored); `elapsedSec` of 0.
- **Failure modes**: malformed `timing` → null, and the score is still returned.

## Tasks
- [ ] Add `timing` validation and storage to `scoreTest`.
- [ ] Extend `functions/src/scoreTest.test.ts` (`npm run test:functions`).
- [ ] Update the `scoreTest` input and persistence sections of `functions/README.md`.

## Questions
None outstanding.
