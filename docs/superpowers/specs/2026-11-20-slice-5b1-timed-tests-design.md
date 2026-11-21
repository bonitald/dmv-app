# Slice 5b-1 — Timed Tests and Fresh Questions — Design

> Companion to `docs/build-order.md` (Slice 5b, first half). The stories are the detailed spec:
> ph-3-us-6 (repeat-avoidance), ph-3-us-8 (`timing` on attempts), ph-3-us-9 (timed mode UI), and
> ph-4-us-1's timed-out criterion. Parents closed: ph-3-us-5, ph-3-us-7. This doc records how
> they fit together and the decisions made on 2026-11-20.
>
> **Split (2026-11-20):** Slice 5b is built as two halves. 5b-2 (later) is ph-4-us-5 (missed
> questions; practice and baseline results feeding card performance), ph-4-us-7 (latest score
> vs baseline) and the Home practice card. Nothing here depends on 5b-2.

## Goal

A teen can switch a practice test to **timed**: a 60-minute countdown, like the real Colorado
written test, that keeps running when the app is in the background or killed, and submits the
test by itself at zero. Back-to-back practice tests **don't repeat questions**. Every practice
attempt records whether it was timed and how long it took, so later reporting (Phase 4/5, the
PRD's pass-rate metric) can tell timed practice from relaxed practice.

**Why now:** 5a made practice tests real; "unlimited, distinct" tests and exam-like timing are
the rest of the PRD's "Practice test generator" (Must) and Phase 3's fourth bullet.

**Device test:**
1. Practice tab → switch shows "Untimed" → start → no countdown → submit → results. Firestore:
   the attempt has `timing: { mode: 'untimed', elapsedSec }`.
2. Switch to "Timed — 60 min" → start → the countdown pill shows → leave the test (the message
   mentions the clock) → the Practice tab's resume card shows time left → resume → time left
   reflects the real elapsed time.
3. Force-quit during a timed test → reopen → resume → correct time left.
4. Timed test left to run out (for device testing, a dev-only override of the limit is
   allowed, see "Left to the builder") → answers lock → auto-submit → results say "Time ran
   out — N questions unanswered". The attempt has `timing.mode: 'timed'`.
5. Timed test, force-quit, wait past the limit, reopen → resume → it submits at once and shows
   the timed-out results.
6. Time runs out while offline → answers locked, "waiting for connection" → reconnect → it
   submits once.
7. Three practice tests in a row share no questions (check the three attempts' `perQuestion`
   IDs in Firestore).
8. Relaunch: the switch remembers the last choice.
9. Let a timed test expire while away → the resume card has no Discard → tap "Start a practice
   test" → the expired test opens and submits → its results show → "Take another test" starts
   a fresh one.

## Goals, non-goals, anti-goals

- **Goals:** a timed mode that can't lose or pause its clock; auto-submit that happens exactly
  once, online or offline; distinct consecutive tests; `timing` saved on practice attempts;
  untimed stays the default.
- **Non-goals:** everything in 5b-2 (above); timing for the baseline or mini-quizzes (always
  untimed); server-side enforcement of the time limit (`timing` is client-reported analytics,
  never used for grading); pausing the clock in the background (ph-3-us-9: pausing is easy to
  game and makes "timed" meaningless); a configurable limit.
- **Anti-goals:** a timed test submitted twice, or a submission failing because of bad
  `timing`; a teen able to keep answering after time is up; a clock that resets on resume; a
  test shorter than 25 because of repeat-avoidance; stressful framing (red "FAIL", alarms). The
  last-minute color is the alert token, the warnings are gentle.

## Decisions (2026-11-20)

| # | Question | Decision | Changes a story? |
|---|----------|----------|------------------|
| 1 | Source of "recently seen" for repeat-avoidance | **The last 3 graded practice attempts** (`users/{uid}/testAttempts`, `type == 'practice'`, `createdAt` desc, limit `RECENT_TESTS_TO_AVOID = 3`), their `perQuestion[].questionId`. Uses the existing `type` + `createdAt` index, so no new index. Attempts are questions the teen actually saw; assignments also include tests handed out but never taken (e.g. a screen closed while `assembleTest` was in flight). | Yes: ph-3-us-6 (proposed `testAssignments` and a new index) |
| 2 | Priority when rules clash | As ph-3-us-6 proposed: **scenario minimum > repeat-avoidance > topic cap.** With a 1415-question bank and 75 questions avoided at most, the clash almost never happens; the rule is there so small banks in tests behave predictably. | Settles ph-3-us-6's Question |
| 3 | Top-up order when unseen questions run out | **Random among seen questions**, not oldest-first. Attempts give no cheap "oldest" order inside the 3, and with the real bank the top-up doesn't run. *Claude's call.* | Yes: ph-3-us-6 drops "oldest first where possible" |
| 4 | Where mode and start time live | On the saved practice session (`quizSession`): `timing: { mode, timeLimitSec?, startedAt }` (epoch ms). Saved in `startSession`, so it's on the phone before the first question shows. Time left is always `limit − (now − startedAt)`, clamped to `[0, limit]` (a clock set backwards can't add time beyond the limit). | Settles ph-3-us-9 / ph-3-us-1 "`startedAt` alongside the cache entry" |
| 5 | When `elapsedSec` is measured | **When the submit is first attempted** (tap Submit, or time reaching zero), not when the network call finally succeeds. For a timed-out test it's the limit exactly. Held-offline submissions keep that value through retries. | No |
| 6 | How results know time ran out | `timedOut = timing.mode === 'timed' && timing.elapsedSec >= timing.timeLimitSec`, from the saved `timing`. `scoreTest` returns the saved `timing` on practice results, so the in-memory results and the reopened-from-Recent-tests results use the same rule. No extra stored flag. | Small addition to ph-3-us-8 (`timing` in the result) |
| 7 | The open "Submit?" dialog at zero | React Native's `Alert` can't be closed from code. **Auto-submit goes ahead anyway**; the dialog's buttons become harmless (the screen's existing guards ignore a second submit once one is in flight or the results are showing). Same for an open "Leave the test?" dialog. *Claude's call*; replacing `Alert` with a custom modal isn't worth it here. | No |
| 8 | Mode preference storage | AsyncStorage per user, `dmv-app:practice-mode:{uid}` (`'timed' \| 'untimed'`, missing → untimed), next to the other `localFlags`. Cleared with the other local data on sign-out (Slice 6 carry-forward). | No |
| 9 | Tests already saved by a 5a install | A saved practice session without `timing` resumes as **untimed** and submits with no `timing` (saved as `null`). | No |
| 11 | Discarding a timed test that already ran out | **Not allowed: an expired test always gets graded** (decided 2026-11-20). On an expired saved test the resume card hides Discard and shows only "Open to submit"; "Start a new test" (from the tab or "Take another test") opens the expired test instead, which submits at once (the resume path below), and the teen starts fresh from its results. A timed test that hasn't run out can still be discarded, like walking out. Keeps failed timed runs in the pass-rate data and their questions in repeat-avoidance. | Yes: ph-3-us-9 (new criterion) |
| 10 | What `elapsedSec` measures | **Wall-clock time from `startedAt` to the submit**, including time the app was closed. For timed tests that's the exam rule; for untimed tests it's "how long the test stayed open", good enough for analytics. When it's out of range (over 24 hours) only `elapsedSec` becomes `null`; `mode` is kept. *Claude's call* (builder check). | Yes: ph-3-us-8 (`elapsedSec` may be `null`; malformed `elapsedSec` no longer nulls the whole `timing`) |

