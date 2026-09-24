# Use the on-device test cache in the test-taking flow

**ID:** ph-3-us-1
**Layer:** Frontend
**Status:** Not Started

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
- Applies to all three session kinds: practice test (`assembleTest`), mini-quiz
  (`assembleMiniQuiz`), and baseline section (`startOrResumeBaseline`).

## Acceptance Criteria
From ph-1-us-5:
- [ ] Given a user starts a practice test, when `assembleTest` returns a question set, then it's
  written to the cache under its `testId` (via `saveTestCache`) before the test-taking screen
  shows the first question.
- [ ] Given a cached test exists, when the device loses network connectivity, then moving between
  questions in that test reads from the cache, not a network call.
- [ ] Given a test is completed (submitted to `scoreTest`) or explicitly abandoned, when that
  happens, then its cache entry is removed (`clearTestCache`).
- [ ] Given the app is killed and reopened while a test's cache entry still exists, when the app
  restarts, then it detects the unfinished test and either resumes it or clears it.

From ph-1-us-3:
- [ ] Given a cached in-progress test, when the device goes offline mid-test, then the user can
  keep answering from the cached set without interruption.
- [ ] Given a test is completed or abandoned, when the session ends, then its cached question set
  is cleared, so question content doesn't pile up on the device.

Added when carrying over:
- [ ] Given a test is in progress, when its questions are cached, then the app also stores which
  `testId` is active. `testCache.ts` has no "list cached tests" call, so without this a
  restarted app can't find the entry to resume or clear.
- [ ] Given a baseline section is in progress, when the user pauses between sections or the local
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

## Questions
- Should an unsubmitted test be kept indefinitely after a force-quit, or expire after some time?
