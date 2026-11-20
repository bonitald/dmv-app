# Slice 5a — Take a Practice Test and See the Result — Design

> Companion to `docs/build-order.md` (Slice 5a). The stories are the detailed spec: ph-3-us-3,
> ph-4-us-1 and the "Topics to work on" part of ph-4-us-6, plus the practice-test parts of
> ph-3-us-4 (runner on the Practice tab) and ph-3-us-1 (force-quit resume). Parent closed:
> ph-3-us-2. This doc records how they fit together and the decisions made on 2026-11-20.

## Goal

The Practice tab stops being a placeholder. A teen starts a 25-question practice test that
looks like the real Colorado written test (a guaranteed share of "what do you do here" scenario
questions, no topic dominating), takes it on the same runner as the baseline and mini-quiz, and
the moment they submit sees whether they'd pass (20 of 25), which topics to work on, and can
review every answer. The test shows in a "Recent tests" list, and its answers start counting
in the Progress tab's concept report.

**Why now:** the learning path (Slices 4a/4b) is done; practice tests are the other half of the
MVP's core loop (`prd.md` Section 5, "Practice test generator" and "Scenario/situational
question set", both Must) and the main way a teen finds out if they're ready.

**Device test** (from `build-order.md`, extended): Practice tab → "Start a practice test" → 25
questions, at least 8 scenario, no more than 2 per topic → answer half → force-quit → reopen
the Practice tab → "Resume your test" → finish → submit (confirm) → "N of 25", "You'd pass" or
"N more to pass", "Topics to work on" → tap a topic → its flashcards → back → "Review answers"
→ Practice tab shows the test in Recent tests → tap it → same results → Progress tab: a topic
with 2 answers in that test and no mini-quiz shows "N of 2 right in practice tests". Also: start
the baseline, answer part of a section, start and finish a practice test, return to the
baseline: its answers are still there.

## The real test (checked 2026-11-20)

25 multiple-choice questions, 20 correct (80%) to pass: consistent across third-party guides,
not stated on any official DMV page or in the handbook (DR 2337, Jan 2025, p. 4 only says the
test covers the handbook). Already in `prd.md` Section 9, `assembleTest` (25) and `PASS_MARK`
(0.8); nothing changes. The 60-minute limit is confirmed only for the online @Home test, which
matters for timed mode (Slice 5b), not here. Whether the real test uses scenario-style
questions is still unconfirmed (`prd.md` Section 9), so the scenario minimum below is a tunable
starting value, not a product fact.

## Goals, non-goals, anti-goals

- **Goals:** realistic 25-question tests; an immediate, encouraging pass/not-yet result; a
  practice test survives a force-quit and going offline; practice answers feed the concept
  report; recent tests are listed.
- **Non-goals (Slice 5b):** timed mode and the countdown (ph-3-us-7/8/9), avoiding repeated
  questions across tests (ph-3-us-6), the missed-questions list and practice results feeding
  per-card performance (ph-4-us-5), latest score vs baseline (ph-4-us-7), the Home "Take a
  practice test" card. ph-4-us-1's timed-out and baseline-comparison criteria wait for 5b.
- **Anti-goals:** a practice test that wipes an unfinished baseline section (or the reverse);
  "fail" language or gamification (confetti, streaks; `prd.md`); a results screen that shows a
  wrong total when a question was deleted; a Recent tests list that errors offline.

## Decisions (2026-11-20)

