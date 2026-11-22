# `assembleTest` avoids repeating a user's recent questions

**ID:** ph-3-us-6
**Layer:** Backend
**Parent:** ph-3-us-5
**Status:** Complete (device-tested 2026-11-22, Slice 5b-1)

## Story
As a developer,
I want `assembleTest` to skip questions the caller saw in their last few practice tests, when the
approved pool is big enough,
So that back-to-back practice tests feel distinct without the client having to track anything.

## Context
- **Product area**: Phase 3 (`docs/phases.md`, third bullet).
- **Layer**: Backend (Cloud Functions).
- Repeat-avoidance is server-side, which works across devices and needs no client input.
  (Originally proposed: read `testAssignments`. Changed in Slice 5b-1, decision 1: read the last
  graded practice attempts instead; see Implementation notes.)
  (`assembleMiniQuiz` takes a client `excludeIds` instead; that's fine for a single topic's
  retake, but practice tests should not rely on the client.)
- Changes the same selection code as ph-3-us-3 (fact/scenario mix, topic cap). Repeat-avoidance
  is a preference, applied inside those rules: first try to fill the test from unseen questions,
  then top up from seen ones.
- Follows the `cloud-function-documentation` skill.

## Acceptance Criteria
- [x] Given a user's last `RECENT_TESTS_TO_AVOID` practice attempts, when a new test is
  assembled, then questions from those attempts are excluded if enough unseen approved
  questions remain to fill the test.
- [x] Given too few unseen questions remain, when a test is assembled, then it's topped up with
  previously seen questions (chosen at random) — the test is never short because of
  repeat-avoidance.
- [x] Given repeat-avoidance and ph-3-us-3's scenario minimum and topic cap conflict, when a test
  is assembled, then the scenario minimum wins over repeat-avoidance, and repeat-avoidance wins
  over the topic cap.
- [x] Given a user has no previous practice tests, when a test is assembled, then behavior is
  the same as before (no extra constraint).
- [x] Given mini-quiz and baseline assignments, when recent tests are looked up, then only
  `type == 'practice'` attempts count.

## Data and API
- **Cloud Functions**: `assembleTest` — reads the caller's recent practice assignments before
  selecting. Contract unchanged.
- **Firestore reads**: `users/{uid}/testAttempts` where `type == 'practice'`, ordered by
  `createdAt` desc, limit `RECENT_TESTS_TO_AVOID` (3), reading each `perQuestion[].questionId`.
  Uses the existing `type` + `createdAt` index from Slice 5a: no new index.
- **Security rules**: no changes (Admin SDK read; clients already read-only on
  `testAssignments`).

## Dependencies
- **Blocked by**: ph-1-us-4 (Complete). Coordinate with ph-3-us-3 (same code).
- **Parent**: ph-3-us-5 — makes "unlimited" tests actually distinct.

## Test Notes
- **Happy path**: with a large pool, 3 consecutive tests share no questions.
- **Edge cases**: pool of exactly 25 (every test identical, allowed); pool of 40 (second test
  partly repeats); user with only mini-quiz/baseline history; interaction with the scenario
  minimum when most scenario questions were already seen.
- **Failure modes**: assignment docs missing `questionIds` (ignored, no crash).

## Tasks
- [x] Read recent practice assignments and build the "recently seen" set.
- [x] Apply preference-then-top-up inside ph-3-us-3's selection function.
- [x] Add the composite index if the emulator/production requires it (not needed: the Slice 5a index is reused).
- [x] Extend `functions/src/assembleTest.test.ts`; document in `functions/README.md`.

## Questions
- `RECENT_TESTS_TO_AVOID = 3` is a starting value; tune with the reviewed bank's size (1415 approved questions, so at most 75 are avoided).

## Implementation notes (Slice 5b-1)
Built in Slice 5b-1 on `feat/timed-tests`; plan `docs/superpowers/plans/2026-11-20-slice-5b1-timed-tests.md`, design `docs/superpowers/specs/2026-11-20-slice-5b1-timed-tests-design.md`. Device-tested on the Android emulator against dev 2026-11-22: everything passed. `assembleTest` and `scoreTest` deployed to `dmv-app-dev` (smoke check 401); no rules or index changes.
- **Decision 1, source of "recently seen":** the last 3 graded practice attempts (`users/{uid}/testAttempts`, `type == 'practice'`, `createdAt` desc), not `testAssignments`. Attempts are questions the teen actually saw; assignments also include tests handed out but never taken (for example a screen closed while `assembleTest` was in flight). It reuses the existing `type` + `createdAt` index, so there is no new index. Attempts without a usable `perQuestion` array, or entries without a string `questionId`, are skipped, not errors.
- **Decision 2, priority:** scenario minimum > repeat-avoidance > topic cap. `selectPracticeQuestions` takes an optional `isSeen`, and its passes are ordered so an unseen question over the topic cap is taken before a seen one under it. With no practice history the result is exactly as before.
- **Decision 3, top-up:** random among seen questions; "oldest first" is dropped because attempts give no cheap oldest order inside the 3, and with the real bank the top-up doesn't run.

