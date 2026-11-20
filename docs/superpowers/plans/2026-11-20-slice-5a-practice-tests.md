# Slice 5a — Practice Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Practice tab lets a teen start (or resume) a realistic 25-question practice test,
see "N of 25" with pass / not-yet against 20 of 25 and the topics to work on, review it, find it
again under Recent tests, and have its answers count in the Progress tab's concept report.

**Architecture:** One backend change: `assembleTest` picks questions through a new pure
`selectPracticeQuestions` (scenario minimum, per-topic cap). One Firestore composite index for
the practice-attempts query. On the app: the session store gets one slot per kind; pure helpers
in `src/practice/practiceData.ts` (outcome parsing, pass line, topics to work on, evidence sums)
under a thin Firestore subscription hook; three screens (`PracticeHomeScreen` on the tab,
`PracticeTestScreen` above the tabs on the shared `QuizRunner`, `PracticeResultsScreen` for
reopening a saved test) sharing one `PracticeResults` view.

**Tech Stack:** Firebase Cloud Functions v2 + Admin SDK on Node 22 (Jest against the Firestore
emulator, `npm run test:functions`), Firestore indexes, Expo SDK 57, React Navigation 7,
`@react-native-firebase/firestore` / `functions` modular API, AsyncStorage, Jest (`test:app` =
Node ts-jest for `*.test.ts`, `test:components` = jest-expo for `*.test.tsx`).

**Spec:** `docs/superpowers/specs/2026-11-20-slice-5a-practice-tests-design.md` (decisions 1–7),
and the stories it points to: `docs/phases/phase-3-practice-test-generator-and-test-taking-ui/`
ph-3-us-1, 2, 3, 4 and `docs/phases/phase-4-scoring-and-review/` ph-4-us-1, ph-4-us-6. Backend
contract: `functions/README.md`.

## Decisions made while planning (flag to the user at review)

- **Results after submit show in place** (a `results` phase of `PracticeTestScreen`, from the
  in-memory `scoreTest` result). Reopening from Recent tests uses a separate
  `PracticeResults: { testId }` route that reads the attempt. Both render the same view.
- **"Take another test" and "Start a practice test" share one helper** that asks before
  discarding an unfinished test, so the confirm can't be skipped from the results screen.
- **Leaving mid-test is not destructive**: the alert says the answers are saved and the test
  can be resumed from the Practice tab.
- **Pass is computed in whole answers**: `needed = ceil(0.8 × total)` with a small epsilon, and
  pass is `correct >= needed`, so floating-point `0.8 × 24` can't misjudge a 24-question test.
- **`SessionKind` drops `'mini-quiz'`** (nothing stores one since Slice 4b).
- **Topics missing from `topics`** (e.g. a retired chunk) are left out of "Topics to work on".

## Global Constraints

- Colors, spacing, radius and type only from `src/theme/tokens.ts`. Reuse `Button`, `Card`,
  `NoConnection`, `QuizRunner`, `ReviewScreen`. Tap targets ≥ 48pt.
