# Slice 5b-2 — Missed Questions and Progress Over Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Missed questions" list built from recent graded attempts (it shrinks as questions
are answered right), practice and baseline results feeding flashcard order exactly once, the
baseline comparison on practice results, the Progress tab and Home, and Home's practice and
weak-spots cards.

**Architecture:** App-only; no Cloud Function, rules or index changes. Pure modules do the logic
(`applyTestResults`, `latestMisses` / `groupByTopic`, `compareToBaseline`) and run under
`npm run test:app`. One live Firestore subscription (`useRecentAttempts`, newest 30 attempts of
any type) feeds the missed list and the Practice row. A `useBaselineScore` hook wraps the
existing baseline progress + final-attempt read + `summarizeBaseline`. Recording into card
performance happens only where a test is graded in this session, guarded by a per-uid
recorded-ID set in AsyncStorage.

**Tech Stack:** Expo SDK 57, React Navigation 7, `@react-native-firebase/firestore` v26,
AsyncStorage, Jest (`test:app` = Node ts-jest for `*.test.ts`, `test:components` = jest-expo for
`*.test.tsx`).

**Spec:** `docs/superpowers/specs/2026-11-22-slice-5b2-missed-questions-progress-design.md`
(decisions D1–D14, all confirmed 2026-11-22), and its stories:
`docs/phases/phase-4-scoring-and-review/ph-4-us-5`, `ph-4-us-7`, `ph-4-us-1` (baseline
comparison criterion) and `docs/phases/phase-9-first-run-onboarding-and-account-linking/ph-9-us-7`
(test card and weak spots).

## Decisions made while planning (flag to the user at review)

- **Baseline recording point.** `BaselineScreen`'s `complete` phase gains `justGraded: boolean`
  (true only from the submit path). `BaselineResults` gets an optional `onReviewReady(raw)`
  callback, called once with the raw `baselineReview` array when it is available (in memory or
  from the attempt read). `BaselineScreen` passes it only when `justGraded`. Reopening from Home
  never records.
- **Practice recovering path** records from the attempt's raw `perQuestion` inside
  `Recovered`, because `PracticeOutcome` doesn't carry per-question results.
- **Recorded set bound:** 50 IDs, newest kept. A test can't be graded twice, so a dropped old ID
  can't cause a double count in practice.
- **`latestMisses` ordering** uses each attempt's `createdAt` (Firestore Timestamp → millis);
  an attempt without one (pending server timestamp in the local cache) counts as newest.
- **Weak spots** use `useConceptEvidence` rows with strength `likely-gap` or `missed-it`, in
  handbook order, first 3.
- **Practice row count** comes from the same subscription as the screen; while it loads, the
  row shows without a number.

## Global Constraints

- Colors, spacing, radius and type only from `src/theme/tokens.ts`. Tap targets ≥ 48pt. Reuse
  `Button`, `Card`, `NoConnection`, the Review layout and `openConcept`.
- Constants: `MISSED_ATTEMPTS_LIMIT = 30`, `RECORDED_TESTS_LIMIT = 50`, `WEAK_SPOTS_LIMIT = 3`.
- AsyncStorage key: `dmv-app:card-perf-recorded:{uid}` (JSON string array). It carries the uid
  so Slice 6's sweep clears it.
- `recordTestResults` never writes `lastQuizMissedIds` and never calls `setDeckPass`.
  `recordQuizResults` (mini-quiz) is unchanged.