## Backend

**`assembleTest`** (`functions/src/assembleTest.ts`, ph-3-us-6):
- `assembleTestForUser` reads the caller's last `RECENT_TESTS_TO_AVOID` practice attempts
  (decision 1) and builds a `Set` of seen question IDs. Attempts without a usable
  `perQuestion` array, or entries without a string `questionId`, are skipped, not errors. The
  read runs alongside the approved-questions read.
- `selectPracticeQuestions` gains an optional `isSeen?: (item: T) => boolean` in its options
  (default: nothing seen, so existing callers and tests behave exactly as today). The passes
  become eight, ordered so that avoidance sits outside the cap (decision 2: an unseen question
  over the topic cap is taken before a seen one under it):
  1. scenario unseen under cap → scenario unseen ignoring cap → scenario seen under cap →
     scenario seen ignoring cap (each until `minScenario`)
  2. any unseen under cap → any unseen ignoring cap → any seen under cap → any seen ignoring
     cap (each until `count`)

  The final shuffle is unchanged. A user with no practice history gets exactly today's result.
- The contract (input, output, `testAssignments` write) is unchanged. `freeTestUsedAt` is not
  touched (ph-3-us-5). No rate limit is added (ph-3-us-5).
- Doc comments follow the `cloud-function-documentation` skill (update the selection order and
  the new read in `Reads:`); `functions/README.md` documents repeat-avoidance under
  `assembleTest`.

