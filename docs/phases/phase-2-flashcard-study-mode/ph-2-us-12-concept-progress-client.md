# Client Concept Progress module

**ID:** ph-2-us-12
**Layer:** Frontend
**Parent:** ph-2-us-10
**Status:** Not Started

## Story
As a developer,
I want one client module that reads a user's Concept Progress and applies the status rules,
So that the concept list, flashcard viewer and results screen all show and change status the
same way.

## Context
- **Product area**: Phase 2 (`docs/phases.md`, eighth bullet).
- **Layer**: Frontend (Expo/React Native), data module only; no screens.
- Backed by ph-2-us-11 (record + rules + `scoreTest` write) — not built yet.
- The status transitions table on ph-2-us-10 is the spec. This module is where it's implemented,
  so screens never write `status` directly.
- Identity comes from `useAuth()` (`src/auth/AuthProvider.tsx`), per ph-0-us-7.
- Firestore offline persistence (on by default in React Native Firebase) queues writes made
  while offline and serves cached reads. That covers ph-2-us-9's "save when offline" criterion
  without a custom queue.

## Acceptance Criteria
- [ ] Given a signed-in user, when a screen subscribes to Concept Progress, then it gets a map of
  `chunkId → { status, latestMiniQuizScore?, latestMiniQuizAt? }` that updates live when a
  status changes or `scoreTest` writes a new score.
- [ ] Given a topic has no doc, when it's read, then its status is `not-started`. Given a doc
  with a score but no `status`, then its status is `in-progress`.
- [ ] Given a topic is `not-started`, when `markOpened(chunkId)` is called (flashcards or quiz
  opened), then status becomes `in-progress`. Given it's already `reviewed` or `needs-revisit`,
  then nothing is written.
- [ ] Given a next-step choice, when `setStatusFromChoice(chunkId, choice)` is called, then it
  writes `in-progress` (Review Again), `needs-revisit` (Come Back Later) or `reviewed` (Mark
  Reviewed), with `statusUpdatedAt` as the server timestamp.
- [ ] Given the device is offline, when a status is written, then the UI updates immediately
  from Firestore's local cache and the write syncs when back online.
- [ ] Given a write is rejected by rules, when that happens, then it's logged and the UI doesn't
  crash.

## UI/UX Notes
- **Screens/flows**: none of its own. Used by the concept list (ph-2-us-7), flashcard viewer and
  quiz (`markOpened`, ph-2-us-3 / ph-2-us-8) and the results screen (ph-2-us-9).

## Dependencies
- **Parent**: ph-2-us-10 — the client half: reading progress and applying the status rules.
- **Backed by**: ph-2-us-11 — not built yet. The transition logic can be built and unit-tested
  first against a mocked Firestore.
- **Consumed by**: ph-2-us-7, ph-2-us-8, ph-2-us-9.

## Test Notes
- **Happy path**: new topic → opened → in progress → Mark Reviewed → reviewed; reopening leaves
  it reviewed.
- **Edge cases**: score but no status; Come Back Later then reopen (stays needs revisit); Review
  Again from reviewed (becomes in progress).
- **Failure modes**: offline write; rules rejection; signed-out (no uid) — module returns an
  empty map and doesn't write.

## Tasks
- [ ] Add `src/study/conceptProgress.ts`: keep the transition logic in a pure function
  (current status + event → new status or "no write") and unit-test it with
  `npm run test:app`.
- [ ] Add the Firestore read (live subscription) and write functions around it.
- [ ] Add a `useConceptProgress()` hook for screens.

## Questions
None outstanding. Transition choices are recorded (and can be changed) on ph-2-us-10 and
ph-2-us-9.
