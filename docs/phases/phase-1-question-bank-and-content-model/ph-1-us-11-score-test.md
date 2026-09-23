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
- Grades **only sets the server assigned to this uid**, looked up in `users/{uid}/
  testAssignments/{testId}` (written by `assembleTest`/mini-quiz assembly, ph-1-us-4/7), and each
  assignment can be scored once (`scored` flips to `true`). Otherwise it would reveal correct
  answers for arbitrary question IDs.
- Writes the result to `users/{uid}/testAttempts/{testId}` — a separate, **server-owned** record
  from the assignment, so a client can't edit its own score (needs the narrowed rules from
  ph-1-us-8). The assignment (what was asked) and the attempt (what the user got) stay two
  records: the assignment is written once at generation time and read once at scoring time, while
  the attempt is what Phase 3/4 render later — different lifecycles, not one growing document.
- The fixed baseline (ph-1-us-8) doesn't use `testAssignments` — its content lives in
  `baselineTests/{version}`, and per-user progress in `users/{uid}/baseline/progress`. When the
  final section is submitted, this function still writes a normal `testAttempts/{testId}` entry
  (`type: 'baseline'`) so Phase 3/4 can render it like any other attempt, and separately sets
  `freeTestUsedAt` on the user.

## Acceptance Criteria
- [ ] Given a `testId` with an assignment at `users/{uid}/testAssignments/{testId}` for the
  caller and their answers, when the function runs, then it returns the score, per-question
  results including each correct answer, and per-topic (`chunkId`) results.
- [ ] Given a `testId` with no assignment for this uid, then it rejects and reveals nothing.
- [ ] Given an assignment already marked `scored: true`, when scored again, then it rejects
  (`already-exists`) and leaves both records unchanged.
- [ ] Given a mini-quiz, when scored, then the response includes a recommendation ("move on" or
  "review again") from a server-side threshold constant (proposed default 80%, see `prd.md`
  Section 9).
- [ ] Given a completed attempt, when saved, then `users/{uid}/testAttempts/{testId}` records
  type (`practice`, `mini-quiz`, `baseline`), score, per-topic results, and timestamp, and the
  matching `testAssignments/{testId}` is marked `scored: true`.
- [ ] Given the final baseline section is scored, when saved, then the user is marked
  baseline-complete with `freeTestUsedAt` (ph-1-us-8).
- [ ] Given an unauthenticated caller, then `unauthenticated`.

## Data and API
- **Cloud Function**: callable `scoreTest({ testId, answers: [{ questionId, choice }] })`.
- **Firestore**: reads `users/{uid}/testAssignments/{testId}` and `questions` (Admin SDK); writes
  `users/{uid}/testAttempts/{testId}`, marks the assignment `scored: true`, and for the baseline's
  final section also sets `freeTestUsedAt`.
- **Security rules**: `testAssignments`, `testAttempts`, and `freeTestUsedAt` are read-only to
  clients (needs the narrowed `users/{uid}/**` rule from ph-1-us-8).

## Dependencies
- **Blocked by**: ph-1-us-4 and ph-1-us-7 (assignments persisted under `testId`), ph-1-us-8
  (server-owned rules).
- Consumed by: Phases 2, 3, 4, 9.

## Test Notes
- **Happy path**: correct/incorrect mix scores as expected; per-topic results match.
- **Edge cases**: unanswered questions; answer not in `choices`; wrong or foreign `testId`
  (no matching `testAssignments` doc); double submit (`scored: true` already).
- **Failure modes**: unauthenticated; rules test that a client can't write to `testAssignments`
  or `testAttempts` directly.

## Tasks
- [ ] Persist assignments in `assembleTest` (ph-1-us-4 follow-up).
- [ ] Implement `scoreTest` and the recommendation threshold constant.
- [ ] Emulator tests; document the contract in `functions/README.md`.

## Questions
- Should Concept Progress status ("reviewed", "needs revisit") be updated by this function from
  the recommendation, or stay a client action from the user's button choice (Phase 2)?
