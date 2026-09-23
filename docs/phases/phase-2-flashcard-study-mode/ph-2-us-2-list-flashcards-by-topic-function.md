# `listFlashcardsByTopic` callable Cloud Function

**ID:** ph-2-us-2
**Layer:** Backend
**Parent:** ph-2-us-1
**Status:** Not Started

## Story
As a developer,
I want a callable Cloud Function that server-side returns a paginated set of approved
flashcards for one topic,
So that the flashcard browse UI can list an entire topic's cards without the client ever
running a direct query against the `questions` collection.

## Context
- **Product area**: Phase 2 (`docs/phases.md`), extends the Phase 1 extraction-prevention
  decision to a second read path.
- **Layer**: Backend (Firebase Cloud Functions)
- Mirrors `assembleTest` (ph-1-us-4) — the second Cloud Function in the project, kept as a
  deliberate exception to the pure-BaaS architecture per `CLAUDE.md`, for the same reason:
  `firestore.rules` stays deny-all on `questions` (ph-1-us-1), so this is the only sanctioned
  read path for flashcard browsing.
- Only reads `status == 'approved'` questions, same rule as `assembleTest`.
- Reuses the existing `Question` schema (`conceptId`, `chunkId`, `sourceRef`, `type`, `text`,
  `choices`, `correctAnswer`, `status`) from ph-1-us-1 — no new content type. `prd.md` Section 7
  leaves open whether `Flashcard` is a separate entity or maps 1:1 to `Question`; this function
  treats it as a 1:1 mapping (simplest option, no new schema needed for MVP).

## Acceptance Criteria
- [ ] Given an authenticated (anonymous-auth) caller invokes `listFlashcardsByTopic` with a
  `topic`/`conceptId`-grouping key and no cursor, when the function runs, then it returns the
  first page of `approved` questions for that topic (id, text, choices, correctAnswer, type,
  conceptId — sourceRef and review metadata withheld, same withholding as `assembleTest`) plus a
  cursor for the next page.
- [ ] Given a caller passes a cursor from a previous response, when the function runs, then it
  returns the next page for that same topic, not a re-randomized/overlapping set.
- [ ] Given the function is called without a valid `request.auth`, when it executes, then it
  rejects with an `unauthenticated` error and returns no content.
- [ ] Given a caller pages all the way through a single topic's full card set, when the last
  page is returned, then no further cursor is provided (client knows to stop).
- [ ] Given `questions` stays deny-all in `firestore.rules` (ph-1-us-1), when this function reads
  internally, then it uses the Admin SDK, consistent with `assembleTest`.

## Data and API
- **Cloud Function**: `listFlashcardsByTopic` (callable, `functions.https.onCall`).
- **Input**: `{ topic: string, cursor?: string, pageSize?: number }`.
- **Output**: `{ questions: Array<{ id, text, choices, correctAnswer, type, conceptId }>,
  nextCursor: string | null }`.
- **Firestore reads**: `questions` where `status == 'approved' AND conceptId/topic == input`,
  paginated via Admin SDK, ordered by a stable field (e.g. `conceptId` then `id`) so pagination
  is deterministic.
- **Security rules**: unchanged — `questions` stays deny-all for direct client reads.
- **Also needed**: a `listTopics` (or equivalent) callable/read path so the frontend can populate
  the topic-selection screen (ph-2-us-3) without a direct query either — can be folded into this
  same function (e.g. called with no `topic` returns distinct topics) or a small sibling
  function; implementer's choice, but it must not bypass the deny-all rule either.

## Dependencies
- **Blocked by**: ph-1-us-1 (schema + deny-all rule), ph-1-us-4 (establishes the callable-function
  pattern this reuses).
- **Parent**: ph-2-us-1 — this is the backend half of "browse flashcards by topic."

## Test Notes
- **Happy path**: emulator test calling `listFlashcardsByTopic` for a topic with N approved
  questions returns all N across however many pages, no duplicates, no `flagged`/
  `pending_review` docs included.
- **Edge cases**: a topic with zero approved questions returns an empty array and `nextCursor:
  null`, not an error; a stale/invalid cursor is rejected with a clear error rather than
  returning garbage or crashing.
- **Failure modes**: unauthenticated call is rejected; a Firestore read failure surfaces as an
  `internal` callable error.

## Tasks
- [ ] Implement `listFlashcardsByTopic` in the existing `functions/` project (set up by
  ph-1-us-4) per the Data and API section above.
- [ ] Implement the topic-listing read path (folded in or as a sibling function).
- [ ] Write emulator-based tests covering the Acceptance Criteria, including pagination
  determinism and the deny-all-stays-in-place check.
- [ ] Document the function's contract alongside `assembleTest`'s README so the frontend child
  (ph-2-us-3) can integrate against it.

## Questions
- Whether flashcard browsing should eventually reuse `assembleTest`'s bounded-count model
  (e.g. capped pages, rate-limited paging) to further reduce the residual bulk-extraction
  surface of "page through every topic" is an open product/security tradeoff — flagging it
  rather than deciding unilaterally, since full-topic browsing is the explicit Phase 2
  requirement (`prd.md` Section 5) and some tension with the Phase 1 extraction concern is
  inherent to that requirement.
- Whether `Flashcard` should become its own Firestore entity distinct from `Question` (per
  `prd.md` Section 7's open option) is deferred — 1:1 mapping is assumed for MVP.
