# Firestore schema for Question content

**ID:** ph-1-us-1
**Layer:** Backend
**Status:** Mostly Complete (schema exists and is populated; client-read rule still needed)

## Story
As a developer,
I want a Firestore schema for `Question` (text, choices, correct answer, topic/category, source
reference, and a fact-vs-scenario type flag),
So that the app has a well-defined content model matching `docs/prd.md` Section 7's data
entities.

## Context
- **Product area**: Phase 1 (`docs/phases.md`)
- **Layer**: Backend (Firebase/Firestore)
- The schema already exists and is populated: it was defined and implemented by the
  question-bank ingestion pipeline (`docs/superpowers/specs/2026-09-08-question-bank-ingestion-design.md`,
  types in `scripts/question-bank/lib/types.ts`). A real ingestion run has already written 1,415
  `questions/{id}` docs across 499 concepts (`docs/dmv-reference/concept-list.md`), currently a mix
  of `approved` / `pending_review` / `flagged`.
- What this story adds on top of the existing schema: closing the **client read path**. Today
  `firestore.rules` denies all access to `questions` outside `users/{uid}` — correct for the
  ingestion pipeline (which uses the Admin SDK and bypasses rules entirely) but it also means the
  app itself cannot read `questions` yet. Per the extraction-risk decision made for ph-1-us-3/4,
  the fix is **not** to open a direct client query on `questions` — it stays deny-all for direct
  reads. All client access instead goes through the `assembleTest` callable Cloud Function
  (ph-1-us-4), which runs with Admin privileges server-side and returns only a scoped subset.

## Acceptance Criteria
- [ ] Given the existing `questions/{id}` schema (conceptId, chunkId, sourceRef, type, text,
  choices, correctAnswer, status, selfCheck, reviewedBy, reviewedAt, reviewNotes, createdAt),
  when a new question is written by the ingestion pipeline, then it validates against
  `scripts/question-bank/lib/validate.ts` before being persisted (already true — no change
  needed here).
- [ ] Given `firestore.rules` today, when any authenticated client attempts a direct read of
  `questions/{id}` or a query against the `questions` collection, then the request is denied
  (already true — verify it stays true; do not add a direct client-read rule for `questions`).
- [ ] Given the `assembleTest` Cloud Function (ph-1-us-4) is deployed, when it reads `questions`
  internally via the Admin SDK, then it succeeds regardless of the deny-all client rule (Admin
  SDK bypasses security rules by design).

## Data and API
- **Firestore schema**: no changes — `questions/{id}` and `ingestionRuns/{id}` as defined in
  `docs/superpowers/specs/2026-09-08-question-bank-ingestion-design.md`.
- **Security rules**: no changes to `firestore.rules` — confirm the existing deny-all baseline
  covers `questions`/`ingestionRuns` (it does, per the comment at the bottom of the file) and
  leave it that way. This is a "prove the negative" acceptance criterion, not new rule-writing.

## Dependencies
- **Blocked by**: none — schema and data already exist.
- Related: ph-1-us-4 (Cloud Function is the only sanctioned read path for this schema).

## Test Notes
- **Happy path**: existing `firestore-tests/rules.test.ts` suite (or an addition to it) asserts
  a signed-in anonymous client `get()`/`list()` on `questions` fails.
- **Edge cases**: a client attempting a collection-group query or a query scoped to a single
  `conceptId`/`status` should also be denied — the rule is collection-level, not query-shape
  dependent, so this should already hold.
- **Failure modes**: none new — this story is verification, not new code.

## Tasks
- [ ] Add a test to `firestore-tests/rules.test.ts` asserting direct client reads of `questions`
  and `ingestionRuns` are denied (locks in the deny-all-by-default guarantee so a future change
  can't silently reopen it).

## Questions
None outstanding.
