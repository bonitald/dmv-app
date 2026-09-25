# Timed mode picker and countdown

**ID:** ph-3-us-9
**Layer:** Frontend
**Parent:** ph-3-us-7
**Status:** Not Started

## Story
As a teen user,
I want to switch a practice test to timed mode before I start and see how much time is left,
So that I can practise working at exam pace.

## Context
- **Product area**: Phase 3 (`docs/phases.md`, fourth bullet).
- **Layer**: Frontend (Expo/React Native).
- Backed by ph-3-us-8 (`scoreTest` stores `timing`) — not built yet. Until it lands, the client
  can send `timing` and the server will ignore it.
- **Timer from a saved start time, not an in-memory counter.** The same principle as
  `docs/phase-0-findings.md` for the driving timer: save the start timestamp when the test starts,
  and always compute remaining time as `limit − (now − startedAt)`. A killed or backgrounded app
  can't lose or pause the clock. `startedAt` is saved alongside the test's cache entry
  (ph-3-us-1).
- The clock keeps running while the app is in the background or closed, as it would in a real
  exam room.
- Practice tests only; the baseline and mini-quizzes never show a timer.
- **Time limit: 60 minutes**, the same as the real Colorado written test (25 questions,
  `prd.md` Section 9). Keep it as one constant (`TIMED_TEST_LIMIT_SEC = 3600`).

## Acceptance Criteria
- [ ] Given the Practice tab, when the user is about to start a test, then they can switch between
  "Untimed" (default) and "Timed — 60 min, like the real test" before starting.
- [ ] Given the user's last choice, when they start their next test, then the switch remembers it
  (stored locally).
- [ ] Given a timed test is running, when any question is showing, then the remaining time is
  visible, and a gentle warning appears at 5 minutes and 1 minute left.
- [ ] Given a timed test reaches zero, when time runs out, then the answers so far are submitted
  automatically (unanswered count as wrong), and the user is told time ran out.
- [ ] Given a timed test is in progress, when the app is backgrounded or killed and reopened
  (ph-3-us-1 resume), then the remaining time reflects the real elapsed time. If time already
  ran out, the test is submitted as soon as it's resumed, instead of letting the user continue.
- [ ] Given any practice test is submitted (timed or not), when `scoreTest` is called, then it
  includes `timing` with the mode, limit (if timed), and elapsed seconds.
- [ ] Given an untimed test, when it runs, then no countdown shows (elapsed time is still
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
- **Backed by**: ph-3-us-8 (not built yet).
- **Blocked by**: ph-3-us-4 (runner), ph-3-us-1 (persisted test state for `startedAt`).

## Test Notes
- **Happy path**: timed test, answer everything before time; timed test left to expire.
- **Edge cases**: background the app for longer than the remaining time, then return; device
  clock changed mid-test; submit exactly at zero (one submission only).
- **Failure modes**: auto-submit while offline; app killed after expiry but before submit.

## Tasks
- [ ] Add a pure `remainingSeconds(startedAt, limitSec, now)` helper, unit-tested with
  `npm run test:app`.
- [ ] Add the mode switch and remember the last choice locally (AsyncStorage).
- [ ] Add the countdown to the runner, with warnings and auto-submit.
- [ ] Save `startedAt` with the test's cache entry (coordinate with ph-3-us-1) and handle
  "expired while closed" on resume.
- [ ] Send `timing` with every practice-test submission.

## Questions
- Should the clock pause while the app is in the background? Assumed no (exam-like). Pausing is
  easy to game and makes "timed" meaningless.
