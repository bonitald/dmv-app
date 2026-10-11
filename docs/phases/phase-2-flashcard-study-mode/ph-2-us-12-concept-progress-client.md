# Client Concept Progress module

**ID:** ph-2-us-12
**Layer:** Frontend
**Parent:** ph-2-us-10
**Status:** Complete (Slice 4a; `setStatusFromChoice` is built and tested, its screen arrives in Slice 4b)

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
- [x] Given a signed-in user, when a screen subscribes to Concept Progress, then it gets a map of
  `chunkId → { status, latestMiniQuizScore?, latestMiniQuizAt? }` that updates live when a
  status changes or `scoreTest` writes a new score.
- [x] Given a topic has no doc, when it's read, then its status is `not-started`. Given a doc
  with a score but no `status`, then its status is `in-progress`.
- [x] Given a topic is `not-started`, when `markOpened(chunkId)` is called (flashcards or quiz
  opened), then status becomes `in-progress`. Given it's already `reviewed` or `needs-revisit`,
  then nothing is written.
- [x] Given a next-step choice, when `setStatusFromChoice(chunkId, choice)` is called, then it
  writes `in-progress` (Review Again), `needs-revisit` (Come Back Later) or `reviewed` (Mark
  Reviewed), with `statusUpdatedAt` as the server timestamp.
- [x] Given the device is offline, when a status is written, then the UI updates immediately
  from Firestore's local cache and the write syncs when back online.
- [x] Given a write is rejected by rules, when that happens, then it's logged and the UI doesn't
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
- [x] Add `src/study/conceptProgress.ts`: keep the transition logic in a pure function
  (current status + event → new status or "no write") and unit-test it with
  `npm run test:app`.
- [x] Add the Firestore read (live subscription) and write functions around it.
- [x] Add a `useConceptProgress()` hook for screens.

## Implementation notes (Slice 4a)
Built in Slice 4a on `feat/concept-list-flashcards`; plan `docs/superpowers/plans/2026-10-03-slice-4a-concept-list-flashcards.md`, design `docs/superpowers/specs/2026-10-03-slice-4a-concept-list-flashcards-design.md`.
- Split into a pure `src/study/conceptProgressData.ts` and a Firebase `src/study/conceptProgress.ts`. `useConceptProgress` reports `error` separately from an empty map, and the viewer never calls `markOpened` from an unknown status, so a failed read cannot downgrade a reviewed topic.
- `setStatusFromChoice` has no screen yet: the next-step choice screen is ph-2-us-9 (Slice 4b).
- **Carry-forward to Slice 4b:** once the `reviewed` status can exist, ignore a cache-only empty first progress snapshot before `markOpened`, so a stale empty cache cannot downgrade it.
- **Carry-forward to Slice 6:** `clearDeckCache()` and resetting last-opened and progress on sign-out.

## Questions
None outstanding. Transition choices are recorded (and can be changed) on ph-2-us-10 and
ph-2-us-9.
