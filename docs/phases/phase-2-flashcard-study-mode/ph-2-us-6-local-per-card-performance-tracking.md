# Local per-card performance tracking

**ID:** ph-2-us-6
**Layer:** Parent
**Status:** Not Started

## Story
As a teen user,
I want the app to remember which questions I've gotten wrong in quizzes,
So that my flashcards can put what I actually need to practice first (ph-2-us-4), without me
having to flag "weak" cards myself.

## Context
- **Product area**: Phase 2 (`docs/phases.md`)
- **Layer**: Frontend (Expo/React Native) — no Backend split. `docs/phases.md`'s Phase 2 bullet
  says this is tracked "locally", and `prd.md` doesn't call for cross-device sync of study
  performance (`prd.md` Section 7). Local-only is the deliberate MVP scope. Concept-level progress
  is saved server-side separately (ph-2-us-10).
- **Where results come from** (changed 2026-09-23): flashcards have no per-card marking (ph-2-us-3).
  Results come from graded quizzes: `scoreTest` returns `perQuestion` —
  `{ questionId, chunkId, choice, correctAnswer, correct }` for each question — after a mini-quiz
  (ph-2-us-8). Practice tests and the completed baseline are recorded the same way by
  ph-4-us-5.
- A question's `id` is the same in quizzes and flashcards, so a quiz result applies directly to
  that question's flashcard.
- This is the data source ph-2-us-4's ordering reads from — land its interface first.

## Acceptance Criteria
- [ ] Given a mini-quiz is scored, when `scoreTest` returns `perQuestion`, then local storage is
  updated for each graded question with its graded count, miss count, and last result.
- [ ] Given a `perQuestion` entry is `unavailable` (question deleted) or has a null `correct`,
  when results are recorded, then that entry is skipped, not counted as a miss.
- [ ] Given the app is closed and reopened, when the user returns to a previously studied topic,
  then its history is still there (not reset).
- [ ] Given a question has been graded before, when its history is read, then it reflects
  cumulative history (not just the latest result) — graded count and miss count both persist and
  accumulate.
- [ ] Given a question has never been graded, when its history is read, then it returns a clear
  "no history" result rather than throwing or returning a zero default that looks the same as
  "answered correctly every time."

## Dependencies
- **Blocked by**: nothing for the storage module itself (build it first — ph-2-us-4 needs its
  interface). The "record quiz results" task is blocked by ph-2-us-8 (mini-quiz).
- Feeds: ph-2-us-4 (weak-card ordering reads this data).

## Test Notes
- **Happy path**: a question answered wrong in two quizzes and right in a third has 3 graded,
  2 missed, most recent result correct.
- **Edge cases**: history spanning two app sessions (survives restart); `unavailable` entries;
  many topics' history doesn't noticeably slow loading a topic.
- **Failure modes**: a storage read/write failure (storage full or corrupted) degrades to "no
  history" rather than crashing the flashcard or results screens.

## Tasks
- [ ] Implement as `src/study/cardPerformance.ts` on AsyncStorage (already installed; follow the
  `src/study/testCache.ts` pattern), one key per topic (`dmv-app:card-perf:{chunkId}`) so a
  topic's history loads in one read. Keep the interface storage-agnostic so ph-2-us-4 doesn't
  depend on AsyncStorage.
- [ ] Implement `recordQuizResults(perQuestion)` and `readTopicHistory(chunkId)`.
- [ ] Call `recordQuizResults` when a mini-quiz's `scoreTest` result arrives (ph-2-us-8).

## Questions
- Whether this local data should ever sync to Firestore (to survive a reinstall, or feed the
  Phase 5/8 pass-rate analysis) isn't addressed in `prd.md`. Flagged as a future consideration,
  consistent with the device-identity-doesn't-survive-reinstall limitation accepted in
  `docs/phases.md` Phase 0. The full quiz history is already server-side in `testAttempts`, so it
  could be rebuilt from there if needed.
