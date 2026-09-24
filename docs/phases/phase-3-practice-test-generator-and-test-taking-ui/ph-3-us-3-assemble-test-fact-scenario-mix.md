# `assembleTest` guarantees a fact/scenario mix and topic spread

**ID:** ph-3-us-3
**Layer:** Backend
**Parent:** ph-3-us-2
**Status:** Not Started

## Story
As a developer,
I want `assembleTest` to build each practice test with a minimum share of scenario questions and
no single topic dominating,
So that every practice test looks like the real exam instead of a random draw that can come out
all-fact or lopsided toward one topic.

## Context
- **Product area**: Phase 3 (`docs/phases.md`, first bullet).
- **Layer**: Backend (Cloud Functions).
- Today `assembleTestForUser` (`functions/src/assembleTest.ts`) loads every approved question,
  shuffles, and takes the first `DEFAULT_QUESTION_COUNT` (25). Nothing controls the fact/scenario
  mix or the topic spread.
- Question count: **25, confirmed** — the real Colorado written knowledge test is 25
  multiple-choice questions, 60 minutes, 20 correct (80%) to pass (`prd.md` Section 9).
  `DEFAULT_QUESTION_COUNT` already matches.
- The bank's actual scenario share is unknown until review finishes. `qb:build-baseline` already
  reports the baseline's mix, and this story's constants should be tuned against the approved
  bank's real numbers.
- Follows the `cloud-function-documentation` skill for the changed function.

## Acceptance Criteria
- [ ] Given the approved bank has at least `MIN_SCENARIO_COUNT` scenario questions, when a test is
  assembled, then it contains at least that many scenario questions, and the rest are filled
  from the remaining pool at random.
- [ ] Given the approved bank has fewer scenario questions than `MIN_SCENARIO_COUNT`, when a test
  is assembled, then it includes all of them and fills the rest with fact questions — no error.
- [ ] Given a test is assembled, when its questions are counted per topic (`chunkId`), then no
  topic has more than `MAX_PER_TOPIC` questions, unless the approved pool is too small to fill
  the test otherwise (then the cap relaxes rather than returning a short test).
- [ ] Given a test is assembled, when the questions are returned, then they're in shuffled order
  (scenario questions aren't grouped at the start or end).
- [ ] Given the approved bank has fewer than 25 questions in total, when a test is assembled,
  then it returns all of them (existing behavior, kept).
- [ ] Given a question has a missing or unexpected `type`, when the mix is computed, then it
  counts as `fact`.

## Data and API
- **Cloud Functions**: `assembleTest` — change selection only. Input/output contract and the
  `testAssignments` write are unchanged.
- New tunable constants next to `DEFAULT_QUESTION_COUNT`: `MIN_SCENARIO_COUNT` (proposed 8 of 25,
  about a third) and `MAX_PER_TOPIC` (proposed 2). Both are starting values, not product
  decisions.
- **Firestore / rules**: no changes.

## Dependencies
- **Blocked by**: ph-1-us-4 (Complete).
- **Parent**: ph-3-us-2 — the backend half: every test gets a realistic mix.
- **Works with**: ph-3-us-6 (avoid repeats), which changes the same selection code. Build them
  together or one after the other, not in parallel branches.

## Test Notes
- **Happy path**: a seeded pool with plenty of both types returns ≥ 8 scenario questions and ≤ 2
  per topic, across many deterministic random seeds.
- **Edge cases**: pool with 3 scenario questions (all 3 included); pool with zero scenario
  questions; a pool where one topic holds most questions (cap relaxes to fill 25); a pool smaller
  than 25.
- **Failure modes**: question missing `type` (treated as fact); unchanged `unauthenticated`
  rejection.

## Tasks
- [ ] Refactor selection into a pure, testable function (pool, count, random → selected docs).
- [ ] Implement the scenario minimum and per-topic cap with the fallbacks above.
- [ ] Extend `functions/src/assembleTest.test.ts` (`npm run test:functions`).
- [ ] Document the mix rules and constants in `functions/README.md` under `assembleTest`.

## Questions
- Starting values `MIN_SCENARIO_COUNT = 8` and `MAX_PER_TOPIC = 2` are proposals. Tune them once
  the reviewed bank's mix is known.
