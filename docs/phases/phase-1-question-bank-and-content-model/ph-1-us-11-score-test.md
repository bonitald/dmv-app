# Score a test, mini-quiz, or baseline section

**ID:** ph-1-us-11
**Layer:** Backend
**Status:** Not Started

## Story
As a teen user who finished a test, mini-quiz, or baseline section,
I want my answers scored and the results saved,
So that I see how I did and get a recommendation on what to do next.

## Context
- **Product area**: Phase 1 (`docs/phases.md`), consumed by Phase 2 (mini-quiz result and
  recommendation), Phase 3 (Test Attempt recording), and Phase 4 (score screen, review).
- **Layer**: Backend (Firebase Cloud Functions)
- The only place correct answers are compared with user answers. `assembleTest` (ph-1-us-4),
  mini-quiz assembly (ph-1-us-7), and the baseline (ph-1-us-8) deliberately return no answers.
- Grades **only sets the server assigned to this uid** (looked up by `testId`), and each set can
  be scored once. Otherwise it would reveal correct answers for arbitrary question IDs.
- Writes the result to a **server-owned** record under the user's uid, so a client can't edit its
  own score (needs the narrowed rules from ph-1-us-8).

## Acceptance Criteria
- [ ] Given a `testId` assigned to the caller and their answers, when the function runs, then it
  returns the score, per-question results including each correct answer, and per-topic
  (`chunkId`) results.
- [ ] Given a `testId` that doesn't exist or belongs to another uid, then it rejects and reveals
  nothing.
- [ ] Given a set already scored, when scored again, then it rejects (`already-exists`) and
  leaves the record unchanged.
- [ ] Given a mini-quiz, when scored, then the response includes a recommendation ("move on" or
  "review again") from a server-side threshold constant (proposed default 80%, see `prd.md`
  Section 9).
- [ ] Given a completed attempt, when saved, then it records type (`practice`, `mini-quiz`,
  `baseline`), score, per-topic results, timestamp, and `testId` under the user's uid.
- [ ] Given the final baseline section is scored, when saved, then the user is marked
  baseline-complete with `freeTestUsedAt` (ph-1-us-8).
- [ ] Given an unauthenticated caller, then `unauthenticated`.

## Data and API
- **Cloud Function**: callable `scoreTest({ testId, answers: [{ questionId, choice }] })`.
- **Firestore**: reads the assignment record and `questions` (Admin SDK); writes the attempt and,
  for the baseline, the completion flag.
- **Security rules**: attempts and the flag are read-only to clients.

## Dependencies
- **Blocked by**: ph-1-us-4 and ph-1-us-7 (assignments persisted under `testId`), ph-1-us-8
  (server-owned rules).
- Consumed by: Phases 2, 3, 4, 9.

## Test Notes
- **Happy path**: correct/incorrect mix scores as expected; per-topic results match.
- **Edge cases**: unanswered questions; answer not in `choices`; wrong or foreign `testId`;
  double submit.
- **Failure modes**: unauthenticated; rules test that a client can't write an attempt.

## Tasks
- [ ] Persist assignments in `assembleTest` (ph-1-us-4 follow-up).
- [ ] Implement `scoreTest` and the recommendation threshold constant.
- [ ] Emulator tests; document the contract in `functions/README.md`.

## Questions
- Should Concept Progress status ("reviewed", "needs revisit") be updated by this function from
  the recommendation, or stay a client action from the user's button choice (Phase 2)?
