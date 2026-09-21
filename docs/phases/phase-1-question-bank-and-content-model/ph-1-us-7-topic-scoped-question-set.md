# Topic-scoped mini-quiz assembly

**ID:** ph-1-us-7
**Layer:** Backend
**Status:** Not Started

## Story
As a teen user reviewing one handbook topic,
I want a short quiz drawn only from that topic,
So that I can check what I just reviewed before deciding to move on or repeat it.

## Context
- **Product area**: Phase 1 (`docs/phases.md`), consumed by Phase 2's concept learning path.
- **Layer**: Backend (Firebase Cloud Functions)
- Terminology: the learning path's "concept" is a handbook **topic** = `chunkId` (45, PDF order);
  `conceptId` (499) is a finer sub-concept inside a topic. Mini-quizzes are scoped by topic.
- Follows the same shape as `assembleTest` (ph-1-us-4): returns questions and choices with a
  `testId`, **no answers**. Answers stay on the server and are only used for grading by the
  scoring function (ph-1-us-11). Flashcards, which do show answers, are a separate function
  (ph-1-us-10).
- The assembled set is **persisted server-side under its `testId`** (a change from ph-1-us-4,
  which generates the ID but stores nothing). Reason: the scorer must grade only sets the server
  itself assigned to that user. If it graded arbitrary submitted question IDs, calling it would
  reveal correct answers for any question — an extraction path.

## Acceptance Criteria
- [ ] Given an authenticated caller passes a valid `chunkId` (and optional `count`), when the
  function runs, then it returns only `approved` questions from that topic, randomized, capped at
  a server-enforced maximum (proposed: 10), plus a `testId`.
- [ ] Given the response, when inspected, then questions include `id`, `text`, `choices`, `type`,
  `chunkId`, `conceptId` and omit `correctAnswer`, `sourceRef`, `selfCheck`, review metadata.
- [ ] Given the function returns a set, when it does, then the assigned question IDs are saved
  server-side under `testId` for that uid (read-only to clients).
- [ ] Given a topic with fewer approved questions than requested, then it returns what exists; a
  topic with none returns a clear `not-found`-style error.
- [ ] Given an unknown or malformed `chunkId`, then `invalid-argument`; given no auth, then
  `unauthenticated`.
- [ ] Given repeated "Review Again" calls, when selecting, then the set avoids repeating the
  previous one where the pool allows.

## Data and API
- **Cloud Function**: callable, `{ chunkId: string, count?: number }` →
  `{ testId, questions[] }`. May be a mode of `assembleTest` or a sibling function.
- **Firestore**: reads `questions` (Admin SDK); writes the server-owned assignment record.
- **Security rules**: `questions` stays deny-all; the assignment is server-owned (see the rules
  note in ph-1-us-8).

## Dependencies
- **Blocked by**: ph-1-us-4, ph-1-us-9.
- Consumed by: Phase 2 (mini-quiz UI); graded by ph-1-us-11.

## Test Notes
- **Happy path**: valid `chunkId` returns only that topic's approved questions; assignment saved.
- **Edge cases**: small pool; `count` above the cap; topic with only non-approved questions.
- **Failure modes**: bad `chunkId`; unauthenticated.

## Tasks
- [ ] Add `chunkId` to the returned question shape.
- [ ] Implement topic-scoped selection, input validation, and assignment persistence.
- [ ] Emulator tests; update `functions/README.md`.

## Questions
- Repeat avoidance for "Review Again": client passes previous question IDs, or server remembers
  the last set per user and topic?
