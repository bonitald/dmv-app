# Add/update questions without an app release

**ID:** ph-1-us-2
**Layer:** Backend
**Status:** Complete (satisfied by existing architecture)

## Story
As a content author,
I want to add or update questions in Firestore without shipping an app release,
So that the question bank can grow and be corrected after launch.

## Context
- **Product area**: Phase 1 (`docs/phases.md`)
- **Layer**: Backend (Firebase/Firestore as CMS)
- This is already true by construction: the app has no hardcoded question content in `src/`,
  and all question content lives in Firestore's `questions` collection, editable via the Firebase
  console (for review/correction, per the ingestion spec's "Self-check + human review workflow")
  or via the `scripts/question-bank/` CLI tooling (for bulk writes). Neither path requires a new
  app build.

## Acceptance Criteria
- [x] Given a question document in Firestore, when a content author edits a field (e.g. fixes a
  typo, changes `status` from `flagged` to `approved`) via the Firebase console, then the change
  is live for the app on next fetch — no app store release involved.
- [x] Given the app's source tree, when searched for hardcoded question/answer text, then none is
  found (all content is Firestore-sourced).

## Dependencies
- **Blocked by**: none.

## Tasks
None — this story documents an already-satisfied constraint rather than introducing new work.

## Questions
None outstanding.