- Results are never recorded when reopened (Recent tests, Home, Progress).
- No "fail", "worse", red framing, streaks or points.
- Copy (exact):
  - Practice row: "Missed questions · {n}" / "Missed questions · none right now" / while
    loading "Missed questions"
  - Missed screen title "Missed questions"; topic header "{title} · {n}"; button "Study this
    concept"; empty with attempts: "Nothing to go over right now" + "Every question you've
    missed lately, you've since got right." + buttons "Take a practice test", "Browse concepts";
    no attempts: "No missed questions yet" + "Take the baseline or a practice test and any
    questions you miss will show here." + "Start your baseline" (or "Take a practice test" when
    the baseline is done)
  - Results link: "Go over missed questions"
  - Comparison up: "Baseline {b}% → This test {p}% · +{d} points"; same: "Baseline {b}% → This
    test {p}% · same as your baseline"; down: "Baseline {b}% → This test {p}%. Keep going —
    every test shows what to work on."
  - Practice results, baseline in progress: "Finish your baseline to see how far you've come."
  - Progress summary title "Your scores"; rows "Baseline {b}%", "Latest practice test {p}%",
    change line as above with "Latest" for "This test"; no practice: "Take a practice test to
    compare with your baseline." + button "Take a practice test"; no baseline: "Start your
    baseline" / "Finish your baseline" button with "Your baseline is where progress is measured
    from."
  - Home test card (baseline done): eyebrow "PRACTICE TESTS", title "Take a practice test",
    body "25 questions, like the real test." or "Latest: {c} of {t} ({p}%) · +{d} points since
    your baseline" (down: "Latest: {c} of {t} ({p}%)"; comparison omitted when unknown)
  - Home weak spots: eyebrow "WORK ON THESE", one row per topic with its strength label

## Review Focus

1. **Practice result after a mini-quiz on the same topic** → `lastQuizMissedIds` and the saved
   deck pass are untouched. (Task 1 and Task 2 tests.)
2. **Recovering path + later reopen** → recorded once. (Task 2 set test, Task 3 flow tests.)
3. **Baseline reopened from Home** → nothing recorded. (Task 3.)
4. **A question missed in a mini-quiz, then right in a practice test** → off the list; the
   held-back sections of a baseline in progress never appear. (Task 4.)
5. **Offline with nothing cached** → the Practice row and comparisons hide; the missed screen
   shows `NoConnection`, nothing else breaks. (Tasks 5, 7, 9.)

---

### Task 1: `applyTestResults` (cards only)

**Files:**
- Modify: `src/study/cardPerformanceData.ts`
- Test: `src/study/cardPerformanceData.test.ts`

**Interfaces:**
- Produces: `export function applyTestResults(history: TopicHistory, results: PerQuestionResult[]): TopicHistory`

- [ ] **Step 1: Write the failing tests:**
  - `test('applyTestResults updates card counts like a quiz')` — same `cards` as
    `applyQuizResults` for the same input.
  - `test('applyTestResults keeps lastQuizMissedIds')` — history with
    `lastQuizMissedIds: ['q1']`, results missing `q2` → `lastQuizMissedIds` still `['q1']`.
  - `test('a right answer resets nothing it should not')` — a card with `missed: 1,
    correctStreak: 0` answered right → `correctStreak: 1`, `missed: 1`, `lastCorrect: true`.
- [ ] **Step 2:** `npm run test:app -- cardPerformanceData` → fails (no export).
- [ ] **Step 3: Implement** by extracting the per-card update from `applyQuizResults` into a
  private `applyToCards(cards, results)` used by both; `applyTestResults` returns
  `{ cards: applyToCards(...), lastQuizMissedIds: history.lastQuizMissedIds }`.
- [ ] **Step 4:** `npm run test:app -- cardPerformanceData` → passes, existing tests unchanged.
- [ ] **Step 5: Commit** `feat(ph-4-us-5): applyTestResults updates card history only`.

### Task 2: `recordTestResults` with a once-per-test guard

**Files:**
- Modify: `src/study/cardPerformance.ts`
- Test: `src/study/cardPerformance.test.ts`

**Interfaces:**
- Consumes: `applyTestResults`, `gradedByTopic`, `readTopicHistory`, `PREFIX`.
- Produces: `export async function recordTestResults(uid: string, testId: string, perQuestion: PerQuestionResult[]): Promise<void>`; `export const RECORDED_TESTS_LIMIT = 50`.

