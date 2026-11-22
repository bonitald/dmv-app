# Timed mode picker and countdown

**ID:** ph-3-us-9
**Layer:** Frontend
**Parent:** ph-3-us-7
**Status:** Complete (device-tested 2026-11-22, Slice 5b-1)

## Story
As a teen user,
I want to switch a practice test to timed mode before I start and see how much time is left,
So that I can practise working at exam pace.

## Context
- **Product area**: Phase 3 (`docs/phases.md`, fourth bullet).
- **Layer**: Frontend (Expo/React Native).
- Backed by ph-3-us-8 (`scoreTest` stores `timing`), built in the same slice.
- **Timer from a saved start time, not an in-memory counter.** The same principle as
  `docs/phase-0-findings.md` for the driving timer: save the start timestamp when the test starts,
  and always compute remaining time as `limit − (now − startedAt)`. A killed or backgrounded app
  can't lose or pause the clock. `startedAt` is saved on the saved practice session
  (ph-3-us-1).
- The clock keeps running while the app is in the background or closed, as it would in a real
  exam room.
- Practice tests only; the baseline and mini-quizzes never show a timer.
- **Time limit: 60 minutes**, the same as the real Colorado written test (25 questions,
  `prd.md` Section 9). Keep it as one constant (`TIMED_TEST_LIMIT_SEC = 3600`).

## Acceptance Criteria
- [x] Given the Practice tab, when the user is about to start a test, then they can switch between
  "Untimed" (default) and "Timed — 60 min, like the real test" before starting.
- [x] Given the user's last choice, when they start their next test, then the switch remembers it
  (stored locally).
- [x] Given a timed test is running, when any question is showing, then the remaining time is
  visible, and a gentle warning appears at 5 minutes and 1 minute left.
- [x] Given a timed test reaches zero, when time runs out, then the answers so far are submitted
  automatically (unanswered count as wrong), and the user is told time ran out.
- [x] Given a timed test is in progress, when the app is backgrounded or killed and reopened
  (ph-3-us-1 resume), then the remaining time reflects the real elapsed time. If time already
  ran out, the test is submitted as soon as it's resumed, instead of letting the user continue.
- [x] Given a timed test has already run out, when the Practice tab shows its resume card, then
  the card shows only "Open to submit" (no Discard), and "Start a new test" opens the expired test
  so it is graded first (decision 11).
- [x] Given any practice test is submitted (timed or not), when `scoreTest` is called, then it
  includes `timing` with the mode, limit (if timed), and elapsed seconds.
- [x] Given an untimed test, when it runs, then no countdown shows (elapsed time is still
  measured for `timing`).

## UI/UX Notes
- **Screens/flows**: the mode switch sits on the Practice tab home next to "Start a practice
  test" (ph-3-us-4). The countdown is a small pill in the runner's header, turning to the alert
  color in the last minute.
- **Empty/error/offline states**: auto-submit while offline follows ph-3-us-4's offline-submit
  behavior. Answers are frozen, kept, and retried; the user can't keep answering after time is
  up.

## Dependencies
- **Parent**: ph-3-us-7 — the user-facing mode choice and timer.
- **Backed by**: ph-3-us-8 (built).
- **Blocked by**: ph-3-us-4 (runner), ph-3-us-1 (persisted test state for `startedAt`).

## Test Notes
- **Happy path**: timed test, answer everything before time; timed test left to expire.
- **Edge cases**: background the app for longer than the remaining time, then return; device
  clock changed mid-test; submit exactly at zero (one submission only).
- **Failure modes**: auto-submit while offline; app killed after expiry but before submit.

## Tasks
- [x] Add a pure `remainingSeconds(startedAt, limitSec, now)` helper, unit-tested with
  `npm run test:app`.
- [x] Add the mode switch and remember the last choice locally (AsyncStorage).
- [x] Add the countdown to the runner, with warnings and auto-submit.
- [x] Save `startedAt` with the test's cache entry (coordinate with ph-3-us-1) and handle
  "expired while closed" on resume.
- [x] Send `timing` with every practice-test submission.

## Questions
- Should the clock pause while the app is in the background? Assumed no (exam-like). Pausing is
  easy to game and makes "timed" meaningless.

## Implementation notes (Slice 5b-1)
Built in Slice 5b-1 on `feat/timed-tests`; plan `docs/superpowers/plans/2026-11-20-slice-5b1-timed-tests.md`, design `docs/superpowers/specs/2026-11-20-slice-5b1-timed-tests-design.md`. Device-tested on the Android emulator against dev 2026-11-22: everything passed. `assembleTest` and `scoreTest` deployed to `dmv-app-dev` (smoke check 401); no rules or index changes.
- **Decision 4, timing on the saved session:** `quizSession` stores `timing: { mode, timeLimitSec?, startedAt }` (epoch ms) in `startSession`, so it is on the phone before the first question shows. Time left is always `limit - (now - startedAt)`, clamped to `[0, limit]`.
- **Decision 7, open dialogs at zero:** React Native's `Alert` can't be closed from code. Auto-submit goes ahead anyway; the open "Submit?" or "Leave the test?" dialog's buttons become harmless because the screen's guards ignore a second submit.
- **Decision 8, mode preference:** AsyncStorage key `dmv-app:practice-mode:{uid}` (`'timed' | 'untimed'`, missing means untimed). Clearing it on sign-out is a Slice 6 carry-forward.
- **Decision 9, 5a sessions:** a practice session saved by a 5a install has no `timing`, resumes untimed and submits with no `timing` (saved as `null`).
- **Decision 11, an expired timed test is always graded (decided by the user 2026-11-20):** on an expired saved test the resume card shows only "Open to submit", and "Start a new test" (from the tab or "Take another test") opens the expired test, which submits at once. The teen starts fresh from its results. A timed test that hasn't run out can still be discarded. This keeps failed timed runs in the pass-rate data and their questions in repeat-avoidance.
- **Dev-only override:** `EXPO_PUBLIC_TIMED_LIMIT_SEC` (an integer from 1 to 86400) shortens the limit in dev builds only, for device testing. It is ignored in release builds.
