# Phase 1: Question Bank & Content Model — Summary

## Status: Complete (2026-09-23)

Most of this phase's schema/content work was already delivered by the question-bank ingestion
pipeline (`docs/superpowers/specs/2026-09-08-question-bank-ingestion-design.md`), which has run
against the CO DMV handbook and produced 1,415 questions across 499 concepts
(`docs/dmv-reference/concept-list.md`). The rest of the phase built the server-side read/score paths (no direct bulk-read of the
question bank), the topic catalog, the fixed baseline, and the on-device test cache module.

**Carried to Phase 3:** the remaining criteria of ph-1-us-3 and ph-1-us-5 describe how the
test-taking screen uses `src/study/testCache.ts`. They moved to **ph-3-us-1**
(`docs/phases/phase-3-practice-test-generator-and-test-taking-ui/`) so this phase could close.

## Stories

| ID | Title | Layer | Parent | Status |
|----|-------|-------|--------|--------|
| ph-1-us-1 | Firestore schema for Question content | Backend | — | Complete |
| ph-1-us-2 | Add/update questions without an app release | Backend | — | Complete |
| ph-1-us-3 | Scoped offline caching for an in-progress test | Parent | — | Complete (rest → ph-3-us-1) |
| ph-1-us-4 | `assembleTest` callable Cloud Function | Backend | ph-1-us-3 | Complete |
| ph-1-us-5 | On-device cache for the active test's question set | Frontend | ph-1-us-3 | Complete (rest → ph-3-us-1) |
| ph-1-us-6 | Paraphrased content with traceable source reference | Backend | — | Complete |
| ph-1-us-7 | Topic-scoped mini-quiz assembly | Backend | — | Complete |
| ph-1-us-8 | Fixed baseline diagnostic (sectioned, resumable, doubles as free test) | Backend | — | Complete |
| ph-1-us-9 | Topic catalog for the learning path | Backend | — | Complete |
| ph-1-us-10 | Flashcard delivery for a topic (with answers, unscored) | Backend | — | Complete |
| ph-1-us-11 | Score a test, mini-quiz, or baseline section | Backend | — | Complete |

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

- ~~**`firestore.rules`** wildcard under `users/{uid}/**`~~ — resolved: narrowed to explicit
  paths; attempts, assignments and baseline progress are client-read-only (2026-09-23).
- Reinstalling creates a new anonymous uid, so the baseline/free test can be retaken; linking a
  real account (Phase 9) is what closes it later.
- Mini-quiz recommendation threshold and flashcard rate limit are implemented as tunable
  constants (80%; 30 calls / 10 min) but still unvalidated product values.
- ~~Whether Concept Progress status is updated by `scoreTest` or stays a client action
  (ph-1-us-11).~~ — resolved in Phase 2: `scoreTest` writes the score, the client writes status
  (ph-2-us-10/11, 2026-09-23).
- ~~Exact per-test question count (`prd.md` Section 9) — ph-1-us-4.~~ — resolved 2026-09-23:
  25, matching the real CO test (25 questions, 60 minutes, 20 correct to pass).
- Resume-vs-clear UX for a stale cached test after a force-quit — now owned by ph-3-us-1.
- Randomization/repeat-avoidance strategy across a user's multiple tests — flagged in ph-1-us-4,
  simplest behavior acceptable to start.