- Pass mark: `PASS_MARK = 0.8` from `src/results/passMark.ts` (one source; do not redefine).
- `MIN_SCENARIO_COUNT = 8`, `MAX_PER_TOPIC = 2`, `DEFAULT_QUESTION_COUNT = 25` (functions).
- `MIN_PRACTICE_ANSWERS = 2` (decision 7). `RECENT_PRACTICE_LIMIT = 10` (decisions 2 and 3).
- `TOPICS_TO_WORK_ON_LIMIT = 5` (decision 6).
- Session keys: `dmv-app:active-test:{uid}:{kind}`; legacy `dmv-app:active-test:{uid}` migrates.
- No "fail" wording anywhere; "Pass" / "Not yet" on chips. No confetti, streaks or badges.
- Cloud Function doc comments follow the `cloud-function-documentation` skill.
- Copy (exact):
  - Practice home: "Practice tests" (h1); "25 questions, like the real Colorado test. You need
    20 right to pass."; button "Start a practice test"; "Based on the Colorado Driver
    Handbook."; "Recent tests"; empty "Your tests will show here."
  - Resume card: "You have a test in progress"; "{n} of {total} answered"; buttons "Resume",
    "Discard". Discard alert: "Discard this test?" / "Your answers will be lost." / "Cancel",
    "Discard".
  - New-while-saved alert: "Start a new test?" / "Your unfinished test will be discarded." /
    "Cancel", "Start new".
  - Leave alert: "Leave the test?" / "Your answers are saved. You can resume it from the
    Practice tab." / "Stay", "Leave".
  - Runner title: "Practice test".
  - Results: "{c} of {t} correct" (stat), "{p}%"; pass "You'd pass the real test. It needs
    {needed} of {t}."; not yet "{k} more right {answer|answers} to pass ({needed} of {t}
    needed). Every test helps."; left out "{n} {question was|questions were} removed from the
    bank, so this test is scored out of {t}."; "Topics to work on"; row "{m} missed"; more
    "and {n} more — see Review answers"; none "You didn't miss a single topic."; buttons
    "Take another test", "Review answers", "Back to Practice".
  - Concept report empty state: "Take the baseline, a practice test or a concept's mini-quiz,
    and this shows which concepts you've got and which need work."; subtitle "A rough guide
    from your quizzes, practice tests and baseline."

## Review Focus

1. **A baseline section and a practice test both in progress, then a force-quit**: both come
   back with their answers. → Task 4 test `baseline and practice sessions live side by side`.
2. **A question deleted from the bank after the test was handed out** (`unavailable`): scored
   out of 24, pass needs 20 of 24, the left-out line shows. → Task 2 tests.
3. **Submit while offline**: answers held, sent on reconnect, then results. → Task 7 test.
4. **Double submit / lost response** (`already-exists`): the saved attempt's results show, not
   an error, and the session is cleared. → Task 7 test.
5. **Recent tests read fails or is offline with nothing cached**: the empty state, not an error.
   → Task 8 test.

---

### Task 1: `assembleTest` builds a realistic mix (ph-3-us-3)

**Files:**
- Modify: `functions/src/assembleTest.ts`
- Test: `functions/src/assembleTest.test.ts`
- Modify: `functions/README.md` (`assembleTest` section)

**Interfaces:**
- Produces:
  ```ts
  export const MIN_SCENARIO_COUNT = 8;
  export const MAX_PER_TOPIC = 2;
  export interface SelectableQuestion { type?: unknown; chunkId?: unknown }
  export function selectPracticeQuestions<T>(
    pool: T[], count: number, random: () => number,
    opts: { minScenario: number; maxPerTopic: number },
    describe: (item: T) => SelectableQuestion
  ): T[];
  ```
  (`describe` maps a Firestore doc to its fields: `(doc) => doc.data()`.) `assembleTestForUser`'s
  inputs, outputs and the `testAssignments` write are unchanged.

- [ ] **Step 1: Write failing pure tests** in a new `describe('selectPracticeQuestions')` block
  (no emulator data needed; items are plain objects `{ id, type, chunkId }`, `describe = (x) => x`).
  Use a seeded random (`seededRandom` from `./shuffle`) over seeds 1..200:
  - `meets the scenario minimum and topic cap across seeds`: pool of 45 topics × 6 questions
    (2 scenario, 4 fact each). Every result: length 25, ≥ 8 scenario, no `chunkId` > 2, no
    duplicates.
  - `includes every scenario question when there are fewer than the minimum`: 3 scenario + 60
    fact over 30 topics → all 3 scenario present, length 25.
  - `works with no scenario questions`: 60 fact over 30 topics → length 25, ≤ 2 per topic.
  - `scenario minimum wins over the topic cap`: 12 scenario in 3 topics + 100 fact over 50
    topics → ≥ 8 scenario (decision 4).
  - `relaxes the cap to fill the test`: 40 questions all in 2 topics → length 25.
  - `returns the whole pool when it is smaller than count`: 10 questions → length 10.
  - `missing or odd type counts as fact`: 30 items with `type: undefined` / `'weird'` and 0
    scenario over 15 topics → length 25 and no error.
  - `scenario questions are not grouped`: for seed 7 on the first pool, the scenario positions
    are not exactly `0..k-1` and not the last `k`.
