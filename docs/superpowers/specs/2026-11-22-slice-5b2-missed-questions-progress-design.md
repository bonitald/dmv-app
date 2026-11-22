# Slice 5b-2 — Missed Questions and Progress Over Time — Design

> Companion to `docs/build-order.md` (Slice 5b, second half). The stories are the detailed spec:
> ph-4-us-5 (missed questions; practice and baseline results feeding card performance), ph-4-us-7
> (latest score vs baseline, which also finishes ph-4-us-1) and the Home test card's practice
> state (ph-9-us-7). This doc records how they fit together and the decisions drafted on
> 2026-11-22.
>
> **Status: draft, not reviewed.** Written alongside the Slice 6 spec
> (`2026-11-22-slice-6-save-progress-account-design.md`) without anyone available to answer
> questions, so every decision Claude made on its own is marked **Open? = Yes**.

## Questions for review

1. **Missed list source** (D1): built from the last 30 graded attempts in Firestore, not from
   local card performance, so it survives a new phone (Slice 6).
2. **"Missed"** (D2): a question whose latest graded result is wrong or skipped, across practice
   tests, mini-quizzes and the completed baseline.
3. **When results feed card performance** (D4): only when a test is graded in this app session
   (fresh result, or the "already graded" recovery right after submitting). Reopening old results
   never records. No backfill of tests graded before 5b-2 (D6).
4. **Card-performance write for tests** (D5): a new `recordTestResults` that updates per-card
   history only. It leaves `lastQuizMissedIds` and the saved deck pass alone (the 5b review
   carry-forward).
5. **Opening a missed question** (D8): the existing Review screen gains an optional
   `questionId`, showing just that question from its attempt.
6. **Comparison** (D10/D11): latest practice test vs baseline on the Progress tab and Home; each
   practice result compares *that* test with the baseline. Percent points, no average.
7. **Home test card** (D12): once the baseline is done, "Baseline done" becomes "Take a practice
   test" with the latest score and the comparison.
8. **Weak spots on Home** (D13): ph-9-us-7's weak-spots card isn't built yet, and Slice 6 expects
   to close ph-9-us-6 in full. Proposed: add it here, since this slice already touches Home.

## Goal

A teen can see, in one list, the questions they keep getting wrong, with the right answer, and
the list shrinks as they get them right. Practice tests and the baseline start shaping the
flashcards, not just mini-quizzes. And the app answers "is my studying working?": the latest
practice score next to the baseline, on the Progress tab, on practice results and on Home.

**Why now:** it finishes Phase 4 (`docs/phases.md` bullets 3 and 5) and the `prd.md` Section 2
secondary metric (baseline → later practice improvement). It's the last slice before accounts
(Slice 6), and it's the progress Slice 6 is meant to protect.

**Device test** (from `build-order.md`, extended):
1. Fresh user: baseline with some misses → results → Practice tab shows "Missed questions — N"
   (N = baseline misses) → open → grouped by topic in handbook order with counts → tap a question
   → review layout with your answer and the right one → back → "Study this concept" → that
   topic's flashcards, with the baseline-missed card early in the pass (weighted, not
   guaranteed first).
2. Practice test that misses Q1 and gets a previously missed baseline question right → the
   missed list has Q1 and no longer has the other.
3. Practice results: "Baseline 60% → This test 76% · +16 points". A lower score reads neutrally
   ("Baseline 60% → This test 52%. Keep going — every test shows what to work on.").
4. Progress tab: a summary card above the concept report with baseline, latest practice and the
   change. With no practice test: baseline only plus "Take a practice test". With no baseline:
   start or finish the baseline, depending on its progress.
5. Home: the test card says "Take a practice test" with "Latest: 19 of 25 (76%), +16 points
   since your baseline" once the baseline is done.
6. Mini-quiz on a topic → its "Review Again" missed-only pass and saved pass still work as in
   4b; a practice test afterwards doesn't change that topic's missed-only cards or reset its
   saved pass.
7. Reopen an old practice test from Recent tests, and the baseline results from Home → card
   performance doesn't change (no double count).
8. Airplane mode: the missed list and the comparison come from Firestore's cache; with nothing
   cached they're hidden or show the offline state, never an error that blocks the screen.

## Goals, non-goals, anti-goals

- **Goals:** a missed list that reflects the latest result per question; practice and baseline
  results feeding weak-card ordering exactly once; an honest, encouraging baseline comparison;
  Home's test card complete.
