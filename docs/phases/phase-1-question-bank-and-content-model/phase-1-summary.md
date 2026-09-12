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
| ph-1-us-1 | Firestore schema for Question content | Backend | — | Mostly Complete |
| ph-1-us-2 | Add/update questions without an app release | Backend | — | Complete |
| ph-1-us-3 | Scoped offline caching for an in-progress test | Parent | — | Not Started |
| ph-1-us-4 | `assembleTest` callable Cloud Function | Backend | ph-1-us-3 | Not Started |
| ph-1-us-5 | On-device cache for the active test's question set | Frontend | ph-1-us-3 | Not Started |
| ph-1-us-6 | Paraphrased content with traceable source reference | Backend | — | Complete |

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

## Open items carried into implementation

- Exact per-test question count (`prd.md` Section 9, still undefined) — ph-1-us-4.
- Resume-vs-clear UX for a stale cached test after a force-quit — deferred to Phase 3, flagged in
  ph-1-us-5.
- Randomization/repeat-avoidance strategy across a user's multiple tests — flagged in ph-1-us-4,
  simplest behavior acceptable to start.