- [ ] **Step 2: Run, expect failure**: `npm run test:functions` (the emulator wrapper doesn't
  pass a `-t` filter through) → the new tests FAIL, `selectPracticeQuestions` is not exported.
- [ ] **Step 3: Implement `selectPracticeQuestions`** in `functions/src/assembleTest.ts`, in the
  order the spec gives: shuffle once; scenario pass under the cap; scenario relax pass ignoring
  the cap until `minScenario`; fill pass under the cap; relax pass ignoring the cap; final
  shuffle. A `type` other than `'scenario'` is fact. Track taken items by index, not identity.
- [ ] **Step 4: Wire it in**: `assembleTestForUser` replaces `shuffle(...).slice(0, count)` with
  `selectPracticeQuestions(snapshot.docs, count, random, { minScenario: MIN_SCENARIO_COUNT,
  maxPerTopic: MAX_PER_TOPIC }, (d) => d.data())`. Update its doc comment (selection rules,
  constants) and add a summary doc comment on `selectPracticeQuestions`. Add one emulator test
  `assembleTestForUser applies the mix`: seed 10 scenario + 30 fact over 20 topics, call with a
  seeded random → ≥ 8 scenario, ≤ 2 per topic.
- [ ] **Step 5: Run all functions tests**: `npm run test:functions` → all pass (86 before + new).
  Existing tests that assumed pure shuffle-then-slice order (`selection order depends on the
  injected random source`) may need their expectations rewritten, not their intent.
- [ ] **Step 6: Document** the mix rules, constants and fallbacks under `assembleTest` in
  `functions/README.md`.
- [ ] **Step 7: Commit**: `feat(ph-3-us-3): assembleTest guarantees a scenario minimum and caps each topic`

---

### Task 2: Practice data helpers

**Files:**
- Create: `src/practice/practiceData.ts`
- Test: `src/practice/practiceData.test.ts`

**Interfaces:**
- Consumes: `PASS_MARK` (`src/results/passMark.ts`); `ScoreTestResult`, `PerTopicResult`,
  `PerQuestionResult` (`src/api/types.ts`); `Topic` (`src/topics/topicsData.ts`).
- Produces (no Firebase imports):
  ```ts
  export const RECENT_PRACTICE_LIMIT = 10;
  export const TOPICS_TO_WORK_ON_LIMIT = 5;
  export interface PracticeOutcome {
    testId: string; createdAt: Date | null;
    correctCount: number; totalCount: number;
    perTopic: PerTopicResult[]; unavailableCount: number;
  }
  export function fromPracticeScore(result: ScoreTestResult): PracticeOutcome;   // createdAt null
  export function fromPracticeAttempt(testId: string, data: Record<string, unknown> | undefined): PracticeOutcome | null;
  export function neededToPass(totalCount: number): number;                      // ceil(PASS_MARK*t - 1e-9)
  export function passed(o: Pick<PracticeOutcome, 'correctCount' | 'totalCount'>): boolean;
  export function scoreLine(o: PracticeOutcome): string;     // "17 of 25 correct"
  export function percentLine(o: PracticeOutcome): string;   // "68%"
  export function passLine(o: PracticeOutcome): string;
  export function leftOutLine(o: PracticeOutcome): string | null;
  export interface TopicToWorkOn { chunkId: string; title: string; missed: number }
  export function topicsToWorkOn(perTopic: PerTopicResult[], topics: Topic[], limit?: number):
    { shown: TopicToWorkOn[]; moreCount: number };
  export function sumPracticeEvidence(outcomes: PracticeOutcome[]): Map<string, { correct: number; total: number }>;
  export function attemptDateLabel(date: Date | null): string;  // "Nov 20"; null → "Just now"
  ```
  `fromPracticeAttempt` returns null unless `data.type === 'practice'` and `correctCount`,
  `totalCount` are numbers and `perTopic` is an array; `createdAt` comes from
  `data.createdAt?.toDate?.()`; `unavailableCount` counts `perQuestion` items with
  `unavailable: true`.

