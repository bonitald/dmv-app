# Record test mode and duration on the Test Attempt

**ID:** ph-3-us-8
**Layer:** Backend
**Parent:** ph-3-us-7
**Status:** Complete (device-tested 2026-11-22, Slice 5b-1)

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
- [x] Given a practice test is submitted with `timing: { mode: 'timed', timeLimitSec, elapsedSec }`
  or `{ mode: 'untimed', elapsedSec }`, when `scoreTest` saves the attempt, then those values are
  stored on it as `timing`.
- [x] Given `timing` is missing, when a practice test is scored, then the attempt is saved with
  `timing: null` — old clients keep working.
- [x] Given `timing` is malformed (unknown mode or not an object), when `scoreTest` runs, then
  `timing` is saved as `null` and grading still succeeds. A bad or out-of-range `elapsedSec`
  (negative, non-numeric, over 24 hours) keeps the mode and saves `elapsedSec: null`. A timed
  record without a valid `timeLimitSec` saves `timing: null`. Bad analytics data must never fail a submission.
- [x] Given a mini-quiz or baseline section is submitted with `timing`, when it's scored, then
  `timing` is ignored (those are always untimed).
- [x] Given a practice test is scored, when `scoreTest` returns, then the result includes the
  saved `timing`, so results can tell whether time ran out.
- [x] Given a timed test that ran out of time, when it's submitted with unanswered questions, then
  grading is unchanged: unanswered questions count as wrong.

## Data and API
- **Cloud Functions**: `scoreTest` input gains optional
  `timing: { mode: 'timed' | 'untimed', timeLimitSec?: number, elapsedSec: number }`. The practice
  `ScoreTestResult` returns the saved `timing`.
- **Firestore schema**: `users/{uid}/testAttempts/{testId}.timing` — the validated object
  (`elapsedSec` may be `null`) or `null`. Practice attempts only.
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
- [x] Add `timing` validation and storage to `scoreTest`.
- [x] Extend `functions/src/scoreTest.test.ts` (`npm run test:functions`).
- [x] Update the `scoreTest` input and persistence sections of `functions/README.md`.

## Questions
None outstanding.

## Implementation notes (Slice 5b-1)
Built in Slice 5b-1 on `feat/timed-tests`; plan `docs/superpowers/plans/2026-11-20-slice-5b1-timed-tests.md`, design `docs/superpowers/specs/2026-11-20-slice-5b1-timed-tests-design.md`. Device-tested on the Android emulator against dev 2026-11-22: everything passed. `assembleTest` and `scoreTest` deployed to `dmv-app-dev` (smoke check 401); no rules or index changes.
- **Decision 6, results know time ran out:** `scoreTest` returns the saved `timing` on practice results. The client computes `timedOut = timing.mode === 'timed' && timing.elapsedSec >= timing.timeLimitSec`, so in-memory results and results reopened from Recent tests use the same rule. No extra stored flag.
- **Decision 10, what `elapsedSec` measures:** wall-clock time from `startedAt` to the submit, including time the app was closed. A bad or out-of-range `elapsedSec` (over 24 hours, negative, non-numeric) keeps the `mode` and saves `elapsedSec: null`, so an untimed test left open for days is still recorded as untimed. A timed record without a valid `timeLimitSec` (finite, above 0, at most 86400) saves `timing: null`. An unknown mode or a non-object saves `null`. Validation never throws.
