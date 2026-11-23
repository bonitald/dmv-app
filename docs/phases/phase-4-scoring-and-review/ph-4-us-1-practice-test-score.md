# See my score and pass/fail right after a practice test

**ID:** ph-4-us-1
**Layer:** Parent
**Status:** Complete (Slice 5a 2026-11-20; timed-out note Slice 5b-1 2026-11-22; baseline comparison Slice 5b-2, device-tested 2026-11-22)

## Story
As a teen user,
I want to see my score the moment I finish a practice test, and whether it would pass the real
test,
So that I know straight away if I'm ready or need more practice.

## Context
- **Product area**: Phase 4 (`docs/phases.md`, first bullet); `prd.md` Section 3 "score at the
  end" and Section 5 "Scoring & review".
- **Layer**: Frontend (Expo/React Native). No Backend split: `scoreTest` (ph-1-us-11) already
  returns `score`, `correctCount`, `totalCount`, `perTopic` and `perQuestion` in its response, and
  saves the same to `users/{uid}/testAttempts/{testId}`. A backend child would be empty.
- **Real pass bar** (`prd.md` Section 9): the CO written test is 25 questions, 20 correct (80%)
  to pass, so at most 5 misses. Pass/fail is computed as `score >= PASS_MARK` (0.8), so it still
  works if a question was deleted and `totalCount` is 24. Keep `PASS_MARK` in one shared client
  constant. It matches `scoreTest`'s `MINI_QUIZ_PASS_THRESHOLD`.
- This replaces the minimal results placeholder shipped by ph-3-us-4. Mini-quiz results are
  ph-2-us-9; baseline results are ph-4-us-6. All three should share layout pieces (score header,
  missed-question list).

## Acceptance Criteria
- [ ] Given a practice test is submitted, when `scoreTest` returns, then the results screen shows
  the score as "N of 25 correct" and a percentage.
- [ ] Given the score is at least 80%, when the results screen shows, then it says the user would
  pass the real test (20 of 25 needed).
- [ ] Given the score is below 80%, when the results screen shows, then it says how many more
  correct answers they needed to pass (e.g. "17 of 25 — 3 more to pass"), in encouraging, not
  failing, language.
- [ ] Given the attempt had questions removed from the bank (`unavailable`), when the score shows,
  then it uses the graded total and says a question was left out, rather than showing a wrong
  total.
- [ ] Given the results screen, when it renders, then it offers "Review answers" (ph-4-us-4),
  "Take another test" (ph-3-us-5), and a comparison with the baseline where one exists
  (ph-4-us-7).
- [x] Given a timed test ran out of time, when results show, then it notes time ran out and how
  many questions were unanswered.
- [ ] Given the user leaves the results screen, when they come back to the Practice tab, then the
  test they just took appears in their recent tests with its score (read from `testAttempts`).

## UI/UX Notes
- **Screens/flows**: runner (ph-3-us-4) → results → review (ph-4-us-4) / new test / Practice tab.
- A large score, a clear pass/not-yet line, then per-topic weak spots (from `perTopic`, detailed in
  ph-4-us-6). No confetti or streaks (`prd.md` avoids gamification).
- A short "Recent tests" list on the Practice tab home (date, score, pass/not yet) that opens
  that attempt's results and review.

## Dependencies
- **Blocked by**: ph-3-us-4 (runner and submit). Uses ph-1-us-11 (built).
- **Leads to**: ph-4-us-4 (review), ph-4-us-7 (baseline comparison).

## Test Notes
- **Happy path**: 22/25 → pass; 17/25 → "3 more to pass".
- **Edge cases**: exactly 20/25 (pass); 0/25; an `unavailable` question (24 graded); timed test
  expired with 6 unanswered; opening an old attempt from Recent tests.
- **Failure modes**: attempt read fails offline for Recent tests (show cached or an empty state,
  not an error).

## Tasks
- [ ] Add `PASS_MARK` and a pure `passSummary(correctCount, totalCount)` helper, unit-tested.
- [ ] Build the practice results screen, replacing ph-3-us-4's placeholder.
- [ ] Add "Recent tests" to the Practice tab home from `testAttempts` (type `practice`, newest
  first).
- [ ] Extract shared result pieces (score header, missed list) for ph-2-us-9 and ph-4-us-6.

## Questions
None outstanding.

## Implementation notes (Slice 5a)
Built in Slice 5a on `feat/practice-tests`; plan `docs/superpowers/plans/2026-11-20-slice-5a-practice-tests.md`, design `docs/superpowers/specs/2026-11-20-slice-5a-practice-tests-design.md`. Device-tested on the Android emulator against dev 2026-11-20.
- Pass is counted in whole answers: `needed = ceil(0.8 × total)`, pass when `correct >= needed`, so a 24-question test needs 20.
- Recent tests is a live Firestore query (last 10 practice attempts, `type` + `createdAt` composite index). A failed or offline read shows the empty state.

## Implementation notes (Slice 5b-1)
Built in Slice 5b-1 on `feat/timed-tests`; plan `docs/superpowers/plans/2026-11-20-slice-5b1-timed-tests.md`, design `docs/superpowers/specs/2026-11-20-slice-5b1-timed-tests-design.md`. Device-tested on the Android emulator against dev 2026-11-22: everything passed. `assembleTest` and `scoreTest` deployed to `dmv-app-dev` (smoke check 401); no rules or index changes.
- **Timed-out note:** practice results say "Time ran out - N questions unanswered" (N counts `perQuestion` entries with no choice that aren't `unavailable`), or "Time ran out - you answered every question" when N is 0. It comes from the saved `timing` returned by `scoreTest` (ph-3-us-8, decision 6), so reopened attempts show it too.