- [ ] **Step 1: Write failing tests** (exact copy from Global Constraints):
  - `neededToPass`: 25 → 20, 24 → 20, 20 → 16, 0 → 0.
  - `passed`: 20/25 true, 19/25 false, 20/24 true, 19/24 false.
  - `passLine`: 22/25 → "You'd pass the real test. It needs 20 of 25."; 17/25 → "3 more right
    answers to pass (20 of 25 needed). Every test helps."; 19/25 → "1 more right answer to
    pass (20 of 25 needed). Every test helps."
  - `scoreLine` 17/25 → "17 of 25 correct"; `percentLine` 17/25 → "68%"; 0/0 → "0%".
  - `leftOutLine`: 0 → null; 1 with total 24 → "1 question was removed from the bank, so this
    test is scored out of 24."; 2 with total 23 → "2 questions were removed from the bank, so
    this test is scored out of 23."
  - `topicsToWorkOn`: misses sorted desc, ties in topic `order`; topics with 0 misses and
    chunkIds not in `topics` left out; 7 missed topics with limit 5 → 5 shown, `moreCount` 2.
  - `fromPracticeAttempt`: a mini-quiz attempt → null; missing `perTopic` → null; a valid one
    with a `createdAt` `{ toDate: () => date }` and one `unavailable` question → the outcome.
  - `fromPracticeScore` maps a `ScoreTestResult` with `createdAt: null`.
  - `sumPracticeEvidence`: two outcomes both with `row` 1/2 → `row` `{ correct: 2, total: 4 }`.
  - `attemptDateLabel(new Date(2026, 10, 20))` → "Nov 20"; null → "Just now".
- [ ] **Step 2: Run, expect failure**: `npm run test:app -- practiceData` → FAIL (module missing).
- [ ] **Step 3: Implement** `src/practice/practiceData.ts` with a header comment naming
  ph-4-us-1 / ph-4-us-6.
- [ ] **Step 4: Run**: `npm run test:app -- practiceData` → PASS.
- [ ] **Step 5: Commit**: `feat(ph-4-us-1): practice outcome, pass line and topics to work on`

---

### Task 3: Practice attempts query and index

**Files:**
- Modify: `firestore.indexes.json`
- Create: `src/practice/practiceAttempts.ts`, `src/practice/usePracticeAttempts.ts`
- Test: `src/practice/usePracticeAttempts.test.tsx`

**Interfaces:**
- Consumes: `fromPracticeAttempt`, `RECENT_PRACTICE_LIMIT`, `PracticeOutcome` (Task 2).
- Produces:
  ```ts
  // practiceAttempts.ts
  export function subscribePracticeAttempts(
    uid: string, onChange: (outcomes: PracticeOutcome[]) => void, onError: (error: unknown) => void
  ): () => void;
  // usePracticeAttempts.ts
  export type PracticeAttemptsState =
    | { status: 'loading' } | { status: 'ready'; attempts: PracticeOutcome[] } | { status: 'error' };
  export function usePracticeAttempts(): PracticeAttemptsState;
  ```

- [ ] **Step 1: Add the index** to `firestore.indexes.json`: collection group `testAttempts`,
  query scope `COLLECTION`, fields `type` ASCENDING, `createdAt` DESCENDING.
- [ ] **Step 2: Write failing hook tests** (mock `./practiceAttempts` and `../auth/AuthProvider`,
  like `useConceptEvidence.test.tsx`): starts `loading`; `onChange` → `ready` with the
  attempts; `onError` before any data → `error`; `onError` after data keeps the last `ready`;
  no uid → `ready` with `[]`; uid change resubscribes and resets to `loading`.
