# Flashcard delivery for a topic

**ID:** ph-1-us-10
**Layer:** Backend
**Status:** Complete

## Story
As a teen user studying one handbook topic,
I want that topic's flashcards, questions with their answers,
So that I can learn the material before quizzing myself.

## Context
- **Product area**: Phase 1 (`docs/phases.md`), consumed by Phase 2's flashcard mode.
- **Layer**: Backend (Firebase Cloud Functions)
- A separate callable from `assembleTest`, because flashcards show the answer and are not scored
  — no `testId`, no assignment record, no attempt. Answer-bearing delivery is deliberately kept out
  of the test path.
- Accepted tradeoff: this path returns answers for a whole topic, so walking all 45 topics
  gathers the full bank over time. The function slows bulk extraction (auth required, one topic
  per call, per-user rate limit) but can't stop it. Accepted for the MVP learning path.

## Acceptance Criteria
- [x] Given an authenticated caller passes a valid `chunkId`, when the function runs, then it
  returns that topic's `approved` questions in random order, each with `id`, `text`, `choices`,
  `correctAnswer`, `type`, `chunkId`, `conceptId`.
- [x] Given the response, when inspected, then `sourceRef`, `selfCheck`, and review metadata are
  omitted.
- [x] Given a call, when it runs, then nothing is scored or recorded as a test attempt.
- [x] Given an unknown `chunkId` → `invalid-argument`; no auth → `unauthenticated`; topic with no
  approved questions → clear `not-found`-style error.
  - _Note (2026-09-23):_ Actual behavior: a malformed `chunkId` returns `invalid-argument`; a well-formed but unknown one returns `not-found` (indistinguishable from an empty topic). Rate limit: 30 calls / 10 min per user — a starting value.
- [x] Given a user calls the function repeatedly in a short window, when a proposed per-user
  limit is exceeded, then it rejects (`resource-exhausted`).

## Data and API
- **Cloud Function**: callable `getFlashcards({ chunkId })` → `{ chunkId, cards[] }`.
- **Firestore**: reads `questions` via Admin SDK; may write a small per-user rate-limit counter.
- **Security rules**: unchanged.

## Dependencies
- **Blocked by**: ph-1-us-9 (valid topic IDs).
- Consumed by: Phase 2 (flashcard UI, weak-card logic). Client-side offline caching of flashcards
  is a Phase 2 decision (previously out of scope for ph-1-us-3).

## Test Notes
- **Happy path**: returns only the requested topic's approved cards, answers present.
- **Edge cases**: empty topic; repeated calls (randomization differs); rate limit tripped.
- **Failure modes**: bad `chunkId`; unauthenticated.

## Tasks
- [x] Implement `getFlashcards` with validation and rate limit.
- [x] Emulator tests; document the contract in `functions/README.md`.

## Questions
- Per-user rate limit value, and whether a topic's cards should return whole or paged.
