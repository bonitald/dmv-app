# `assembleTest` avoids repeating a user's recent questions

**ID:** ph-3-us-6
**Layer:** Backend
**Parent:** ph-3-us-5
**Status:** Not Started

## Story
As a developer,
I want `assembleTest` to skip questions the caller saw in their last few practice tests, when the
approved pool is big enough,
So that back-to-back practice tests feel distinct without the client having to track anything.

## Context
- **Product area**: Phase 3 (`docs/phases.md`, third bullet).
- **Layer**: Backend (Cloud Functions).
- The server already knows what each user was handed: every `assembleTest` call writes
  `users/{uid}/testAssignments/{testId}` with `type: 'practice'` and `questionIds`. So
  repeat-avoidance can be server-side, which works across devices and needs no client input.
  (`assembleMiniQuiz` takes a client `excludeIds` instead; that's fine for a single topic's
  retake, but practice tests should not rely on the client.)
- Changes the same selection code as ph-3-us-3 (fact/scenario mix, topic cap). Repeat-avoidance
  is a preference, applied inside those rules: first try to fill the test from unseen questions,
  then top up from seen ones.
- Follows the `cloud-function-documentation` skill.

## Acceptance Criteria
- [ ] Given a user's last `RECENT_TESTS_TO_AVOID` practice assignments, when a new test is
  assembled, then questions from those assignments are excluded if enough unseen approved
  questions remain to fill the test.
- [ ] Given too few unseen questions remain, when a test is assembled, then it's topped up with
  previously seen questions (oldest first where possible) — the test is never short because of
  repeat-avoidance.
- [ ] Given repeat-avoidance and ph-3-us-3's scenario minimum and topic cap conflict, when a test
  is assembled, then the scenario minimum wins over repeat-avoidance, and repeat-avoidance wins
  over the topic cap. (Proposed order; see Questions.)
- [ ] Given a user has no previous practice tests, when a test is assembled, then behavior is
  the same as before (no extra constraint).
- [ ] Given mini-quiz and baseline assignments, when recent tests are looked up, then only
  `type == 'practice'` assignments count.

## Data and API
- **Cloud Functions**: `assembleTest` — reads the caller's recent practice assignments before
  selecting. Contract unchanged.
- **Firestore reads**: `users/{uid}/testAssignments` where `type == 'practice'`, ordered by
  `createdAt` desc, limit `RECENT_TESTS_TO_AVOID` (proposed 3). May need a composite index
  (`type` + `createdAt`) in `firestore.indexes.json`.
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
- [ ] Read recent practice assignments and build the "recently seen" set.
- [ ] Apply preference-then-top-up inside ph-3-us-3's selection function.
- [ ] Add the composite index if the emulator/production requires it.
- [ ] Extend `functions/src/assembleTest.test.ts`; document in `functions/README.md`.

## Questions
- Order when constraints conflict (scenario minimum > repeat-avoidance > topic cap) is a proposal.
- `RECENT_TESTS_TO_AVOID = 3` is a starting value; tune with the reviewed bank's size.