- [ ] **Step 3: Run, expect failure**: `npm run test:components -- usePracticeAttempts` → FAIL.
- [ ] **Step 4: Implement** `subscribePracticeAttempts` with the modular API: `onSnapshot(query(
  collection(getFirestore(getApp()), 'users', uid, 'testAttempts'), where('type', '==',
  'practice'), orderBy('createdAt', 'desc'), limit(RECENT_PRACTICE_LIMIT)), ...)`, mapping docs
  through `fromPracticeAttempt` and dropping nulls. Implement the hook on the
  `useConceptProgress` pattern.
- [ ] **Step 5: Run**: `npm run test:components -- usePracticeAttempts` → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 6: Commit**: `feat(ph-4-us-1): live recent practice attempts, with their Firestore index`

---

### Task 4: One saved session per kind (ph-3-us-1, decision 1)

**Files:**
- Modify: `src/quiz/quizSession.ts`, `src/baseline/BaselineScreen.tsx`
- Test: `src/quiz/quizSession.test.ts`, existing `src/baseline/baselineFlow.test.tsx`

**Interfaces:**
- Produces (signatures change; every caller passes the kind):
  ```ts
  export type SessionKind = 'baseline' | 'practice';
  export const CACHE_WARNING: string;   // moved from BaselineScreen, text unchanged
  export function startSession(uid: string, testId: string, kind: SessionKind, questions: QuizQuestion[]): Promise<void>;
  export function saveAnswers(uid: string, kind: SessionKind, testId: string, answers: Answers): Promise<void>;
  export function getActiveSession(uid: string, kind: SessionKind): Promise<ActiveSession | null>;
  export function endSession(uid: string, kind: SessionKind, testId: string): Promise<void>;
  ```

- [ ] **Step 1: Update existing tests** to the new signatures and add failing ones:
  - `baseline and practice sessions live side by side`: start baseline `b1` and practice `p1`,
    save answers on each, then `getActiveSession(u1,'baseline')` and `(u1,'practice')` each
    return their own questions and answers.
  - `starting a practice session replaces only the earlier practice session`: practice `p1`
    then `p2` → `p1`'s cache is cleared (`getTestCache('p1')` null), baseline untouched.
  - `ending one kind leaves the other`.
  - `a legacy baseline session migrates`: write `dmv-app:active-test:u1` =
    `{ testId:'b1', kind:'baseline', answers:{q1:'a'} }` plus the cached questions →
    `getActiveSession(u1,'baseline')` returns it, the legacy key is gone and the new key is set;
    `getActiveSession(u1,'practice')` with only a legacy baseline returns null and leaves it.
- [ ] **Step 2: Run, expect failure**: `npm run test:app -- quizSession` → FAIL.
- [ ] **Step 3: Implement**: key `dmv-app:active-test:{uid}:{kind}`; reading a kind with no new
  key checks the legacy key and moves it only when its `kind` matches. Export `CACHE_WARNING`.
- [ ] **Step 4: Update `BaselineScreen`** to pass `'baseline'` to all four calls and import
  `CACHE_WARNING`. Its offline fallback no longer needs the `active?.kind === 'baseline'` check.
- [ ] **Step 5: Run**: `npm run test:app` and `npm run test:components -- baseline` → PASS.
- [ ] **Step 6: Commit**: `feat(ph-3-us-1): keep one saved session per kind so practice can't drop the baseline`

---

### Task 5: Practice evidence in the concept report (ph-4-us-6, decisions 3 and 7)

**Files:**
- Modify: `src/progress/conceptStrength.ts`, `src/progress/useConceptEvidence.ts`,
  `src/progress/ConceptReportScreen.tsx`
- Test: `src/progress/conceptStrength.test.ts`, `src/progress/useConceptEvidence.test.tsx`,
  `src/progress/ConceptReportScreen.test.tsx`

**Interfaces:**
- Consumes: `usePracticeAttempts` (Task 3), `sumPracticeEvidence` (Task 2).
- Produces: `MIN_PRACTICE_ANSWERS = 2`; `toReportRows(topics, progress, baseline, practice?:
  Map<string, { correct: number; total: number }>)` (defaults to an empty map).

