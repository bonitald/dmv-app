# Topic catalog for the learning path

**ID:** ph-1-us-9
**Layer:** Backend
**Status:** Complete

## Story
As a teen user,
I want to see the handbook's topics in the same order as the PDF, with a title and short
description for each,
So that I can follow the learning path or jump to any topic.

## Context
- **Product area**: Phase 1 (`docs/phases.md`), consumed by Phase 2 (concept list screen).
- **Layer**: Backend (Firestore + a small population script)
- The 45 topics already exist as `chunkId` / `title` / `description` / `pageStart` / `pageEnd` in
  the ingestion run's chunk plan, but that lives in `ingestionRuns`, which clients cannot read.
  The app needs its own readable list that holds **no question content**, so it can be readable
  by signed-in clients without reopening the extraction risk.
- Order comes from `pageStart` (handbook PDF order), per the "organize by the PDF layout" decision.

## Acceptance Criteria
- [x] Given the ingestion chunk plan, when the catalog is populated, then a `topics/{chunkId}`
  doc exists for each chunk with `title`, `description`, `order` (from `pageStart`), and
  `approvedQuestionCount`.
- [x] Given a signed-in client, when it reads `topics`, then it succeeds; given any client, when
  it tries to write `topics`, then it is denied.
- [x] Given `topics` docs, when inspected, then none contains question text, choices, answers, or
  `sourceRef`.
- [x] Given questions are approved or rejected later, when the catalog is refreshed by re-running
  the script, then `approvedQuestionCount` reflects the change (no manual editing).

## Data and API
- **Firestore**: new `topics/{chunkId}` collection.
- **Security rules**: authenticated read, no client write — a deliberate, narrow exception to the
  deny-all baseline; add `rules.test.ts` cases both ways.
- **Script**: extend `scripts/question-bank/` with a `publish-topics` step (Admin SDK).

## Dependencies
- **Blocked by**: none (data exists).
- Consumed by: ph-1-us-7, ph-1-us-8, Phase 2.

## Test Notes
- **Happy path**: script writes 45 docs in PDF order; client read succeeds.
- **Edge cases**: a topic with zero approved questions (show but flag in count); re-running is
  idempotent.
- **Failure modes**: client write denied; unauthenticated read denied.

## Tasks
- [x] Add the `publish-topics` script.
- [x] Add the rule and its tests.
- [x] Document the collection in the question-bank README.

## Questions
- Should very small or empty topics be hidden from the learning path until they have enough
  approved questions for a mini-quiz?