- **Non-goals:** a score trend chart or an average of recent tests (ph-4-us-7: "a trend can come
  later"); retaking just the missed questions as a quiz; server-side aggregation or a per-question
  summary doc (ph-4-us-5 Questions, later if needed); syncing card performance to the server
  (Slice 6 D5); any rules, index or function change.
- **Anti-goals:** practice or baseline results overwriting a topic's `lastQuizMissedIds` or
  clearing its saved deck pass (5b review carry-forward); a test recorded twice; red "worse"
  framing, streaks or points; the missed list showing held-back baseline answers; a screen that
  blocks on a failed read.

## Decisions (drafted 2026-11-22)

| # | Question | Decision | Open? |
|---|----------|----------|-------|
| 1 | Missed list source | **Firestore `users/{uid}/testAttempts`, newest 30 by `createdAt`, all types** (single-field order, no new index; read through the offline cache). Not local card performance: attempts carry question text and choices (ph-4-us-3) and survive a new phone (Slice 6 D5). `MISSED_ATTEMPTS_LIMIT = 30`, as ph-4-us-5 proposed. | Yes |
| 2 | What counts as missed | ph-4-us-5's rule: a question's **most recent graded result** is wrong or skipped. Practice, mini-quiz, and the completed baseline. Removed (`unavailable`) questions and ungraded entries (`correct === null`, held-back baseline sections) are ignored, not misses. | No (ph-4-us-5) |
| 3 | Baseline in the list | Only the **final section's attempt**, using its `baselineReview` (all 45). Earlier section attempts have `correct: null` and are skipped by D2 anyway. The final attempt's `createdAt` dates all 45, which is close enough. Ignore its `perQuestion` to avoid counting section 3 twice. | Yes |
| 4 | When results feed card performance | **Only when a test is graded in this app session:** the practice `scoreTest` result, the practice "recovering" path right after an `already-exists`, and the baseline's final section completing (fresh `baselineReview`, or reading the final attempt after `already-exists`). Reopening results (Recent tests, Home's "Baseline done", Progress) never records. Mini-quizzes keep their existing `recordQuizResults` call. | Yes |
| 5 | How tests are recorded | New **`recordTestResults(uid, testId, perQuestion)`** next to `recordQuizResults`: updates `cards` (graded, missed, streak, lastCorrect) through a new pure `applyTestResults`, and **does not** touch `lastQuizMissedIds` or call `setDeckPass`. The current pass keeps going; the new weights apply to the next pass. | No (5b review carry-forward) |
| 6 | Once per test | A per-uid **recorded set** in AsyncStorage, `dmv-app:card-perf-recorded:{uid}` (JSON array of test IDs, newest 50 kept). `recordTestResults` checks and adds to it; a storage failure skips recording rather than risking a double count. **No backfill** of tests graded before 5b-2 or on another phone. Uses the `dmv-app:` prefix so Slice 6's `clearLocalData` sweep removes it. | Yes |
| 7 | Where the list lives | A new root-stack screen **`MissedQuestions`**, opened from a row on the Practice tab home ("Missed questions · 12", or "Missed questions · none right now" once there's any graded attempt; hidden before) and from a link on practice and baseline results. Topic groups in handbook order with a count and "Study this concept" (opens flashcards via `openConcept`). Plain list, no scores. | Yes |
| 8 | Opening one missed question | `Review` route gains optional **`questionId`**: `Review: { testId: string; questionId?: string }`. With it, the screen shows just that question from that attempt in the ph-4-us-4 layout (baseline attempts already resolve to `baselineReview`). Old attempts without text show "Question text unavailable" (existing fallback). | Yes |
| 9 | Live or one-off read | **Live** (`onSnapshot`), like Recent tests, so the list and count update right after a test is graded. One shared subscription hook (`useRecentAttempts`) feeds the Practice row and the screen. | Yes |
| 10 | Comparison basis | Baseline = `summarizeBaseline(...).percent` (correct / graded of 45, existing code). Practice = that test's `score` as a percent. **Change in whole percentage points.** Latest, not an average (ph-4-us-7's assumption). | Yes |
| 11 | Which test is compared | Progress tab and Home: **the latest practice test**. Practice results: **the test being shown**, so reopening an old test from Recent tests shows its own comparison. | Yes |
| 12 | Home test card | Baseline done → **"Take a practice test"**: no practice yet → "25 questions, like the real test"; with one → "Latest: 19 of 25 (76%) · +16 points since your baseline" (comparison omitted if the baseline attempt can't be read). Opens the Practice tab. Baseline results stay reachable from the Progress tab and Recent tests (the card no longer links to them). | Yes |
| 13 | Home weak spots | **Add ph-9-us-7's weak-spots card here:** up to 3 "likely gap" / "Missed it" topics from `useConceptEvidence`, each opening flashcards; hidden with no evidence. Not in `build-order.md` for any slice; without it ph-9-us-6 can't close in Slice 6. | Yes |
| 14 | Empty and offline states | Missed list with attempts but no misses: "Nothing to go over right now" plus Practice and concept-list links. No attempts: points to the baseline or a practice test. Read error with no cache: the existing `NoConnection`-style state on the screen; the Practice row and comparisons simply hide. | No (ph-4-us-5/7) |

## Data (pure, `npm run test:app`)

- `src/review/missedQuestions.ts`: `latestMisses(attempts)` → for each question, its latest graded
  result (by attempt `createdAt`, D2/D3); returns misses with `{ questionId, chunkId, testId,
  item }` where `item` is the review item for D8. `groupByTopic(misses, topics)` → handbook order,
  unknown topics last (same pattern as `summarizeBaseline`).
- `src/progress/scoreComparison.ts`: `compareToBaseline(baselinePercent, practiceScore)` →
  `{ baselinePercent, practicePercent, change }`, and the neutral wording for up / same / down.
- `src/study/cardPerformanceData.ts`: `applyTestResults(history, results)` (cards only) beside
  `applyQuizResults`.

## Frontend

**Attempts read** (`src/review/recentAttempts.ts`, hook `useRecentAttempts`): newest 30 of all
types, live, reset on uid change (same pattern as `usePracticeAttempts`).

**Card performance** (`src/study/cardPerformance.ts`): `recordTestResults` (D5/D6) and the
recorded-set helpers. Called from `PracticeTestScreen` (results and recovering) and
`BaselineScreen` (final section complete), D4. Failures are logged, never shown.

**Missed questions screen** (`src/review/MissedQuestionsScreen.tsx`, D7/D14) and the Practice
row in `PracticeHomeScreen`. Link from `PracticeResults` and `BaselineResults` ("Go over missed
questions").

**Review** (`src/review/ReviewScreen.tsx`): optional `questionId` (D8).

**Comparison:**
- `PracticeResults`: line under the score (D10/D11), hidden while the baseline is unfinished or
  unreadable, replaced by "Finish your baseline to see how far you've come" when it's in progress.
- Progress tab (`ConceptReportScreen`): summary card at the top with ph-4-us-7's states.
- Home (`HomeScreen` `TestCard`): D12. Weak spots card (D13) after the study card.

## Relationship to Slice 6

- Slice 6 doesn't depend on this slice, but should come after it (Slice 6 spec, "Relationship to
  Slice 5b"). D1 makes the missed list come back on a new phone; card performance (and so the
  weighted order) doesn't (Slice 6 D5).
- The new `card-perf-recorded` key uses the `dmv-app:` prefix (D6), so Slice 6's sweep clears it.
- If Slice 6 later wants weak-card ordering on a new phone, a backfill from `useRecentAttempts`
  becomes possible with the recorded set in place; out of scope for both slices.

## Story and doc updates

When device-tested: ph-4-us-5 and ph-4-us-7 Complete; ph-4-us-1 Complete (baseline comparison
was its last part); ph-9-us-7's test card and weak-spots criteria checked (if D13 is accepted).
Record D1/D3/D4/D6 in ph-4-us-5, D10–D12 in ph-4-us-7. Update `build-order.md` (5b-2 status;
Phase 4 closed apart from Phase 5's outcome log) and the Phase 4 and Phase 9 summaries.

## Left to the builder

- Copy and layout within the patterns above (neutral, encouraging, no "fail" or "worse").
- Whether the Practice row is a card or a list row.
- Tests: `latestMisses` (miss then right → gone; missed twice → listed once with the latest;
  mini-quiz + practice on the same question; `unavailable` and `correct: null` skipped; baseline
  final attempt uses `baselineReview` only; 30-attempt bound), `groupByTopic`,
  `compareToBaseline`, `applyTestResults` keeps `lastQuizMissedIds` in `npm run test:app`;
  `recordTestResults` once per test ID and storage-failure skip; missed screen states, Review
  with `questionId`, practice results comparison states, Progress summary states, Home test card
  and weak spots in `npm run test:components`.