- [ ] **Step 1: Failing tests**:
  - `conceptStrength.test.ts`: rename `practice needs at least 3 answers` to `… 2 answers`:
    `{correct:1,total:1}` + baseline missed-it → baseline; `{correct:2,total:2}` → strong
    practice; `{correct:1,total:2}` → shaky; `{correct:0,total:2}` → likely-gap.
  - `toReportRows` with a practice map → that topic's source is `practice`; mini-quiz still wins.
  - `useConceptEvidence.test.tsx` (mock `../practice/usePracticeAttempts`): two practice
    attempts with `row` 1/1 each → row strength from practice, 2 of 2; practice `error` → report
    still `ready` without practice evidence; practice `loading` → `loading`.
  - `ConceptReportScreen.test.tsx`: empty-state and subtitle copy from Global Constraints.
- [ ] **Step 2: Run, expect failure**: `npm run test:app -- conceptStrength` and
  `npm run test:components -- progress` → FAIL.
- [ ] **Step 3: Implement** the constant, the `toReportRows` parameter, the hook (sum the ready
  attempts with `sumPracticeEvidence`), and the two copy changes.
- [ ] **Step 4: Run**: both suites → PASS.
- [ ] **Step 5: Commit**: `feat(ph-4-us-6): practice tests feed the concept report; 2 answers is enough`

---

### Task 6: Practice results view (ph-4-us-1, ph-4-us-6 topics to work on)

**Files:**
- Create: `src/practice/PracticeResults.tsx`
- Test: `src/practice/PracticeResults.test.tsx`

**Interfaces:**
- Consumes: Task 2 helpers; `Topic`.
- Produces:
  ```ts
  export function PracticeResults(props: {
    outcome: PracticeOutcome; topics: Topic[];
    onOpenTopic: (chunkId: string) => void; onReview: () => void;
    onTakeAnother: () => void; onBack: () => void;
  }): JSX.Element;
  ```
  Layout: stat score line, percent, pass line (success color when passed, `ink` otherwise),
  optional left-out line, "Topics to work on" rows as tappable `Card`s (title + "{m} missed"),
  the more line or the none line, then "Take another test" (primary), "Review answers"
  (secondary), "Back to Practice" (text).

- [ ] **Step 1: Failing tests**: 22/25 shows "22 of 25 correct", "88%", the pass line; 17/25
  shows the not-yet line and no word "fail" (case-insensitive) anywhere in the tree; a topic
  row tap calls `onOpenTopic('row')`; 7 missed topics show 5 rows and "and 2 more — see Review
  answers"; no misses shows "You didn't miss a single topic."; an outcome with
  `unavailableCount: 1` shows the left-out line; each button calls its handler.
- [ ] **Step 2: Run, expect failure**: `npm run test:components -- PracticeResults` → FAIL.
- [ ] **Step 3: Implement** in the `MiniQuizResults` style (ScrollView, tokens only).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit**: `feat(ph-4-us-1): practice results with pass line and topics to work on`

---

### Task 7: Practice test screen (ph-3-us-4, ph-3-us-1)

**Files:**
- Create: `src/practice/PracticeTestScreen.tsx`, `src/practice/startPracticeTest.ts`
- Modify: `src/navigation/types.ts`, `src/navigation/RootNavigator.tsx`
- Test: `src/practice/practiceTestFlow.test.tsx`

**Interfaces:**
- Consumes: `assembleTest`, `scoreTest` (`src/api/callables.ts`); Task 4 session API;
  `fromPracticeScore`, `fromPracticeAttempt` (Task 2); `PracticeResults` (Task 6); `useTopics`;
  `openConcept`; `useTestAttempt`; `toAnswerList`.
