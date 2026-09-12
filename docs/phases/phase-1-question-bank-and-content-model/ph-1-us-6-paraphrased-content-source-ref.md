# Paraphrased content with traceable source reference

**ID:** ph-1-us-6
**Layer:** Backend
**Status:** Complete (engineering scope); content review ongoing outside this doc set

## Story
As a product owner,
I want the initial question bank paraphrased/generated from the CO DMV handbook (never copied
verbatim) with each question traceable back to its handbook section,
So that the app is legally compliant with `prd.md` Section 8's reuse restriction and every
question's provenance can be audited.

## Context
- **Product area**: Phase 1 (`docs/phases.md`)
- **Layer**: Backend (content pipeline, not app runtime code)
- Fully satisfied at the engineering level: the ingestion pipeline
  (`docs/superpowers/specs/2026-09-08-question-bank-ingestion-design.md`) requires every
  generated question to be paraphrased and to carry a `sourceRef` field (enforced by
  `validateQuestions()` in `scripts/question-bank/lib/validate.ts`), and a full run against
  `docs/dmv-reference/DR_2337_Jan2025.pdf` has already produced 1,415 questions across 499
  concepts and 45 chunks (`docs/dmv-reference/concept-list.md`).
- Per this phase's planning conversation, tracking the remaining human review of
  `pending_review`/`flagged` questions is explicitly kept **outside** this phase's story docs
  (it's a content-review task, not code) — not duplicated here as a story.

## Acceptance Criteria
- [x] Given any question in the `questions` collection, when its `sourceRef` field is inspected,
  then it points to a specific handbook page/section.
- [x] Given the ingestion pipeline's validation, when a question payload is missing `sourceRef`
  or reuses handbook text verbatim (caught by the self-check pass, not automated validation),
  then it's rejected/flagged before being marked `approved`.

## Dependencies
- **Blocked by**: none — already built and run.

## Tasks
None — this story documents an already-satisfied requirement. Human review of the remaining
`pending_review`/`flagged` questions is tracked outside `docs/phases/`.

## Questions
None outstanding for engineering scope.
