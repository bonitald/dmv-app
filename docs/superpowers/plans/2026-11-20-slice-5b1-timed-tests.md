# Slice 5b-1 — Timed Tests and Fresh Questions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Practice tests can be timed (60-minute countdown that keeps running while the app is
closed and submits by itself at zero), back-to-back tests don't repeat questions, and every
practice attempt records its `timing`.

**Architecture:** Two backend changes: `assembleTest` reads the caller's last 3 practice
attempts and `selectPracticeQuestions` prefers unseen questions; `scoreTest` validates and saves
an optional `timing` on practice attempts and returns it. On the app: a pure `timing.ts` module
does all clock maths from a saved `startedAt`; the saved practice session carries
`{ mode, timeLimitSec, startedAt }`; a self-ticking `TestTimer` component sits in a new
`QuizRunner` header slot and fires `onExpire` once; `PracticeTestScreen` locks the runner and
auto-submits; the Practice tab gets the mode switch and an expired-test path; results show the
time-ran-out line.

**Tech Stack:** Firebase Cloud Functions v2 + Admin SDK on Node 22 (Jest against the Firestore
emulator, `npm run test:functions`), Expo SDK 57, React Navigation 7, AsyncStorage, Jest
(`test:app` = Node ts-jest for `*.test.ts`, `test:components` = jest-expo for `*.test.tsx`).

**Spec:** `docs/superpowers/specs/2026-11-20-slice-5b1-timed-tests-design.md` (decisions 1–11),
and its stories: `docs/phases/phase-3-practice-test-generator-and-test-taking-ui/` ph-3-us-5,
6, 7, 8, 9 and `docs/phases/phase-4-scoring-and-review/ph-4-us-1`. Backend contract:
`functions/README.md`.

## Decisions made while planning (flag to the user at review)

- **The timer lives in its own component, `TestTimer`,** rendered through a new
  `headerAccessory` slot on `QuizRunner`. It owns the 1-second tick (so the question doesn't
  re-render), checks on mount and on return to foreground, and calls `onExpire` once. Expiry on
  resume uses the same path: a resumed expired test mounts the timer, which expires at once.
- **Remaining time rounds up, elapsed time rounds down.** The pill shows "0:01" until the clock
  really reaches zero, and a submit at 59:59.6 sends `elapsedSec: 3599` (not timed out).
- **The 5- and 1-minute notices** are an inline line under the pill for 10 seconds after the
  threshold is crossed (also announced to screen readers). A test resumed below a threshold
  shows the lowest crossed one once.
- **`startPracticeTest` reads the saved mode preference itself**, so "Start a practice test"
  and "Take another test" both use it without a new argument.
- **Dev-only short limit:** `timedLimitSec()` returns `EXPO_PUBLIC_TIMED_LIMIT_SEC` when
  `__DEV__` is true and the variable is a positive number, else 3600. Release builds always get
  3600.
- **"Finished in N min" is not shown** (spec left it optional; YAGNI).
- **Locked runner:** answer taps do nothing, the Submit/Next button is replaced by nothing
  (Back and the question strip still work, so the teen can look), the existing "Try again" line
  still shows if a submit fails.

## Global Constraints

- Colors, spacing, radius and type only from `src/theme/tokens.ts`; last-minute pill uses the
  `colors.alert` token. Tap
  targets ≥ 48pt. Reuse `Button`, `Card`, `QuizRunner`.
- `TIMED_TEST_LIMIT_SEC = 3600` (app). `RECENT_TESTS_TO_AVOID = 3` (functions).
  `MAX_ELAPSED_SEC = 86400` (functions). Existing `MIN_SCENARIO_COUNT = 8`, `MAX_PER_TOPIC = 2`,
  `DEFAULT_QUESTION_COUNT = 25` unchanged.
- Timing types (shared names, both sides):
  - `TestMode = 'timed' | 'untimed'`
  - client → server: `{ mode: TestMode; timeLimitSec?: number; elapsedSec: number }`
  - saved/returned: `AttemptTiming = { mode: TestMode; timeLimitSec?: number; elapsedSec: number | null }`, or `null`
  - session: `SessionTiming = { mode: TestMode; timeLimitSec?: number; startedAt: number }` (epoch ms)
- Mode preference key: `dmv-app:practice-mode:{uid}`, values `'timed' | 'untimed'`, missing or
  anything else → `'untimed'`.
