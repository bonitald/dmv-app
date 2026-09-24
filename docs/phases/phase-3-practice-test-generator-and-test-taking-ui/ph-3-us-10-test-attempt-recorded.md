# Every Test Attempt is recorded

**ID:** ph-3-us-10
**Layer:** Parent
**Status:** Complete — delivered by ph-1-us-11 (extended by ph-3-us-8)

## Story
As a teen user,
I want each test I take (answers, score, and when) to be saved,
So that the app can show me my history and improvement, and later phases (review, pass-rate
reporting) have data to use.

## Context
- **Product area**: Phase 3 (`docs/phases.md`, fifth bullet); `prd.md` Section 7 data model: "Test
  Attempt (user's answers, score, timestamp, and a type: baseline / practice / mini-quiz)".
- **Already delivered in Phase 1.** `scoreTest` (ph-1-us-11) writes
  `users/{uid}/testAttempts/{testId}` for every graded session: `type`, `chunkId`, `score`,
  `correctCount`, `totalCount`, `perTopic`, `perQuestion` (each answer with the correct one),
  `recommendation`, `createdAt`, plus `baselineReview` on the final baseline section. Clients can
  read their own attempts and never write them (`firestore.rules`).
- The only addition in Phase 3 is `timing` (mode + duration) on practice attempts: ph-3-us-8.
- No frontend work of its own: attempts are saved when the runner submits (ph-3-us-4). Reading
  them back (history, review, comparison with the baseline) is Phase 4.

## Acceptance Criteria
- [x] Given a practice test, mini-quiz, or baseline section is submitted, when it's graded, then
  a Test Attempt with answers, score, type, and timestamp is saved under the user (ph-1-us-11).
- [x] Given a client, when it tries to write or change a Test Attempt, then it's denied
  (`firestore.rules`, covered by rules tests).
- [ ] Given a practice test is graded, when its attempt is saved, then it also records `timing`
  (ph-3-us-8).

## Dependencies
- **Delivered by**: ph-1-us-11. **Extended by**: ph-3-us-8.
- **Consumed by**: Phase 4 (results, review, baseline comparison), Phase 5 (pass-rate analysis).