- [ ] **Step 1: Write the failing tests** (AsyncStorage mock, `AsyncStorage.clear()` in
  `beforeEach`, as the file does today):
  - `test('records a test once')` — call twice with the same `testId` → the topic's
    `cards.q1.graded === 1`.
  - `test('keeps the saved deck pass and last-quiz misses')` — seed
    `dmv-app:study:deck-position:u1:row` and a history with `lastQuizMissedIds: ['q9']`; record
    → both unchanged.
  - `test('skips recording when the recorded set cannot be read')` — `getItem` rejects for the
    set key → no `card-perf` write.
  - `test('keeps only the newest 50 IDs')` — record 51 tests → the set has 50, the first ID gone.
  - `test('removed and ungraded questions are ignored')` — `unavailable: true` and
    `correct: null` entries leave no card.
- [ ] **Step 2:** run → fails.
- [ ] **Step 3: Implement:** key `${PREFIX}card-perf-recorded:${uid}`; read and parse the set
  (anything unreadable → treat as a read failure and return without recording, logged); if
  `testId` is in it, return; for each topic from `gradedByTopic`, read history →
  `applyTestResults` → write (a failed write is logged; unlike quizzes, don't remove the key,
  since the quiz's missed-only list must survive); then write the set with `testId` appended,
  trimmed to the last `RECORDED_TESTS_LIMIT`.
- [ ] **Step 4:** run → passes.
- [ ] **Step 5: Commit** `feat(ph-4-us-5): record practice and baseline results once per test`.

### Task 3: Call it where tests are graded

**Files:**
- Modify: `src/practice/PracticeTestScreen.tsx`, `src/baseline/BaselineScreen.tsx`,
  `src/results/BaselineResults.tsx`
- Test: `src/practice/practiceTestFlow.test.tsx`, `src/baseline/BaselineScreen.test.tsx` (or the
  existing baseline flow test), `src/results/BaselineResults.test.tsx` if present

**Interfaces:**
- Consumes: `recordTestResults`.
- Produces: `BaselineResults` prop `onReviewReady?: (baselineReview: PerQuestionResult[]) => void`; `complete` phase field `justGraded: boolean`.

- [ ] **Step 1: Write the failing tests** (mock `../study/cardPerformance`):
  - Practice: after a successful submit, `recordTestResults` is called once with
    `(uid, testId, result.perQuestion)`.
  - Practice `already-exists`: the `Recovered` view calls it once with the attempt's
    `perQuestion` when the attempt loads; a re-render doesn't call it again (use a ref).
  - Practice results opened from Recent tests (`PracticeResultsScreen`): never called.
  - Baseline final section submitted: called once with `baselineReview`.
  - Baseline final section `already-exists`: called once after the final attempt loads.
  - Baseline reopened (progress already complete at load): never called.
- [ ] **Step 2:** `npm run test:components -- practiceTestFlow Baseline` → fails.
- [ ] **Step 3: Implement:**
  - `PracticeTestScreen`: after `finish(); await endSession(...)` on success, `void
    recordTestResults(uid, result.testId, result.perQuestion)` (don't await before showing
    results). In `Recovered`, a `useEffect` keyed on the loaded attempt, guarded by a
    `recordedRef`, records `attempt.data.perQuestion` when it's an array.
  - `BaselineScreen`: set `justGraded: true` at the submit path's `setPhase({ kind: 'complete',
    ... })` (both the fresh and `already-exists` cases); `false` in the load paths. Pass
    `onReviewReady={phase.justGraded ? (r) => void recordTestResults(uid, testId, r) : undefined}`.
  - `BaselineResults`: when `review` is set, or the attempt read returns an array
    `baselineReview`, call `onReviewReady` once (ref guard).
- [ ] **Step 4:** run → passes; `npm run test:components` all green.
- [ ] **Step 5: Commit** `feat(ph-4-us-5): practice and baseline results feed card performance`.

### Task 4: `latestMisses` and `groupByTopic`

**Files:**
- Create: `src/review/missedQuestions.ts`
- Test: `src/review/missedQuestions.test.ts`

**Interfaces:**
- Consumes: `toReviewItems`'s item parser (export the existing private `toItem` as
  `toReviewItem`), `Topic`.
- Produces:
  ```ts
  export interface AttemptDoc { testId: string; createdAtMs: number | null; data: Record<string, unknown> }
  export interface MissedQuestion { questionId: string; chunkId: string | null; testId: string; item: ReviewItem }
  export function latestMisses(attempts: AttemptDoc[]): MissedQuestion[]
  export interface MissedGroup { chunkId: string; title: string; questions: MissedQuestion[] }
  export function groupByTopic(misses: MissedQuestion[], topics: Topic[]): MissedGroup[]
  ```

- [ ] **Step 1: Write the failing tests:**
  - missed in A, right in later B → not listed; missed in both → listed once, `testId` = later.
  - mini-quiz miss then practice right (same `questionId`) → not listed.
  - `unavailable` entries and `correct: null` entries are skipped (neither a miss nor a "right"
    that clears an earlier miss).
  - baseline final attempt (has `baselineReview`) → uses `baselineReview` only; its
    `perQuestion` is ignored; earlier section attempts (all `correct: null`) add nothing.
  - skipped (`choice: null`, `correct: false`) counts as missed.
  - `createdAtMs: null` sorts as newest.
  - malformed docs (no `perQuestion`, not an array) are ignored, not thrown.
  - `groupByTopic`: handbook order from `topics`, unknown `chunkId`s after them titled by id,
    `chunkId: null` grouped last under "Other".
- [ ] **Step 2:** `npm run test:app -- missedQuestions` → fails.
- [ ] **Step 3: Implement:** sort attempts newest first; walk them, and for each graded entry
  whose `questionId` hasn't been seen yet, record its outcome; keep the ones whose outcome is
  `wrong` or `skipped`. Entries per attempt: `data.baselineReview` if it's an array, else
  `data.perQuestion`.
- [ ] **Step 4:** run → passes.
- [ ] **Step 5: Commit** `feat(ph-4-us-5): latest-result missed questions, grouped by topic`.

### Task 5: `useRecentAttempts`

**Files:**
- Create: `src/review/recentAttempts.ts`, `src/review/useRecentAttempts.ts`
- Test: `src/review/useRecentAttempts.test.tsx`

**Interfaces:**
- Produces: `subscribeRecentAttempts(uid, onChange: (docs: AttemptDoc[]) => void, onError)`;
  `useRecentAttempts(): { status: 'loading' } | { status: 'ready'; attempts: AttemptDoc[] } | { status: 'error' }`;
  `export const MISSED_ATTEMPTS_LIMIT = 30`.

- [ ] **Step 1: Write the failing tests** (mock `./recentAttempts`, as
  `usePracticeAttempts.test.tsx` does): resets to loading on uid change; error before data →
  `error`; error after data keeps the data.
- [ ] **Step 2:** run → fails.
- [ ] **Step 3: Implement** copying `practiceAttempts.ts` / `usePracticeAttempts.ts`: query
  `users/{uid}/testAttempts` `orderBy('createdAt', 'desc')`, `limit(30)` (single-field index,
  automatic); map each doc to `AttemptDoc` (`createdAt?.toMillis?.() ?? null`).
- [ ] **Step 4:** run → passes.
- [ ] **Step 5: Commit** `feat(ph-4-us-5): live read of the newest 30 attempts`.

### Task 6: Review one question

**Files:**
- Modify: `src/navigation/types.ts` (`Review: { testId: string; questionId?: string }`),
  `src/review/ReviewScreen.tsx`
- Test: `src/review/ReviewScreen.test.tsx`

- [ ] **Step 1: Write the failing tests:** with `questionId`, only that item shows, no
  missed-only toggle, no Next/Previous, a "Back" button; with an unknown `questionId`, the
  existing "No review yet"-style empty state with "This question isn't in that test any more.";
  an item without text shows the existing "Question text unavailable" fallback.
- [ ] **Step 2:** run → fails.
- [ ] **Step 3: Implement:** read `questionId` from params; when set, `shown = items.filter(i =>
  i.questionId === questionId)` and hide the toggle and pager.
- [ ] **Step 4:** run → passes; existing Review tests unchanged.
- [ ] **Step 5: Commit** `feat(ph-4-us-5): Review can open a single question`.

### Task 7: Missed questions screen, Practice row, results links

**Files:**
- Create: `src/review/MissedQuestionsScreen.tsx`
- Modify: `src/navigation/types.ts` (`MissedQuestions: undefined`),
  `src/navigation/RootNavigator.tsx` (root stack screen, title "Missed questions"),
  `src/practice/PracticeHomeScreen.tsx`, `src/practice/PracticeResults.tsx`,
  `src/results/BaselineResults.tsx`
- Test: `src/review/MissedQuestionsScreen.test.tsx`, `src/practice/PracticeHomeScreen.test.tsx`,
  `src/practice/PracticeResults.test.tsx`

**Interfaces:**
- Consumes: `useRecentAttempts`, `latestMisses`, `groupByTopic`, `useTopics`,
  `useBaselineProgress`, `openConcept`.

- [ ] **Step 1: Write the failing tests:**
  - Screen: groups and counts render in handbook order; tapping a question navigates to
    `Review` with `{ testId, questionId }`; "Study this concept" calls `openConcept`; empty with
    attempts and no misses → "Nothing to go over right now"; no attempts → "No missed questions
    yet" with "Start your baseline"; error → `NoConnection`.
  - Practice row: hidden with zero attempts; "Missed questions · 3"; "Missed questions · none
    right now"; tap → `MissedQuestions`.
  - Results: "Go over missed questions" on practice and baseline results navigates to
    `MissedQuestions`.
- [ ] **Step 2:** run → fails.
- [ ] **Step 3: Implement** with a `SectionList` (header per group with count and the Study
  button; rows show the question text, or "Question text unavailable", two lines max). Copy as
  in Global Constraints.
- [ ] **Step 4:** run → passes.
- [ ] **Step 5: Commit** `feat(ph-4-us-5): missed questions screen and entry points`.

### Task 8: Baseline score and comparison helpers

**Files:**
- Create: `src/progress/scoreComparison.ts`, `src/progress/useBaselineScore.ts`
- Test: `src/progress/scoreComparison.test.ts`, `src/progress/useBaselineScore.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface Comparison { baselinePercent: number; practicePercent: number; change: number }
  export function compareToBaseline(baselinePercent: number, correctCount: number, totalCount: number): Comparison | null
  export function comparisonLine(c: Comparison, label: 'This test' | 'Latest'): string
  export type BaselineScoreState =
    | { status: 'loading' } | { status: 'none' } | { status: 'in-progress' }
    | { status: 'ready'; percent: number } | { status: 'unknown' }
  export function useBaselineScore(): BaselineScoreState
  ```

- [ ] **Step 1: Write the failing tests:** 27/45 vs 19/25 → `{60, 76, 16}`, line "Baseline 60% →
  This test 76% · +16 points"; equal → "same as your baseline"; lower → the "Keep going" line, no
  minus sign shown; 44 graded (one removed) uses 44; `totalCount: 0` → null. Hook: not started →
  `none`; in progress → `in-progress`; complete + attempt ready → `ready` with
  `summarizeBaseline(...).percent`; attempt error → `unknown`.
- [ ] **Step 2:** run → fails.
- [ ] **Step 3: Implement**; the hook combines `useBaselineProgress`, `useTestAttempt(finalBaselineTestId(version))`,
  `toReviewItems` and `summarizeBaseline` (topics aren't needed for the percent: pass `[]`).
- [ ] **Step 4:** run → passes.
- [ ] **Step 5: Commit** `feat(ph-4-us-7): baseline score and comparison helpers`.

### Task 9: Comparison on practice results and the Progress tab

**Files:**
- Modify: `src/practice/PracticeResults.tsx`, `src/progress/ConceptReportScreen.tsx`
- Create: `src/progress/ScoreSummaryCard.tsx`
- Test: `src/practice/PracticeResults.test.tsx`, `src/progress/ScoreSummaryCard.test.tsx`,
  `src/progress/ConceptReportScreen.test.tsx`

- [ ] **Step 1: Write the failing tests:** practice results show the line for the outcome being
  shown (D11); `in-progress` → "Finish your baseline…"; `none`, `unknown`, `loading` → nothing.
  Summary card: ready + latest practice → three lines; ready + no practice → invite + button to
  the Practice tab; none / in-progress → baseline button; loading or unknown → card hidden; the
  practice attempts list errored → baseline only.
- [ ] **Step 2:** run → fails.
- [ ] **Step 3: Implement:** `PracticeResults` uses `useBaselineScore` +
  `compareToBaseline(…, outcome.correctCount, outcome.totalCount)`; `ScoreSummaryCard` uses
  `useBaselineScore` + `usePracticeAttempts()` (first item is the latest); placed in the report's
  `ListHeaderComponent` above the description, and in the report's empty state too.
- [ ] **Step 4:** run → passes.
- [ ] **Step 5: Commit** `feat(ph-4-us-7): latest score vs baseline on results and Progress`.

### Task 10: Home test card and weak spots

**Files:**
- Modify: `src/home/HomeScreen.tsx`
- Create: `src/home/WeakSpotsCard.tsx`
- Test: `src/home/HomeScreen.test.tsx` (create if missing, mocking the data hooks)

- [ ] **Step 1: Write the failing tests:** baseline complete + no practice → "Take a practice
  test" / "25 questions, like the real test." → navigates to the Practice tab; with a latest
  test → "Latest: 19 of 25 (76%) · +16 points since your baseline"; lower → no points; unknown
  baseline → no comparison; not-started and in-progress baseline cards unchanged. Weak spots:
  hidden without likely-gap/missed-it rows; up to 3 in handbook order; tap → `openConcept`.
  Order: countdown, test, study, weak spots.
- [ ] **Step 2:** run → fails.
- [ ] **Step 3: Implement:** replace the `complete` branch of `TestCard`; add
  `<WeakSpotsCard />` after `<StudyCard />` (uses `useConceptEvidence`, renders nothing until
  `ready`). Update the file's order comment.
- [ ] **Step 4:** run → passes.
- [ ] **Step 5: Commit** `feat(ph-9-us-7): Home practice card and weak spots`.

### Task 11: Checks, device test, docs

- [ ] **Step 1:** `npx tsc --noEmit`, `npm run test:app`, `npm run test:components` all green
  (record counts). No functions or rules changes, so `test:functions` / `test:rules` aren't
  needed; run them once anyway if cheap.
- [ ] **Step 2: Device test** on the Android emulator against `dmv-app-dev`, steps 1–8 of the
  spec's "Device test" (fresh user via cleared app data).
- [ ] **Step 3: Docs:** ph-4-us-5 and ph-4-us-7 Complete with decisions D1/D3/D4/D6 and
  D10–D12; ph-4-us-1 Complete; ph-9-us-7 test-card and weak-spots criteria checked; Phase 4 and
  Phase 9 summaries; `build-order.md` 5b-2 status (and the 5b review carry-forwards marked done);
  `docs/history/LOG.md` entry.
- [ ] **Step 4: Commit** `docs: Slice 5b-2 complete`.
