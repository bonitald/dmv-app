# `assembleTest` callable Cloud Function

**ID:** ph-1-us-4
**Layer:** Backend
**Parent:** ph-1-us-3
**Status:** Complete

## Story
As a developer,
I want a callable Cloud Function that server-side selects a bounded, mixed (fact + scenario)
question set from the approved question bank and returns it to an authenticated caller,
So that the client never needs (or is able to) query the full `questions` collection directly.

## Context
- **Product area**: Phase 1 (`docs/phases.md`), supports Phase 3's practice-test flow.
- **Layer**: Backend (Firebase Cloud Functions)
- This is the first Cloud Function in the project — until now the app has been pure BaaS
  (Firestore + Auth + Hosting + Analytics) per `CLAUDE.md`. Adding one function is a deliberate,
  narrow exception to close the bulk-extraction risk identified while planning ph-1-us-3: a
  direct Firestore query (even a rules-limited one) can't fully prevent a scripted client from
  paging through the whole collection, but a callable function that only ever returns "N
  questions for one test" can.
- Only reads `status == 'approved'` questions — `pending_review`/`flagged`/`rejected` must never
  be selectable, matching the existing app-wide rule from the ingestion spec.

## Acceptance Criteria
- [x] Given an authenticated (anonymous-auth) caller invokes `assembleTest`, when the function
  runs, then it returns a fixed-size set (count TBD — not yet decided per `prd.md` Section 9's
  open question on practice-test size) of `approved` questions mixing `fact` and `scenario`
  types, with each question's `id`, `text`, `choices`, `type`, and `conceptId` — but not
  `sourceRef`, `selfCheck`, or review metadata (no need to ship that to the client).
- [x] Given the function is called without a valid `request.auth`, when it executes, then it
  rejects with an `unauthenticated` error and returns no question content.
- [x] Given the function selects questions, when it queries Firestore internally, then it uses
  the Admin SDK (bypassing the deny-all client rule, per ph-1-us-1) — this is legitimate because
  the function itself enforces the "approved only, bounded count" constraint before returning
  data, unlike an open client query which enforces nothing.
- [x] Given repeated calls from the same user, when questions are selected, then the selection
  is randomized (not the same fixed set every time) — exact randomization strategy (weighted by
  concept, fully random, avoid repeats from a user's recent tests) is left open, see Questions.
  Implemented as a Fisher-Yates shuffle over all approved questions before slicing to `count`.

## Data and API
- **Cloud Function**: `assembleTest` (callable, `functions.https.onCall`).
- **Input**: none required for MVP (no test-type parameter yet — Phase 3 may add
  timed/untimed or topic-filter params later).
- **Output**: `{ testId: string, questions: Array<{ id, text, choices, type, conceptId }> }`.
  `testId` is a locally-generated identifier for this assembled set, used by the frontend cache
  (ph-1-us-5) as its storage key — it does not need to correspond to a persisted `Test Attempt`
  document until Phase 3 builds that.
- **Firestore reads**: `questions` where `status == 'approved'`, via Admin SDK, no security-rule
  changes needed (Admin SDK bypasses rules).
- **Security rules**: unchanged — see ph-1-us-1.

## Dependencies
- **Blocked by**: ph-1-us-1 (schema).
- **Parent**: ph-1-us-3 — this is the backend half of "cache only what one test needs."

## Test Notes
- **Happy path**: unauthenticated-emulator test calling `assembleTest` as a signed-in test user
  returns N questions, all `status: 'approved'` in the underlying data, no `flagged`/
  `pending_review` docs included.
- **Edge cases**: fewer than N approved questions exist in a given topic/overall (should not
  crash — return whatever's available, or a clear error if the bank is empty).
- **Failure modes**: unauthenticated call is rejected; Firestore read failure surfaces as an
  `internal` callable error, not a partial/malformed question list.

## Tasks
- [x] Set up Cloud Functions in this project (none exist yet — add `functions/` per Firebase's
  standard layout, wire into `firebase.json`).
- [x] Implement `assembleTest` per the Data and API section above.
- [x] Write emulator-based tests (Firebase Functions + Firestore emulators) covering the
  Acceptance Criteria. (Tests the testable core, `assembleTestForUser`, directly against the
  Firestore emulator via `firebase-admin` — doesn't need the Functions emulator or
  `httpsCallable`, since the `onCall` wrapper is a thin pass-through.)
- [x] Document the function's contract in a README (mirroring `scripts/question-bank/README.md`'s
  style) so the frontend child (ph-1-us-5) and later Phase 3 work can integrate against it.

## Follow-ups (2026-09-20)
This story stays Complete as the general practice-test function. The journey changes add work in
new stories rather than reopening it: mini-quiz sets (ph-1-us-7), the fixed baseline (ph-1-us-8),
the topic list (ph-1-us-9), flashcards with answers (ph-1-us-10), and scoring (ph-1-us-11).
Two small changes to this function are needed, tracked under those stories:
- Add `chunkId` to the returned question shape.
- **Persist the assigned question IDs under `testId`** (it currently generates the ID and stores
  nothing), so `scoreTest` can grade only sets the server assigned. This gives the function its
  first write, and updates the "Writes: none" line in its doc comment.
The function intentionally returns no `correctAnswer`; grading happens in `scoreTest`.

## Questions
- Exact question count per assembled test is undefined (`prd.md` Section 9) — implemented as
  `DEFAULT_QUESTION_COUNT = 25` in `functions/src/assembleTest.ts`, easy to change in one place.
- Randomization/repeat-avoidance strategy across a user's multiple tests is unresolved — shipped
  the simplest MVP behavior (fully random each call, repeats allowed); revisit if it makes
  practice feel repetitive.