| # | Question | Decision | Changes a story? |
|---|----------|----------|------------------|
| 1 | Baseline and practice test both in progress | **Keep both.** The on-device session store gets one slot per kind (`baseline`, `practice`), so neither can drop the other. Mini-quizzes stay out of it (Slice 4b decision 6). | Yes: ph-3-us-1 ("one active test per user" becomes one per kind) |
| 2 | Recent tests source | **Firestore query** on `users/{uid}/testAttempts`: `type == 'practice'`, `createdAt` desc, limit 10. Needs a new composite index. Survives a new phone (Slice 6) and reads from Firestore's offline cache. | No |
| 3 | Practice evidence in the concept report | **The last 10 practice tests**, summing each topic's `perTopic` correct/total. Older tests age out as the teen improves. Uses the same query as decision 2. | Fills ph-4-us-6's "recent practice attempts" |
| 4 | Question mix | Scenario minimum `MIN_SCENARIO_COUNT = 8`, `MAX_PER_TOPIC = 2`, with the fallbacks in ph-3-us-3. Starting values. **When they clash, the scenario minimum wins** (scenario questions may exceed the per-topic cap to reach 8); *Claude's call, 2026-11-20*. The builder reports the approved bank's real scenario share in the hand-off; it does **not** gate the deploy. | No (keeps ph-3-us-3's first criterion strict) |
| 7 | Practice evidence threshold | **`MIN_PRACTICE_ANSWERS` drops from 3 to 2**, so one practice test (at most 2 per topic) can rate the topics it covered: 2/2 strong, 1/2 shaky, 0/2 likely gap, always with the "N of M right in practice tests" basis line. Mini-quiz evidence still takes priority. Without this, a first practice test changes nothing on the Progress tab, and a teen with no baseline still sees "take the baseline". | Yes: ph-4-us-6 (proposed 3) |
| 5 | Resume after force-quit | A **"Resume your test"** card on the Practice tab (answered count, Resume / Discard), not a prompt at app launch. Starting a new test while one is unfinished asks to discard it first. | Settles ph-3-us-1's resume-vs-discard UI |
| 6 | "Topics to work on" | Topics with at least one miss in this test, most misses first, then handbook order. Show at most 5; if more, a line "and N more — see Review answers". Each opens that topic's flashcards. | Settles ph-4-us-6's "weakest topics" |

## Backend

**`assembleTest`** (`functions/src/assembleTest.ts`, ph-3-us-3): selection moves into a pure,
exported function, `selectPracticeQuestions(pool, count, random, { minScenario, maxPerTopic })`,
returning the chosen docs in final order:

1. Shuffle the approved pool once with `random`.
2. **Scenario pass:** walk the shuffled pool, taking `scenario` questions while fewer than
   `minScenario` are taken and the question's topic (`chunkId`) is under `maxPerTopic`.
3. **Scenario relax pass:** if still under `minScenario` (scenario questions bunched in a few
   topics), take more `scenario` questions in shuffled order ignoring the cap, until
   `minScenario` or none are left (decision 4).
4. **Fill pass:** walk again, taking any not-yet-taken question whose topic is under the cap,
   until `count`.
5. **Relax pass:** if still short, take remaining questions in shuffled order ignoring the cap,
   until `count` or the pool runs out (a pool under 25 returns everything, as today).
6. Shuffle the selection with `random`, so scenario questions aren't grouped at the start.

A missing or unexpected `type` counts as `fact`. The input/output contract, the choice shuffle
and the `testAssignments` write don't change. Constants sit next to `DEFAULT_QUESTION_COUNT`.
Doc comments follow the `cloud-function-documentation` skill; `functions/README.md` documents
the mix rules under `assembleTest`.

**Firestore index** (`firestore.indexes.json`): `testAttempts` collection, `type` ascending +
`createdAt` descending. Deployed to `dmv-app-dev` with the functions. No rules change: the
owner already reads their own `testAttempts`, and that covers queries. **`scoreTest`** is
unchanged: it already grades practice tests and saves `perTopic`, `perQuestion`, question text
and `createdAt` on the attempt.

## Frontend

**Session store** (`src/quiz/quizSession.ts`, decision 1): the active marker key becomes
per-kind, `dmv-app:active-test:{uid}:{kind}`. `startSession`, `getActiveSession(uid, kind)`,
`saveAnswers` and `endSession` take the kind. Starting a session replaces only that kind's
earlier session. `BaselineScreen` passes `'baseline'`. **Migration:** reading the baseline slot
falls back to the old unsuffixed key if it holds a `baseline` session (moving it over), so a
baseline section in progress on an existing install isn't lost.

**Practice tab home** (replaces the `PlaceholderScreen` in `RootNavigator`'s Practice stack):
- "Start a practice test" (25 questions, a line on the 20-of-25 pass mark, "Based on the
  Colorado Driver Handbook").
- When a practice session is saved: a "Resume your test" card ("12 of 25 answered") with
  Resume and Discard (Discard confirms, then `endSession`). With one saved, Start asks "Start
  a new test? Your unfinished test will be discarded."
- **Recent tests** (decision 2): date, "N of 25", "Pass" / "Not yet"; tapping one opens its
  results. Offline with nothing cached, or a failed read, shows the empty state ("Your tests
  will show here"), not an error.

**Practice test screen** (new root-stack route `PracticeTest`, above the tabs like `MiniQuiz`):
built like `MiniQuizScreen` on the shared `QuizRunner`.
- Start: `assembleTest` → `startSession(uid, testId, 'practice', questions)` before the first
  question shows; a failed cache write shows the existing "won't survive going offline" notice.
  A failed `assembleTest` shows retry (No connection only for network errors, as in the
  baseline).
- Resume: opened with the saved session, it shows the cached questions and answers without
  calling `assembleTest`.
- Answers save on every tap (`saveAnswers`). Leaving mid-test confirms ("Your answers are
  saved; you can resume from the Practice tab") and keeps the session.
- Submit uses the runner's existing confirm and unanswered warning. Offline at submit holds the
  answers and sends on reconnect; `already-exists` reads the saved attempt instead. On success,
  `endSession` then results.

**Practice results** (new route `PracticeResults: { testId }`, or shown in place after submit
from the in-memory `scoreTest` result; reopening from Recent tests reads the attempt with
`useTestAttempt`):
- Big score "17 of 25" and the percentage.
- Pass line from a pure `passSummary(correctCount, totalCount)` using `PASS_MARK`
  (`src/results/passMark.ts`): at or above → "You'd pass the real test (20 of 25 needed)";
  below → "3 more to pass", encouraging wording. Pass is `score >= PASS_MARK`, so a graded
  total of 24 still works; when questions were `unavailable`, a line says how many were left
  out.
- "Topics to work on" (decision 6), using topic titles from `useTopics`, opening flashcards via
  the existing `Flashcards` route.
- "Review answers" (existing `Review` screen) and "Take another test".
- Shares layout pieces with the mini-quiz and baseline results where they already exist
  (score header); no forced refactor of those screens.

**Concept report** (`src/progress/useConceptEvidence.ts`, decision 3): also reads the last 10
practice attempts (a shared hook with Recent tests), sums `perTopic` per `chunkId`, and passes
it to `toReportRows` as `practice` evidence. `conceptStrength` already applies it (mini-quiz
first, then practice answers, then baseline); `MIN_PRACTICE_ANSWERS` becomes 2 (decision 7),
so `hasEvidence` turns true after one practice test and the empty state no longer shows. A failed practice read leaves practice
evidence out; it doesn't block the report.

## Story and doc updates

Mark ph-3-us-3, ph-4-us-1 (5a parts), ph-3-us-2 Complete when device-tested; ph-4-us-6 and
ph-3-us-1/us-4 practice parts done; record decision 1 in ph-3-us-1, decisions 5/6 in their
stories and decision 7 in ph-4-us-6; update `build-order.md` Slice 5a status and fix its stale open items (question review
is finished; the Node 22 upgrade is done).

## Left to the builder

- Exact copy and layout within the patterns above (encouraging, no "fail").
- Whether results is a separate route or a phase of `PracticeTestScreen` (both are fine; the
  Recent-tests reopen path needs a route either way).
- How to share the practice-attempts read between Recent tests and the concept report.
- Tests: `selectPracticeQuestions` across many seeds and the ph-3-us-3 edge cases
  (`npm run test:functions`); `passSummary` and topics-to-work-on (`npm run test:app`); session
  slots and migration; Practice tab, resume, results (`npm run test:components`).
