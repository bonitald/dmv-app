# Missed questions I can come back to

**ID:** ph-4-us-5
**Layer:** Parent
**Status:** Not Started

## Story
As a teen user,
I want one place that lists the questions I've been getting wrong across my tests,
So that I can go back over them without digging through old tests, and so my flashcards focus on
them too.

## Context
- **Product area**: Phase 4 (`docs/phases.md`, third bullet: "missed questions from past tests
  are visible somewhere I can revisit them (feeds back into Phase 2's weak-card logic where the
  same content overlaps)").
- **Layer**: Frontend (Expo/React Native). No Backend split: `testAttempts` are client-readable,
  and with ph-4-us-3 each attempt carries question text, choices and answers. Aggregation is
  per-user and small, so it runs on the device. A backend child would be empty.
- **What counts as "missed"**: a question whose **most recent** graded result is wrong or
  skipped. Getting it right in a later test takes it off the list, so the list shrinks as the
  user learns. Uses practice tests, mini-quizzes, and the baseline once complete
  (`baselineReview`). Held-back baseline sections are ignored.
- **Feeding Phase 2**: ph-2-us-6 stores per-question results locally for weak-card ordering
  (ph-2-us-4), currently from mini-quizzes only. This story also records **practice test** and
  **completed baseline** results into it, so a question missed in a practice test comes earlier
  in that topic's flashcards. Flashcards and test questions share the same `id`.

## Acceptance Criteria
- [ ] Given the user has graded attempts, when they open "Missed questions", then they see every
  question whose latest result is a miss, grouped by handbook topic in handbook order, with a
  count per topic.
- [ ] Given a question was missed and later answered correctly, when the list loads, then it's
  not on the list.
- [ ] Given the user taps a missed question, when it opens, then it shows in the review layout
  (ph-4-us-4): text, choices, their last answer, the correct answer, explanation or topic
  fallback.
- [ ] Given a topic group, when the user taps "Study this concept", then that topic's flashcards
  open (ph-2-us-3).
- [ ] Given a practice test is graded, or the baseline completes, when results arrive, then their
  per-question results are recorded in local card performance (ph-2-us-6), the same way
  mini-quiz results are.
- [ ] Given the user has no misses (or no attempts yet), when the list opens, then it shows a
  friendly empty state that points to a practice test or the concept list.
- [ ] Given a baseline in progress, when the list is built, then its held-back sections aren't
  used (no answers to show yet).

## UI/UX Notes
- **Screens/flows**: reachable from the Practice tab home ("Missed questions — 12") and from the
  results screens. Tapping a question opens the review layout; tapping a topic header opens its
  flashcards.
- Keep it a plain list, not a score or streak.

## Dependencies
- **Blocked by**: ph-4-us-3 (text on attempts), ph-4-us-4 (review layout), ph-2-us-6 (local
  performance store).
- **Feeds**: ph-2-us-4 (weak-card ordering).

## Test Notes
- **Happy path**: miss Q1 in test A, get it right in test B → off the list; miss Q2 in both →
  on the list.
- **Edge cases**: same question in a mini-quiz and a practice test; `unavailable` questions
  (skipped); a user with 50+ attempts (reads are bounded, see Tasks).
- **Failure modes**: offline with nothing cached (empty/offline state); an old attempt without
  text (shown with "question text unavailable").

## Tasks
- [ ] Add a pure `latestMisses(attempts)` function (latest result per question, misses only),
  unit-tested with `npm run test:app`.
- [ ] Read the user's recent attempts (newest first, bounded — proposed last 30) and build the
  list.
- [ ] Build the missed-questions screen with topic groups and links.
- [ ] Call ph-2-us-6's `recordQuizResults` for practice tests and the completed baseline
  (`baselineReview`) when results arrive.

## Questions
- Reading only the last 30 attempts means a question missed long ago and never seen again could
  drop off. Fine for MVP. If it matters later, keep a small per-question summary instead.
