# Phase 1: Question Bank & Content Model — Summary

## Status: Not Started (2 of 4 checklist items already satisfied by prior work)

Most of this phase's schema/content work was already delivered by the question-bank ingestion
pipeline (`docs/superpowers/specs/2026-09-08-question-bank-ingestion-design.md`), which has run
against the CO DMV handbook and produced 1,415 questions across 499 concepts
(`docs/dmv-reference/concept-list.md`). What remains is closing the client read path safely
(no direct bulk-read of the question bank) and building the scoped, per-test offline cache.

## Stories

| ID | Title | Layer | Parent | Status |
|----|-------|-------|--------|--------|
| ph-1-us-1 | Firestore schema for Question content | Backend | — | Complete |
| ph-1-us-2 | Add/update questions without an app release | Backend | — | Complete |
| ph-1-us-3 | Scoped offline caching for an in-progress test | Parent | — | Not Started |
| ph-1-us-4 | `assembleTest` callable Cloud Function | Backend | ph-1-us-3 | Complete |
| ph-1-us-5 | On-device cache for the active test's question set | Frontend | ph-1-us-3 | Not Started |
| ph-1-us-6 | Paraphrased content with traceable source reference | Backend | — | Complete |
| ph-1-us-7 | Topic-scoped mini-quiz assembly | Backend | — | Not Started |
| ph-1-us-8 | Fixed baseline diagnostic (sectioned, resumable, doubles as free test) | Backend | — | Not Started |
| ph-1-us-9 | Topic catalog for the learning path | Backend | — | Not Started |
| ph-1-us-10 | Flashcard delivery for a topic (with answers, unscored) | Backend | — | Not Started |
| ph-1-us-11 | Score a test, mini-quiz, or baseline section | Backend | — | Not Started |

## Key decisions made during planning

- **No direct client reads of `questions`** — `firestore.rules` stays deny-all for that
  collection. The only sanctioned read path is the new `assembleTest` Cloud Function, which
  returns a bounded, randomized set for one test rather than exposing the full bank to any query.
- **Offline caching is scoped to one in-progress test**, not the whole question bank or Phase 2's
  flashcard mode — this was a deliberate narrowing of the original `docs/phases.md` wording,
  made to prevent bulk extraction of question content. `docs/phases.md` Phase 1's third bullet
  was updated to reflect this.
- **First Cloud Function in the project** — a deliberate, narrow exception to the otherwise
  pure-BaaS architecture (`CLAUDE.md`), justified specifically by the extraction-prevention need.
- Human review of the ~900 `pending_review`/`flagged` questions from the ingestion run is tracked
  outside this doc set (content task, not engineering) — not a ph-1 story.

- **Journey changes (2026-09-20)** added ph-1-us-7 to 11 and widened ph-1-us-3. The learning
  path's "concept" is a handbook **topic** (`chunkId`, 45, PDF order); `conceptId` (499) is finer
  sub-concepts within a topic. Decided:
  - Three kinds of server function: **assemble** (questions + choices, no answers, persisted
    under a `testId`), **score** (the only place answers are compared; writes results), and
    **flashcards** (topic questions with answers, unscored).
  - **The baseline is one fixed set of 45 questions for every user**, 3 sections × 15, and
    completing it records the user's "free test" (`freeTestUsedAt`) for the future subscription.
    Nothing is gated in MVP.
  - Baseline results show got it / missed it per topic; "shaky" appears once mini-quiz scores
    exist.
  - Topic-by-topic flashcards can be walked to collect the bank over time; accepted for the
    MVP learning path, slowed by auth, one topic per call and a per-user rate limit.

## Open items carried into implementation

- **`firestore.rules`**: the `users/{uid}/**` wildcard lets clients write everything under their
  uid, and rules are OR'd, so it must be narrowed to explicit client-writable paths, with
  attempts, baseline progress, and `freeTestUsedAt` read-only (ph-1-us-8).
- Reinstalling creates a new anonymous uid, so the baseline/free test can be retaken; linking a
  real account (Phase 9) is what closes it later.
- Mini-quiz recommendation threshold value (proposed 80%) and the per-user flashcard rate limit.
- Whether Concept Progress status is updated by `scoreTest` or stays a client action
  (ph-1-us-11).
- Exact per-test question count (`prd.md` Section 9, still undefined) — ph-1-us-4.
- Resume-vs-clear UX for a stale cached test after a force-quit — deferred to Phase 3, flagged in
  ph-1-us-5.
- Randomization/repeat-avoidance strategy across a user's multiple tests — flagged in ph-1-us-4,
  simplest behavior acceptable to start.
