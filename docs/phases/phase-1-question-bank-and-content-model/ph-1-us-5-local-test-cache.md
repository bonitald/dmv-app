# On-device cache for the active test's question set

**ID:** ph-1-us-5
**Layer:** Frontend
**Parent:** ph-1-us-3
**Status:** Not Started

## Story
As a teen user,
I want the question set for my current practice test stored on my device once it starts,
So that I can keep answering questions even if I go offline mid-test.

## Context
- **Product area**: Phase 1 (`docs/phases.md`), supports Phase 3's test-taking UI.
- **Layer**: Frontend (Expo/React Native)
- Backed by ph-1-us-4 (`assembleTest` Cloud Function) — **not built yet**, so this story's
  fetch step is stubbed/mocked until that lands; don't assume a live function to develop against
  yet.
- Storage mechanism: `@react-native-async-storage/async-storage`, storing the assembled
  question set as a single JSON blob keyed by `testId`. Chosen over `expo-sqlite` because the
  cached payload is small (one test's worth of questions, not the full bank) and short-lived —
  no need for relational querying of cached content on-device.

## Acceptance Criteria
- [ ] Given a user starts a practice test, when `assembleTest` returns a question set, then it's
  written to AsyncStorage under a key derived from its `testId` before the test-taking UI renders
  its first question.
- [ ] Given a cached test set exists locally, when the device loses network connectivity, then
  navigating between questions in that test reads from the local cache, not a network call.
- [ ] Given a test is completed (all questions answered/submitted) or explicitly abandoned by the
  user, when that happens, then its cached entry is removed from AsyncStorage.
- [ ] Given the app is killed and reopened while a test's cache entry still exists (e.g. user
  force-quit mid-test), when the app restarts, then the app can detect and either resume from or
  clear the stale cached test (exact resume-vs-clear UX is a Phase 3 test-taking-flow decision,
  not this story's — this story only guarantees the data survives the process kill).

## UI/UX Notes
- No new screens — this is a data-layer concern underneath Phase 3's test-taking UI, which does
  not exist yet. This story should land as a small, tested utility module (e.g.
  `src/study/testCache.ts` with `saveTestCache`, `getTestCache`, `clearTestCache` functions) that
  Phase 3 imports rather than reimplementing.
- **Offline state**: no user-visible indicator required by this story alone — Phase 3 may want a
  connectivity banner, but that's out of scope here.

## Dependencies
- **Blocked by**: none for the cache module itself; needs ph-1-us-4 for a real end-to-end fetch
  (can be developed/tested against a mocked `assembleTest` response in the meantime).
- **Parent**: ph-1-us-3 — this is the frontend half of "cache only what one test needs."
- **Backed by**: ph-1-us-4 (not yet built).

## Test Notes
- **Happy path**: save → read-back round-trip of a mocked question set; matches what was saved.
- **Edge cases**: reading a cache key that was never written (returns null/empty, not a throw);
  saving a new test while a stale one from a killed session still exists (previous session's
  handling, not silent overwrite-and-lose).
- **Failure modes**: AsyncStorage write failure (e.g. storage full) should surface as a catchable
  error to the caller, not fail silently and leave the test unusable offline.

## Tasks
- [ ] Add `@react-native-async-storage/async-storage` dependency.
- [ ] Implement `src/study/testCache.ts`: `saveTestCache(testId, questions)`,
  `getTestCache(testId)`, `clearTestCache(testId)`.
- [ ] Write unit tests covering the Test Notes scenarios above (mock AsyncStorage per Jest/Expo
  conventions already used elsewhere in this repo).

## Questions
- Resume-vs-clear UX for a stale cached test after a force-quit is deferred to Phase 3 — flagged
  here so it isn't lost.