- Baseline and mini-quiz never show a timer, never send `timing`; `scoreTest` ignores it for them.
- `timing` never affects grading and never fails a submission.
- No "fail" wording; no alarms or red full-screen states.
- Cloud Function doc comments follow the `cloud-function-documentation` skill.
- Copy (exact):
  - Switch: "Untimed" / "Timed — 60 min, like the real test"
  - Pill: `formatClock(remaining)`, accessibility label "{m} minutes left" (or "{s} seconds
    left" under a minute)
  - Notices: "5 minutes left" / "1 minute left"
  - Time-up line (runner notice): "Time's up. Submitting your answers…"; offline: "Time's up.
    Your answers are saved and will be sent when you're back online."
  - Leave alert, timed: "Leave the test?" / "Your answers are saved. The timer keeps going
    while you're away. You can resume it from the Practice tab." / "Stay", "Leave" (untimed
    keeps today's text)
  - Resume card, timed: "{n} min left" (minutes rounded up); expired: "Time's up — open it to
    submit", single button "Open to submit"
  - Results: "Time ran out — {n} questions unanswered." / "Time ran out — 1 question
    unanswered." / "Time ran out — you answered every question."

## Review Focus

1. **Time hits zero while a manual submit is in flight or held offline** → exactly one
   `scoreTest` call succeeds; no second attempt, no crash. (Task 7, test "auto-submit during
   an in-flight submit calls scoreTest once".)
2. **Device clock moved backwards mid-test** (now < startedAt) → remaining shows the full limit,
   elapsed is 0, nothing negative is sent. (Task 3, `remainingSeconds`/`elapsedSeconds` cases.)
3. **A 5a-era saved session without `timing`** → resumes untimed, no pill, submits without
   `timing`, Practice tab card unchanged. (Tasks 4 and 7.)
4. **Expired test + "Take another test" from a results screen** → opens the expired test,
   not a fresh one, and never shows the discard prompt. (Task 8, `startPracticeTest` test.)
5. **Attempt docs with odd `perQuestion`** (missing, not an array, entries without
   `questionId`) in the recent-attempts read → ignored; test still assembled. (Task 1.)

---

### Task 1: `assembleTest` avoids recently seen questions (ph-3-us-6)

**Files:**
- Modify: `functions/src/assembleTest.ts`
- Modify: `functions/README.md` (`assembleTest` section)
- Test: `functions/src/assembleTest.test.ts`

**Interfaces:**
- Produces: `selectPracticeQuestions(pool, count, random, opts: { minScenario: number; maxPerTopic: number; isSeen?: (item: T) => boolean }, describe)`; `export const RECENT_TESTS_TO_AVOID = 3`; `export async function recentlySeenQuestionIds(db: Firestore, uid: string): Promise<Set<string>>`.

- [ ] **Step 1: Write the failing tests** in `assembleTest.test.ts`:
  - `selectPracticeQuestions`:
    - `test('no isSeen gives the same picks as before')` — same seed, `opts` with and without
      `isSeen: () => false`: `expect(withSeen.map(x => x.id)).toEqual(without.map(x => x.id))`.
    - `test('avoids seen questions when enough unseen remain')` — `buildPool(45, 2, 4)`, seen =
      first test's IDs; second test: `expect(second.filter(x => seen.has(x.id))).toHaveLength(0)`,
      still 25, scenario ≥ 8, `maxTopic ≤ 2`.
    - `test('tops up from seen questions when the pool is small')` — `buildPool(10, 1, 3)`
      (40 items), seen = 25 IDs: result length 25, contains all 15 unseen.
    - `test('pool of exactly 25 repeats the whole test')` — every item seen → result has 25.
    - `test('scenario minimum is met from seen scenario questions')` — pool where all scenario
      questions are seen: `scenarioCount(result) >= MIN_SCENARIO_COUNT`.
    - `test('an unseen question over the cap beats a seen one under it')` — pool: topic `a` with
      5 unseen facts, 20 other topics each with 1 seen fact, `minScenario: 0`, `count: 5`,
      `maxPerTopic: 2`: all 5 picks are from `a`.
  - `assembleTestForUser` (seed attempts with `db.collection('users').doc(uid).collection('testAttempts').doc(id).set({ type, createdAt: Timestamp.fromMillis(n), perQuestion: [{ questionId }] })`):
    - `test('excludes questions from the last 3 practice attempts')` — 30 approved questions,
      3 practice attempts covering q1–q5, `count: 25`: no q1–q5 in the result.
    - `test('only the 3 most recent practice attempts count')` — 4 attempts; the oldest one's
      IDs may appear (assert `recentlySeenQuestionIds` returns only the newest three's IDs).
    - `test('mini-quiz and baseline attempts do not count')`.
    - `test('attempts with missing or malformed perQuestion are ignored')` — `perQuestion`
      absent, `'x'`, `[{}]`, `[{ questionId: 7 }]`: resolves, returns 25.
    - `test('a user with no attempts behaves as before')`.
    - `test('does not touch freeTestUsedAt')` — seed `users/{uid}` with `freeTestUsedAt: null`,
      assemble, still `null`.

- [ ] **Step 2: Run and see them fail**
  Run: `npm run test:functions -- -t "selectPracticeQuestions|assembleTestForUser"`
  Expected: FAIL (`isSeen` ignored, `recentlySeenQuestionIds` not exported).

- [ ] **Step 3: Implement**
  - `selectPracticeQuestions`: with `isSeen` defaulting to `() => false`, run the eight passes
    from the spec (scenario tier: unseen+cap, unseen no cap, seen+cap, seen no cap, each until
    `scenarioTarget`; then the same four over any question until `count`). Implement by giving
    `pass` an extra `accept` that combines the type filter and `!isSeen(item)` for the unseen
    passes. Keep one shuffle and the final shuffle, so the no-history result is unchanged (the
    seen passes then take nothing new).
  - `recentlySeenQuestionIds`: `users/{uid}/testAttempts` `where('type','==','practice')`
    `.orderBy('createdAt','desc').limit(RECENT_TESTS_TO_AVOID)`; collect string
    `perQuestion[].questionId`, skipping anything malformed.
  - `assembleTestForUser`: run it alongside the approved-questions read (`Promise.all`), pass
    `isSeen: (d) => seen.has(d.id)`.
  - Doc comments: update the selection order, add the attempts read to `Reads:`.
  - `functions/README.md`: repeat-avoidance paragraph under `assembleTest` (last 3 graded
    practice tests, preference not guarantee, priority scenario minimum > avoidance > cap).

- [ ] **Step 4: Run the tests**
  Run: `npm run test:functions`
  Expected: all pass (96 existing + new).

- [ ] **Step 5: Commit**
  `git commit -m "feat(ph-3-us-6): assembleTest avoids questions from the last 3 practice tests"`

---

### Task 2: `scoreTest` saves `timing` on practice attempts (ph-3-us-8)

**Files:**
- Modify: `functions/src/scoreTest.ts`
- Modify: `functions/README.md` (`scoreTest` input, persistence, result)
- Test: `functions/src/scoreTest.test.ts`

**Interfaces:**
- Produces: `export function parseTiming(raw: unknown): AttemptTiming | null`; `AttemptTiming` exported type; `ScoreTestResult.timing?: AttemptTiming | null` (present on practice results only); `ScoreTestInput.timing: unknown`.

- [ ] **Step 1: Write the failing tests**
  - `describe('parseTiming')`:
    - `{ mode: 'timed', timeLimitSec: 3600, elapsedSec: 1234 }` → same object.
    - `{ mode: 'untimed', elapsedSec: 90, timeLimitSec: 3600 }` → `{ mode: 'untimed', elapsedSec: 90 }`.
    - `elapsedSec: 0` → kept as `0`.
    - `elapsedSec: 12.7` → `12` (floored).
    - `undefined`, `null`, `'timed'`, `{ mode: 'fast', elapsedSec: 1 }` → `null`.
    - `{ mode: 'untimed', elapsedSec: 90000 }` → `{ mode: 'untimed', elapsedSec: null }`.
    - `{ mode: 'untimed', elapsedSec: -1 }` and `elapsedSec: 'x'`, `NaN`, `Infinity` → `elapsedSec: null`, mode kept.
    - `{ mode: 'timed', elapsedSec: 10 }` (no limit), `timeLimitSec: 0`, `timeLimitSec: 90000` → `null` (a timed record without a valid limit is meaningless).
  - `scoreTestForUser`:
    - `test('saves timing on a practice attempt and returns it')` — attempt doc `timing`
      equals `{ mode: 'timed', timeLimitSec: 3600, elapsedSec: 3600 }`; result `.timing` same.
    - `test('missing timing saves null')` — attempt `timing === null`, result `timing === null`.
    - `test('malformed timing saves null and still grades')` — `timing: { mode: 'x' }`:
      resolves with the usual score.
    - `test('mini-quiz ignores timing')` — attempt has no `timing` field
      (`expect(data).not.toHaveProperty('timing')`), result has no `timing`.
    - `test('baseline section ignores timing')` — same for a baseline section submit.
    - `test('unanswered questions still count as wrong with timing')` — timed, 2 of 3 answered:
      `totalCount` 3.

- [ ] **Step 2: Run and see them fail**
  Run: `npm run test:functions -- -t "parseTiming|timing"`
  Expected: FAIL.

- [ ] **Step 3: Implement**
  - `parseTiming` per the spec and the tests: `MAX_ELAPSED_SEC = 86400`; never throws.
  - `validateInput` returns `timing: parseTiming(input.timing)` as well; `scoreTestForUser`
    passes it to `scoreAssignedTest` only (baseline call unchanged).
  - `scoreAssignedTest`: when `type === 'practice'`, add `timing` to the attempt doc and to the
    returned result; other types: neither.
  - Doc comments (`Inputs:`, `Writes:`, `Returns:`) and README updated.

- [ ] **Step 4: Run the tests**
  Run: `npm run test:functions`
  Expected: all pass.

- [ ] **Step 5: Commit**
  `git commit -m "feat(ph-3-us-8): scoreTest saves client-reported timing on practice attempts"`

---

### Task 3: Timing helpers and API types (app)

**Files:**
- Create: `src/practice/timing.ts`, `src/practice/timing.test.ts`
- Modify: `src/api/types.ts`, `src/api/callables.ts`

**Interfaces:**
- Produces (`src/api/types.ts`): `TestMode`, `TimingSubmission = { mode: TestMode; timeLimitSec?: number; elapsedSec: number }`, `AttemptTiming = { mode: TestMode; timeLimitSec?: number; elapsedSec: number | null }`, `ScoreTestResult.timing?: AttemptTiming | null`.
- Produces (`callables.ts`): `scoreTest(input: { testId: string; answers: AnswerSubmission[]; timing?: TimingSubmission })`.
- Produces (`timing.ts`):
  - `export const TIMED_TEST_LIMIT_SEC = 3600`
  - `export function timedLimitSec(): number`
  - `export interface SessionTiming { mode: TestMode; timeLimitSec?: number; startedAt: number }`
  - `export function remainingSeconds(startedAt: number, limitSec: number, now: number): number` — `ceil`, clamped to `[0, limitSec]`
  - `export function elapsedSeconds(startedAt: number, now: number): number` — `floor`, ≥ 0
  - `export function isExpired(timing: SessionTiming | undefined, now: number): boolean` — timed and `remainingSeconds === 0`
  - `export function timingPayload(timing: SessionTiming | undefined, now: number, timedOut: boolean): TimingSubmission | undefined`
  - `export function isTimedOut(timing: AttemptTiming | null | undefined): boolean`
  - `export function formatClock(sec: number): string`
  - `export type TimeWarning = '5min' | '1min'`; `export function warningFor(sec: number): TimeWarning | null`

- [ ] **Step 1: Write the failing tests** (`timing.test.ts`), `start = 1_000_000`:
  - `remainingSeconds(start, 3600, start)` → 3600; `start + 1000` → 3599; `start + 3599_400` → 1;
    `start + 3600_000` → 0; `start + 9_999_999` → 0; `start - 60_000` (clock moved back) → 3600.
  - `elapsedSeconds(start, start + 3599_600)` → 3599; `start - 5000` → 0.
  - `isExpired(undefined, x)` → false; untimed → false; timed at `+3600_000` → true, at `+3599_000` → false.
  - `timingPayload(undefined, …)` → `undefined`; untimed at `+90_500` → `{ mode: 'untimed', elapsedSec: 90 }`;
    timed at `+1_234_000`, `false` → `{ mode: 'timed', timeLimitSec: 3600, elapsedSec: 1234 }`;
    timed, `true` → `elapsedSec: 3600`; timed at `+5_000_000`, `false` → `elapsedSec: 3600` (clamped).
  - `isTimedOut`: `null` → false; untimed → false; `{ timed, 3600, 3600 }` → true; `3599` → false; `elapsedSec: null` → false.
  - `formatClock`: 3600 → `"60:00"`, 3599 → `"59:59"`, 42 → `"0:42"`, 0 → `"0:00"`.
  - `warningFor`: 301 → null, 300 → `'5min'`, 61 → `'5min'`, 60 → `'1min'`, 0 → `'1min'`.
  - `timedLimitSec()` under Jest (no `__DEV__` override env) → 3600.

- [ ] **Step 2: Run and see them fail**
  Run: `npm run test:app -- timing`
  Expected: FAIL (module missing).

- [ ] **Step 3: Implement** `timing.ts` and the type/callable changes. `timedLimitSec`:
  `typeof __DEV__ !== 'undefined' && __DEV__` and `Number(process.env.EXPO_PUBLIC_TIMED_LIMIT_SEC) > 0`
  → that number, else `TIMED_TEST_LIMIT_SEC`. No React or Firebase imports.

- [ ] **Step 4: Run the tests**
  Run: `npm run test:app -- timing` then `npx tsc --noEmit`
  Expected: PASS; tsc clean.

- [ ] **Step 5: Commit**
  `git commit -m "feat(ph-3-us-9): timing helpers and scoreTest timing types"`

---

### Task 4: Session timing and the mode preference

**Files:**
- Modify: `src/quiz/quizSession.ts`, `src/quiz/quizSession.test.ts`
- Modify: `src/profile/localFlags.ts`, `src/profile/localFlags.test.ts`

**Interfaces:**
- Consumes: `SessionTiming`, `TestMode` (Task 3).
- Produces: `ActiveSession.timing?: SessionTiming`; `startSession(uid, testId, kind, questions, timing?: SessionTiming): Promise<void>`; `getPracticeMode(uid: string): Promise<TestMode>`; `setPracticeMode(uid: string, mode: TestMode): Promise<void>`.

- [ ] **Step 1: Write the failing tests**
  - `quizSession.test.ts`:
    - `test('timing round-trips through start, saveAnswers and getActiveSession')` —
      `startSession(..., { mode: 'timed', timeLimitSec: 3600, startedAt: 123 })`, `saveAnswers`,
      `getActiveSession` → `.timing` equals the input.
    - `test('a session saved without timing reads with timing undefined')` — write the 5a
      shape directly to `dmv-app:active-test:u1:practice`: `timing` is `undefined`, answers intact.
    - `test('baseline sessions have no timing')`.
  - `localFlags.test.ts`:
    - `getPracticeMode` with nothing stored → `'untimed'`; after `setPracticeMode(uid, 'timed')`
      → `'timed'`; stored `'banana'` → `'untimed'`; key is `dmv-app:practice-mode:u1`;
      AsyncStorage throwing → `'untimed'` (and `setPracticeMode` doesn't throw).

- [ ] **Step 2: Run and see them fail**
  Run: `npm run test:app -- quizSession localFlags`
  Expected: FAIL.

- [ ] **Step 3: Implement.** `StoredSession` gains optional `timing`; `startSession` writes it
  only when given; `saveAnswers` already spreads `stored`, so it keeps it — confirm. Preference
  helpers follow the existing `localFlags` try/catch style.

- [ ] **Step 4: Run the tests**
  Run: `npm run test:app`
  Expected: all pass.

- [ ] **Step 5: Commit**
  `git commit -m "feat(ph-3-us-9): save test timing on the practice session; remember the mode"`

---

### Task 5: `QuizRunner` header slot and locked state

**Files:**
- Modify: `src/quiz/QuizRunner.tsx`
- Test: `src/quiz/QuizRunner.test.tsx`

**Interfaces:**
- Produces: `QuizRunnerProps.headerAccessory?: React.ReactNode` (rendered on the title row, right side); `QuizRunnerProps.locked?: boolean`.

- [ ] **Step 1: Write the failing tests**
  - `test('renders the header accessory')` — `headerAccessory={<Text>12:00</Text>}` → visible.
  - `test('locked: choices do not change the answer')` — tap a choice: `onAnswersChange` not called.
  - `test('locked: no Submit or Next button, Back still works')`.
  - `test('locked: Try again still shows on a submit error')` — `submitState="error"` → "Try again" present.
  - `test('unlocked behaviour unchanged')` — existing tests still pass untouched.

- [ ] **Step 2: Run and see them fail**
  Run: `npm run test:components -- QuizRunner`
  Expected: new tests FAIL.

- [ ] **Step 3: Implement.** `select` returns early when `locked`; when `locked`, render no
  Submit/Next button (keep Back and the strip). Don't pass `onSelect={undefined}` to `QuizCard`
  (that may switch it into its review look).

- [ ] **Step 4: Run the tests**
  Run: `npm run test:components -- QuizRunner`
  Expected: PASS.

- [ ] **Step 5: Commit**
  `git commit -m "feat(ph-3-us-9): QuizRunner header slot and locked state"`

---

### Task 6: `TestTimer` component

**Files:**
- Create: `src/practice/TestTimer.tsx`, `src/practice/TestTimer.test.tsx`

**Interfaces:**
- Consumes: `remainingSeconds`, `formatClock`, `warningFor`, `TimeWarning` (Task 3).
- Produces: `export function TestTimer(props: { startedAt: number; limitSec: number; onExpire: () => void; now?: () => number }): React.ReactElement` — `now` defaults to `Date.now` (injectable for tests).

- [ ] **Step 1: Write the failing tests** (jest fake timers, `now` driven by a variable):
  - `test('shows the time left and ticks every second')` — start at 0 elapsed → "60:00"; advance
    1 s → "59:59".
  - `test('recomputes from startedAt, not by counting ticks')` — jump `now` by 10 minutes
    without advancing timers, advance 1 s → "49:59".
  - `test('calls onExpire once at zero')` — advance past the limit and then 5 s more:
    `onExpire` called exactly once.
  - `test('expires on mount when already past the limit')` — `startedAt` 2 hours ago:
    `onExpire` called once, pill "0:00".
  - `test('rechecks when the app returns to the foreground')` — mock `AppState.addEventListener`,
    move `now` past the limit, fire `'active'`: `onExpire` called.
  - `test('shows "5 minutes left" after crossing 5 minutes, then hides it')` — visible at 300 s
    left, gone 10 s later.
  - `test('resumed under a minute shows "1 minute left" once')`.
  - `test('uses the alert color in the last minute')` — pill style color equals the token.
  - `test('cleans up the interval and listener on unmount')`.

- [ ] **Step 2: Run and see them fail**
  Run: `npm run test:components -- TestTimer`
  Expected: FAIL (module missing).

- [ ] **Step 3: Implement.** `setInterval(1000)` updating `remaining` state; `useRef` flag so
  `onExpire` fires once; `AppState` `'change'` → recompute on `'active'`; notices via
  `AccessibilityInfo.announceForAccessibility` plus the inline line (planning decision above);
  pill accessibility label per Global Constraints.

- [ ] **Step 4: Run the tests**
  Run: `npm run test:components -- TestTimer`
  Expected: PASS.

- [ ] **Step 5: Commit**
  `git commit -m "feat(ph-3-us-9): TestTimer countdown pill with warnings and one-shot expiry"`

---

### Task 7: Timed practice test screen

**Files:**
- Modify: `src/practice/PracticeTestScreen.tsx`, `src/navigation/types.ts`
- Test: `src/practice/practiceTestFlow.test.tsx`

**Interfaces:**
- Consumes: `startSession(..., timing)`, `ActiveSession.timing` (Task 4); `timedLimitSec`, `timingPayload`, `elapsedSeconds`, `SessionTiming` (Task 3); `QuizRunner` `headerAccessory`/`locked` (Task 5); `TestTimer` (Task 6); `scoreTest({ …, timing })` (Task 3).
- Produces: route params `PracticeTest: { resume?: boolean; timed?: boolean } | undefined`.

- [ ] **Step 1: Write the failing tests** (extend `practiceTestFlow.test.tsx`; mock `Date.now`
  / use fake timers):
  - `test('untimed: no timer, submit sends untimed timing')` — `scoreTest` called with
    `timing: { mode: 'untimed', elapsedSec: <n> }`.
  - `test('timed: saves timing on the session and shows the timer')` — `renderFlow({ timed: true })`:
    `getActiveSession(...).timing` is `{ mode: 'timed', timeLimitSec: 3600, startedAt: <now> }`; "60:00" visible.
  - `test('timed: time up locks answers and submits once with timedOut timing')` — answer 1 of 2,
    advance past the limit: `scoreTest` called once with the saved answers and
    `timing.elapsedSec === 3600`; results show.
  - `test('auto-submit during an in-flight submit calls scoreTest once')` — `scoreTest` returns
    a pending promise on manual submit, then time runs out, then it resolves: one call.
  - `test('time up while offline holds the answers and sends once on reconnect')` — offline,
    expire: the offline time-up line shows, no call; `setOnline(true)` → one call with
    `elapsedSec: 3600`.
  - `test('elapsed time is measured at the first submit attempt')` — offline manual submit at
    10 min, reconnect at 20 min: `elapsedSec === 600`.
  - `test('resuming an expired timed test submits straight away')` — seed a session with
    `startedAt` 2 hours ago, `renderFlow({ resume: true })`: `scoreTest` called once, no
    answering possible.
  - `test('resuming a 5a session without timing runs untimed and sends no timing')` —
    `scoreTest` input has no `timing` key.
  - `test('leaving a timed test mentions the timer')` — Alert message contains "The timer keeps
    going while you're away".

- [ ] **Step 2: Run and see them fail**
  Run: `npm run test:components -- practiceTestFlow`
  Expected: new tests FAIL.

- [ ] **Step 3: Implement**
  - Fresh start: `timing = { mode, timeLimitSec: timed ? timedLimitSec() : undefined, startedAt: Date.now() }`,
    passed to `startSession`; kept on the `running` phase (`timing?: SessionTiming`) so a failed
    cache write still times the test. Resume: `active.timing`.
  - Refs: `answersRef` (latest answers from `onAnswersChange` and `initialAnswers`),
    `pendingTimingRef` (set on the first submit attempt via `timingPayload(timing, Date.now(), timedOut)`,
    reused on retries and on the reconnect resend, cleared when the session ends).
  - `submit(answers, timedOut = false)` sends `timing: pendingTimingRef.current` (omit when undefined).
  - `timeUp` state: `TestTimer`'s `onExpire` → `setTimeUp(true)` and `submit(answersRef.current, true)`.
    Existing guards (`submittingRef`, phase check, held answers) keep it to one call. While
    `timeUp`: `locked` on the runner, `notice` = the time-up line (offline variant when
    `!isOnline`).
  - `headerAccessory` = `<TestTimer startedAt limitSec onExpire />` only when `timing?.mode === 'timed'`.
  - `usePreventRemove` alert text per Global Constraints for timed tests; don't prevent leaving
    once `timeUp`.

- [ ] **Step 4: Run the tests**
  Run: `npm run test:components` then `npx tsc --noEmit`
  Expected: all pass; tsc clean.

- [ ] **Step 5: Commit**
  `git commit -m "feat(ph-3-us-9): timed practice tests with countdown, auto-submit and timing"`

---

### Task 8: Practice tab mode switch and expired tests

**Files:**
- Modify: `src/practice/PracticeHomeScreen.tsx`, `src/practice/startPracticeTest.ts`
- Test: `src/practice/PracticeHomeScreen.test.tsx`, `src/practice/practiceTestFlow.test.tsx` (the `startPracticeTest` cases)

**Interfaces:**
- Consumes: `getPracticeMode`, `setPracticeMode` (Task 4); `isExpired`, `remainingSeconds` (Task 3); `PracticeTest` params (Task 7).
- Produces: `startPracticeTest(navigation, uid, mode: 'navigate' | 'replace')` (signature unchanged).

- [ ] **Step 1: Write the failing tests**
  - Home:
    - `test('switch defaults to Untimed and saves the choice')` — tap "Timed — 60 min, like the
      real test": `setPracticeMode` called / stored `'timed'`; re-render shows it selected.
    - `test('switch loads the saved choice')`.
    - `test('timed resume card shows minutes left')` — session `startedAt` 20 min ago → "40 min left".
    - `test('expired resume card has Open to submit and no Discard')` — tap → navigates to
      `PracticeTest` with `{ resume: true }`.
    - `test('untimed and 5a sessions keep Resume and Discard')`.
  - `startPracticeTest`:
    - `test('passes timed from the saved preference')` → navigates with `{ timed: true }`.
    - `test('expired saved test opens it instead of prompting')` — no `Alert.alert`, navigates
      with `{ resume: true }`; with `'replace'` it replaces.
    - `test('unexpired saved test still asks before discarding')`.

- [ ] **Step 2: Run and see them fail**
  Run: `npm run test:components -- PracticeHomeScreen practiceTestFlow`
  Expected: new tests FAIL.

- [ ] **Step 3: Implement.** Switch: two `Button`s (selected = `primary`, other = `secondary`)
  or an equivalent segmented pair from existing components, with `accessibilityState.selected`.
  Card text from `remainingSeconds` at focus time (no live ticking needed on the card).
  `startPracticeTest`: if `saved && isExpired(saved.timing, Date.now())` → go with
  `{ resume: true }`; otherwise current behaviour, passing `{ timed: (await getPracticeMode(uid)) === 'timed' }`.

- [ ] **Step 4: Run the tests**
  Run: `npm run test:components`
  Expected: all pass.

- [ ] **Step 5: Commit**
  `git commit -m "feat(ph-3-us-9): Practice tab timed switch; expired tests are always graded"`

---

### Task 9: Time-ran-out line on results (ph-4-us-1)

**Files:**
- Modify: `src/practice/practiceData.ts`, `src/practice/PracticeResults.tsx`
- Test: `src/practice/practiceData.test.ts`, `src/practice/PracticeResults.test.tsx`

**Interfaces:**
- Consumes: `AttemptTiming`, `isTimedOut` (Task 3).
- Produces: `PracticeOutcome.timing: AttemptTiming | null`; `PracticeOutcome.unansweredCount: number`; `export function timedOutLine(o: PracticeOutcome): string | null`.

- [ ] **Step 1: Write the failing tests**
  - `fromPracticeScore` copies `result.timing ?? null`; `fromPracticeAttempt` reads `data.timing`
    when it's an object with a valid `mode`, else `null`.
  - `unansweredCount` counts `perQuestion` with `choice === null` and not `unavailable`.
  - `timedOutLine`: not timed out → `null`; timed out with 3 unanswered → "Time ran out — 3
    questions unanswered."; 1 → "Time ran out — 1 question unanswered."; 0 → "Time ran out —
    you answered every question."
  - `PracticeResults`: the line renders near the score when present, absent otherwise.

- [ ] **Step 2: Run and see them fail**
  Run: `npm run test:app -- practiceData` and `npm run test:components -- PracticeResults`
  Expected: FAIL.

- [ ] **Step 3: Implement** in `practiceData.ts` (pure) and render it in `PracticeResults.tsx`
  under the score, styled like `leftOutLine`.

- [ ] **Step 4: Run the tests**
  Run: `npm run test:app && npm run test:components && npx tsc --noEmit`
  Expected: all pass; tsc clean.

- [ ] **Step 5: Commit**
  `git commit -m "feat(ph-4-us-1): practice results say when time ran out"`

---

### Task 10: Deploy, device test and docs

**Files:**
- Modify: story files ph-3-us-1, 4, 5, 6, 7, 8, 9 and ph-4-us-1; `phase-3-summary.md`,
  `phase-4-summary.md`; `docs/build-order.md`; `docs/history/LOG.md`

- [ ] **Step 1: Full check.** Run `npm run test:functions`, `npm run test:rules`,
  `npm run test:app`, `npm run test:components`, `npx tsc --noEmit`, `npm --prefix functions run build`.
  Expected: all pass. Record the counts.

- [ ] **Step 2: Deploy to dev.** `firebase deploy --only functions:assembleTest,functions:scoreTest --project dmv-app-dev`.
  Smoke check: an unauthenticated POST to the `scoreTest` URL returns 401.

- [ ] **Step 3: Device test** on the Android emulator, following the spec's 9 steps. Use
  `EXPO_PUBLIC_TIMED_LIMIT_SEC=120` in the dev client for steps 4–6 and 9, then without it
  confirm the pill shows "60:00". Hand to the user for anything needing their eyes.

- [ ] **Step 4: Docs.** Statuses and decisions per the spec's "Story and doc updates"
  (decisions 1–3 → ph-3-us-6; 6, 10 → ph-3-us-8; 4, 7, 8, 9, 11 → ph-3-us-9). `build-order.md`:
  split 5b into 5b-1 (this, with status, counts and decisions) and 5b-2 (ph-4-us-5, ph-4-us-7,
  Home card, plus the card-performance fixes from the 5b review: practice/baseline results must
  not overwrite `lastQuizMissedIds` or clear deck passes, and recording must be once per test).
  Append a LOG.md entry.

- [ ] **Step 5: Commit**
  `git commit -m "docs: Slice 5b-1 (timed tests, fresh questions) complete"`