**`scoreTest`** (`functions/src/scoreTest.ts`, ph-3-us-8):
- Input gains optional `timing: { mode: 'timed' | 'untimed', timeLimitSec?: number,
  elapsedSec: number }`. A pure `parseTiming(raw): Timing | null` validates it: `mode` one of
  the two; `elapsedSec` a finite number, `0 ≤ elapsedSec ≤ 86400`; for `timed`, `timeLimitSec`
  a finite number `> 0` and `≤ 86400`; for `untimed`, `timeLimitSec` is dropped. An unknown
  `mode` (or `timing` not an object) → `null`. **A bad or out-of-range `elapsedSec` keeps the
  mode** and saves `elapsedSec: null` (decision 10), so an untimed test left open over a few
  days is still recorded as untimed. Seconds are whole numbers (the client floors them, so a
  submit at 59:59.6 isn't counted as timed out). Validation never throws.
- Practice attempts save `timing` (the parsed object or `null`). Mini-quiz and baseline
  submissions ignore it and don't save the field.
- The practice `ScoreTestResult` includes `timing` (decision 6). Grading is unchanged:
  unanswered questions count as wrong, as today.
- Tests in `functions/src/scoreTest.test.ts`; `functions/README.md` input and persistence
  sections updated.

No Firestore rules or index changes. Deploy `assembleTest` and `scoreTest` to `dmv-app-dev`
(smoke check: unauthenticated call → 401).

## Frontend

**Timing helpers** (new pure module, e.g. `src/practice/timing.ts`, `npm run test:app`):
`TIMED_TEST_LIMIT_SEC = 3600`; `remainingSeconds(startedAt, limitSec, now)` (clamped to
`[0, limit]`); `elapsedSeconds(startedAt, now)` (never negative); `timingPayload(sessionTiming,
now, timedOut)` building the `scoreTest` `timing` (timed-out → `elapsedSec = timeLimitSec`);
`formatClock(sec)` ("59:59", "0:42"); `warningFor(sec)` (`'5min' | '1min' | null`).

**Session store** (`src/quiz/quizSession.ts`, decision 4): `StoredSession` and `ActiveSession`
gain optional `timing: { mode: 'timed' | 'untimed'; timeLimitSec?: number; startedAt: number }`.
`startSession` takes it as an optional argument (practice always passes it, the baseline never
does); `saveAnswers` keeps it when it rewrites the session. Sessions without it read as before
(decision 9).

**Practice tab home** (`src/practice/PracticeHomeScreen.tsx`):
- A two-option switch next to "Start a practice test": "Untimed" (default) / "Timed — 60 min,
  like the real test". Loads and saves the preference (decision 8). Uses the app's existing
  components and tokens; a segmented pair of buttons is fine.
- `startPracticeTest` passes the chosen mode to the `PracticeTest` route (new param, e.g.
  `{ timed?: boolean }`), including "Take another test" from results, which uses the saved
  preference.
- The resume card, for a timed session, adds "N min left" or, if already expired, "Time's up —
  open it to submit" with only an "Open to submit" button, no Discard (decision 11).
- `startPracticeTest`: when the saved session is timed and expired, it skips the "Start a new
  test?" prompt and opens `PracticeTest` with `resume: true` (decision 11), so the expired test
  is graded first. Expiry is checked with `remainingSeconds` at the moment of the tap.

**Practice test screen** (`src/practice/PracticeTestScreen.tsx`):
- On start, `startSession(..., { mode, timeLimitSec, startedAt: Date.now() })`. If the cache
  write fails (existing notice), the timing is still kept in memory for this run.
- **Countdown** (timed only): a small pill in the runner's header area showing `formatClock`,
  ticking once a second from `remainingSeconds` (recomputed from `startedAt`, never
  decremented). Kept in its own small component so the tick doesn't re-render the question.
  Also recomputed when the app returns to the foreground (`AppState`). In the last minute it
  uses the alert color token. At 5 min and 1 min left, a gentle one-time notice (an inline
  banner or toast, not an `Alert`, which would block answering). Untimed: no pill.
- **Time up:** when remaining reaches 0 (on a tick, on foreground, or on resume), the screen
  marks the test **locked**, records `timedOut`, and calls the existing submit path with the
  saved answers and no confirmation. The existing guards (`submittingRef`, phase checks) make
  it happen once (decision 7). Offline → the existing "waiting for connection" hold and
  reconnect resend.
- **Locked answers:** `QuizRunner` gains a `locked?: boolean` prop: choices can't be changed
  and Submit is hidden or disabled; the teen can still move between questions. A short line
  says "Time's up — submitting your answers" (or the offline variant).
- **Resume:** a resumed timed session uses its saved `startedAt`; if it's already expired, it
  locks and submits straight away instead of letting the teen continue.
- **Leaving:** for a timed test the "Leave the test?" message says the clock keeps running
  ("The timer keeps going while you're away").
- **Every practice submission sends `timing`** via `timingPayload`, using decision 5's
  measurement point (captured once, reused on retries).
- The auto-submit uses the screen's latest answers held in memory (a ref), not a re-read of the
  AsyncStorage copy.

**Practice results** (`src/practice/practiceData.ts`, `PracticeResults.tsx`):
- `PracticeOutcome` gains `timing` (from the `scoreTest` result or the reopened attempt).
- When `timedOut` (decision 6): "Time ran out — N questions unanswered", where N counts
  `perQuestion` entries with `choice === null` and not `unavailable`. With N = 0: "Time ran
  out — you answered every question". Neutral wording, near the score.
- For a timed test finished in time, optionally "Finished in 42 min" (builder's call).

## Story and doc updates

When device-tested: ph-3-us-6, ph-3-us-8, ph-3-us-9 Complete; parents ph-3-us-5 and ph-3-us-7
Complete; ph-3-us-1 and ph-3-us-4 Complete (timed parts were their last open parts); ph-4-us-1
stays In Progress (baseline comparison is 5b-2). Record decisions 1–3 in ph-3-us-6, decision 6
and 10 in ph-3-us-8, decisions 4/7/8/9/11 in ph-3-us-9. Update `build-order.md`: split 5b into 5b-1 and
5b-2 with this status, and the Phase 3 and Phase 4 summaries.

## Left to the builder

- Exact copy and layout within the patterns above (encouraging, no "fail").
- A dev-only way to shorten the limit for device test steps 4–6 (e.g. a `__DEV__`-only
  constant override); it must not ship in release builds.
- Whether the 5/1-minute notices are a banner or a toast.
- Whether "Finished in N min" shows.
- Tests: `selectPracticeQuestions` with `isSeen` (no history = today's behavior; big pool → no
  repeats across 3 tests; pool of 25 → identical test allowed; pool of 40 → partial repeat;
  scenario minimum met from seen scenario questions when unseen ones run out; seen-over-cap
  never chosen before unseen-over-cap) and the attempts read (bad docs skipped, only
  `practice`) in `npm run test:functions`; `parseTiming` cases and "mini-quiz ignores timing"
  in the same suite; the timing helpers in `npm run test:app`; session timing round-trip and
  the 5a-session case; Practice tab switch and resume card; countdown, auto-submit once,
  expired-on-resume, locked runner, offline time-up in `npm run test:components` (fake timers).
