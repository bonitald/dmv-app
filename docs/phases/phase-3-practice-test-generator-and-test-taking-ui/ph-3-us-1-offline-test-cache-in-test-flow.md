# Use the on-device test cache in the test-taking flow

**ID:** ph-3-us-1
**Layer:** Frontend
**Status:** Complete (baseline use 2026-09-28, Slice 2; practice-test use device-tested 2026-11-20, Slice 5a; timed-test `startedAt` on the saved session device-tested 2026-11-22, Slice 5b-1. Mini-quiz part dropped in Slice 4b)

## Story
As a teen user,
I want a test I've started to keep working if I lose connectivity or the app closes,
So that I'm not interrupted or lose progress partway through a test.

## Context
- **Product area**: Phase 3 (`docs/phases.md`) — test-taking UI.
- **Layer**: Frontend only. The backend and the cache module are already built in Phase 1.
- **Carried over from Phase 1 (2026-09-23).** ph-1-us-3 (scoped offline caching) and ph-1-us-5
  (on-device cache) built the pieces: the assemble functions return one session's bounded
  question set, and `src/study/testCache.ts` stores it on the device
  (`saveTestCache` / `getTestCache` / `clearTestCache`, AsyncStorage). Their remaining acceptance
  criteria describe how the test-taking screen uses that cache, which is Phase 3's job, so they
  were moved here and Phase 1 was closed.
- Applies to practice test (`assembleTest`) and baseline section (`startOrResumeBaseline`). Mini-quizzes (`assembleMiniQuiz`) were dropped from this story in Slice 4b.

## Acceptance Criteria
From ph-1-us-5:
- [x] Given a user starts a practice test, when `assembleTest` returns a question set, then it's
  written to the cache under its `testId` (via `saveTestCache`) before the test-taking screen
  shows the first question.
- [x] Given a cached test exists, when the device loses network connectivity, then moving between
  questions in that test reads from the cache, not a network call.
- [x] Given a test is completed (submitted to `scoreTest`) or explicitly abandoned, when that
  happens, then its cache entry is removed (`clearTestCache`).
- [x] Given the app is killed and reopened while a test's cache entry still exists, when the app
  restarts, then it detects the unfinished test and either resumes it or clears it.

From ph-1-us-3:
- [x] Given a cached in-progress test, when the device goes offline mid-test, then the user can
  keep answering from the cached set without interruption.
- [x] Given a test is completed or abandoned, when the session ends, then its cached question set
  is cleared, so question content doesn't pile up on the device.

Added when carrying over:
- [x] Given a test is in progress, when its questions are cached, then the app also stores which
  `testId` is active. `testCache.ts` has no "list cached tests" call, so without this a
  restarted app can't find the entry to resume or clear.
- [x] Given a baseline section is in progress, when the user pauses between sections or the local
  cache is cleared, then the baseline isn't treated as abandoned: the next section is fetched
  again from `startOrResumeBaseline`, which holds the real progress on the server.

## UI/UX Notes
- Resume-vs-clear after a force-quit is this story's decision (it was deferred here from
  ph-1-us-5). Suggested default: offer "Resume test" / "Discard" on next launch.
- A connectivity banner during an offline test is optional, not required by this story.
- Submitting answers still needs the network (`scoreTest` grades on the server). If the device
  is offline at submit time, keep the answers and the cache, and retry when back online rather
  than losing the test.

## Dependencies
- **Built in Phase 1**: `src/study/testCache.ts` (ph-1-us-5); `assembleTest`,
  `assembleMiniQuiz`, `startOrResumeBaseline`, `scoreTest` (ph-1-us-4, -7, -8, -11).
- **Blocked by**: ph-3-us-4 (test-taking screen / shared runner this hooks into).
- **Serves**: practice tests (ph-3-us-4), baseline sections (ph-3-us-13), concept mini-quizzes
  (ph-2-us-8). Also stores `startedAt` for timed tests (ph-3-us-9).

## Test Notes
- **Happy path**: start test → questions cached → answer all → submit → cache entry and active
  `testId` cleared.
- **Edge cases**: go offline mid-test and keep answering; force-quit mid-test, relaunch, resume;
  force-quit, relaunch, discard; start a new test while a stale one exists.
- **Failure modes**: cache write fails (`saveTestCache` rejects) — tell the user the test won't
  survive going offline rather than failing silently; submit while offline — answers kept and
  retried.

## Tasks
- [ ] Call `saveTestCache` when a session's questions arrive, and store the active `testId`.
- [ ] Read questions from the cache while the test is in progress.
- [ ] Clear the cache entry and active `testId` on submit or abandon.
- [ ] On launch, detect an active `testId` and offer resume or discard.
- [ ] Tests for the scenarios above.

## Implementation notes (Slice 4b)
Built in Slice 4b on `feat/mini-quiz-progress`; plan `docs/superpowers/plans/2026-10-11-slice-4b-mini-quiz-progress.md`, design `docs/superpowers/specs/2026-10-11-slice-4b-mini-quiz-progress-design.md` (including its Amendment A1-A7 from device testing). Device-tested on the Android emulator 2026-10-11.
- **Mini-quiz part dropped (spec decision 6):** mini-quizzes are not stored in the on-device session (`quizSession` holds one active test per user, so a mini-quiz would drop an in-progress baseline). A killed mini-quiz is abandoned and a new one gets a new `testId`; offline at submit still holds the answers on screen. This story now covers the baseline (done) and practice tests (Slice 5).

## Questions
- Should an unsubmitted test be kept indefinitely after a force-quit, or expire after some time?

## Implementation notes (Slice 5a)
Built in Slice 5a on `feat/practice-tests`; plan `docs/superpowers/plans/2026-11-20-slice-5a-practice-tests.md`, design `docs/superpowers/specs/2026-11-20-slice-5a-practice-tests-design.md`. Device-tested on the Android emulator against dev 2026-11-20.
- **One saved session per kind (decision 1):** `quizSession` keeps a baseline slot and a practice slot (`dmv-app:active-test:{uid}:{kind}`), so neither can drop the other; the old single key migrates to the baseline slot on first read.
- **Resume vs discard (decision 5):** an unfinished practice test shows as a "Resume your test" card on the Practice tab (Resume / Discard), not a launch prompt. Starting a new test while one is saved asks first. Leaving mid-test keeps the answers.
- Leaving while the test is still loading saves nothing; a submit the server permanently rejects clears the saved test and points back to the Practice tab.
- Still open: stale-test expiry (Questions).

## Implementation notes (Slice 5b-1)
Built in Slice 5b-1 on `feat/timed-tests`; plan `docs/superpowers/plans/2026-11-20-slice-5b1-timed-tests.md`, design `docs/superpowers/specs/2026-11-20-slice-5b1-timed-tests-design.md`. Device-tested on the Android emulator against dev 2026-11-22: everything passed. `assembleTest` and `scoreTest` deployed to `dmv-app-dev` (smoke check 401); no rules or index changes.
- **`startedAt` lives on the saved session (ph-3-us-9, decision 4):** the practice session now stores `timing: { mode, timeLimitSec?, startedAt }` next to its answers, written in `startSession` before the first question shows. `saveAnswers` keeps it. A session saved by a 5a install has no `timing` and resumes untimed.