- Produces:
  ```ts
  // navigation/types.ts, RootStackParamList
  PracticeTest: { resume?: boolean } | undefined;
  PracticeResults: { testId: string };      // screen added in Task 8
  // startPracticeTest.ts
  export function startPracticeTest(navigation: NavigationProp<RootStackParamList>, uid: string,
    mode: 'navigate' | 'replace'): Promise<void>;
  ```
  `startPracticeTest` checks `getActiveSession(uid,'practice')`; with one saved it shows the
  new-while-saved alert and, on "Start new", `endSession`s it first; then navigates (or
  replaces) to `PracticeTest`. Register `PracticeTest` on the root stack with title "Practice
  test".

  Screen phases mirror `MiniQuizScreen`: `loading | running | recovering | results | offline |
  error`. Load: with `resume`, use the saved practice session (no `assembleTest`); if none, or
  without `resume`, call `assembleTest`, then `startSession(uid, testId, 'practice',
  questions)` before showing question 1 (a rejected write shows `CACHE_WARNING` as the
  runner's `notice`). `onAnswersChange` → `saveAnswers`. Submit: offline holds answers and sends
  on reconnect; success → `endSession`, then `results` from `fromPracticeScore`;
  `already-exists` → `endSession`, then `recovering` (reads the attempt with `useTestAttempt`
  and `fromPracticeAttempt`). Leaving while `running` and not submitting → leave alert (Stay /
  Leave keeps the session). Results: `onOpenTopic` → `openConcept`; `onReview` → `Review`;
  `onTakeAnother` → `startPracticeTest(..., 'replace')`; `onBack` → `popTo('Main', { screen:
  'PracticeTests' })`.

- [ ] **Step 1: Failing flow tests** (pattern of `miniQuizFlow.test.tsx`: mock callables,
  auth, topics, `useTestAttempt`, the subscribable `useIsOnline`; real AsyncStorage mock):
  - `starts a test, caches it, answers save, submit shows results`: after load the practice
    session exists with the questions; tapping a choice saves it; submit → `scoreTest` called
    with the answers → "1 of 2 correct" shows and the practice session is gone.
  - `resume uses the saved session without calling assembleTest`: pre-start a practice session
    with an answer → `assembleTest` not called, the answer is selected.
  - `offline submit holds the answers and sends on reconnect` (Review Focus 3).
  - `already-exists shows the saved attempt` (Review Focus 4): `scoreTest` rejects with
    `CallableError` kind `already-exists`, `mockAttempt` ready with a practice attempt → its
    score shows; session cleared.
  - `assembleTest offline shows No connection; another error shows Something went wrong`.
  - `a cache write failure shows the warning` (`AsyncStorage.setItem` rejects once).
  - `startPracticeTest asks before discarding a saved test` (spy on `Alert.alert`; pressing
    "Start new" clears the session and navigates; "Cancel" does neither).
- [ ] **Step 2: Run, expect failure**: `npm run test:components -- practiceTestFlow` → FAIL.
- [ ] **Step 3: Implement** the route types, `startPracticeTest`, the screen and its
  registration.
- [ ] **Step 4: Run**: `npm run test:components` → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit**: `feat(ph-3-us-4): practice test on the shared runner with resume and results`

---

### Task 8: Practice tab home and reopening results (ph-3-us-4, ph-4-us-1)

**Files:**
- Create: `src/practice/PracticeHomeScreen.tsx`, `src/practice/PracticeResultsScreen.tsx`
- Modify: `src/navigation/RootNavigator.tsx` (Practice stack and `PracticeResults` route)
- Test: `src/practice/PracticeHomeScreen.test.tsx`, `src/practice/PracticeResultsScreen.test.tsx`

**Interfaces:**
- Consumes: `usePracticeAttempts` (Task 3), `getActiveSession` / `endSession` (Task 4),
  `startPracticeTest` (Task 7), `PracticeResults`, `fromPracticeAttempt`, `passed`,
  `attemptDateLabel` (Tasks 2, 6), `useTestAttempt`, `useTopics`.
- Produces: `PracticeHomeScreen` replaces `makeStack('PracticeTestsHome', …)` (a stack like
  `ProgressStack`, title "Practice Tests"). `PracticeResultsScreen` registered on the root stack
  as `PracticeResults`, title "Results".

  Home re-reads the saved practice session on focus (`useFocusEffect`). Resume card shows
  answered count (`Object.keys(answers).length` of `questions.length`); Resume →
  `navigate('PracticeTest', { resume: true })`; Discard → discard alert → `endSession`.
  "Start a practice test" → `startPracticeTest(..., 'navigate')`. Recent tests: one row per
  attempt, "{date} · {c} of {t}" and a "Pass" (success) / "Not yet" (neutral) chip, tap →
  `PracticeResults`. `loading` shows a spinner in the list area only; `error` or empty shows
  "Your tests will show here." `PracticeResultsScreen` reads the attempt, renders
  `PracticeResults` (`onTakeAnother` → `startPracticeTest(..., 'replace')`, `onBack` →
  `goBack`), and shows `NoConnection` with retry on a failed read.

- [ ] **Step 1: Failing tests**:
  - Home: no saved session → no resume card; saved session with 12 of 25 answered → "12 of 25
    answered"; Resume navigates with `{ resume: true }`; Discard + confirm clears it; two
    attempts render in order with "Pass" / "Not yet"; a row tap navigates to `PracticeResults`
    with its `testId`; attempts `error` → "Your tests will show here." and no error text
    (Review Focus 5).
  - Results screen: a ready practice attempt renders its score line; an `error` attempt shows
    the retry state; a non-practice attempt shows "Something went wrong".
- [ ] **Step 2: Run, expect failure**: `npm run test:components -- Practice` → FAIL.
- [ ] **Step 3: Implement** both screens and the navigator changes.
- [ ] **Step 4: Run all suites**: `npm run test:app`, `npm run test:components`,
  `npx tsc --noEmit` → PASS / clean.
- [ ] **Step 5: Commit**: `feat(ph-4-us-1): Practice tab with resume card and recent tests`

---

### Task 9: Deploy, device test, docs and status

**Files:**
- Modify: `docs/build-order.md`, story files ph-3-us-1, 2, 3, 4 and ph-4-us-1, 6, phase
  summaries for Phases 3 and 4, `docs/history/LOG.md`

- [ ] **Step 1: Bank mix report**: with a throwaway, uncommitted `_`-prefixed script beside
  `scripts/question-bank/_check-review.ts` (same admin connection), count approved questions by
  `type`, and topics with at least one scenario question. Record the numbers for the hand-off.
  This does not gate the deploy (decision 4).
- [ ] **Step 2: Run every suite**: `npm run test:rules`, `test:functions`, `test:question-bank`,
  `test:app`, `test:components`, `npx tsc --noEmit` → all pass. Record counts.
- [ ] **Step 3: Deploy to dev**: `firebase deploy --only firestore:indexes,functions:assembleTest
  --project dev`. Wait until the index shows Enabled (`firebase firestore:indexes --project
  dev`). Smoke check: `curl.exe -s -X POST -H "Content-Type: application/json" -d
  '{\"data\":{}}' https://us-central1-dmv-app-dev.cloudfunctions.net/assembleTest` → 401 with
  "requires a signed-in caller" (403 HTML means the invoker grant was lost).
- [ ] **Step 4: Device test** on the Android emulator (`npx expo start --dev-client --clear`)
  with the spec's device-test script, including the baseline-plus-practice step. Stop and
  report anything that fails to the user before fixing.
- [ ] **Step 5: Docs**: mark ph-3-us-3, ph-3-us-2 Complete; ph-4-us-1 In Progress (timed-out
  and baseline-comparison criteria are Slice 5b); ph-4-us-6 Complete; ph-3-us-1 and ph-3-us-4
  practice parts done (timed parts wait for 5b) with decision 1 recorded; decision 7 in ph-4-us-6.
  Update `build-order.md` Slice 5a status (plan, spec, counts, carry-forwards) and correct its
  stale open items (question review finished; Node 22 done). Append a log line.
- [ ] **Step 6: Commit**: `docs: Slice 5a (practice tests) complete`
