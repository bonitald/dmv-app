# `listFlashcardsByTopic` callable Cloud Function

**ID:** ph-2-us-2
**Layer:** Backend
**Parent:** ph-2-us-1
**Status:** Superseded by ph-1-us-9 and ph-1-us-10 (2026-09-23)

## Story
As a developer,
I want a server-side read path that returns one topic's approved flashcards,
So that the flashcard UI can show a whole topic without the client querying the `questions`
collection directly.

## Why this is superseded
This story was written before the Phase 1 journey changes (2026-09-20). Those changes added two
Phase 1 stories that already deliver its backend, so no new function is needed:

- **ph-1-us-10 — `getFlashcards({ chunkId })`** (`functions/src/getFlashcards.ts`, contract in
  `functions/README.md`). Returns every `approved` question in one topic, shuffled, with
  `id`, `text`, `choices`, `correctAnswer`, `type`, `chunkId`, `conceptId`. Omits `sourceRef`,
  `selfCheck` and review metadata. Admin SDK read; `questions` stays deny-all.
- **ph-1-us-9 — `topics/{chunkId}` collection.** Readable by any signed-in client, holds no
  question content (`title`, `description`, `order`, `approvedQuestionCount`). This is the
  topic-listing read path, so no `listTopics` function is needed.

## How the original criteria map to what was built

| Original criterion | Outcome |
|---|---|
| Authenticated caller gets a topic's approved cards, sourceRef/review metadata withheld | Met by `getFlashcards` |
| Unauthenticated call rejected with `unauthenticated` | Met by `getFlashcards` |
| Admin SDK read, `questions` stays deny-all | Met; covered by rules tests |
| Topic-listing path that doesn't bypass deny-all | Met by the `topics` collection |
| Paginated with a cursor; last page has no cursor | **Dropped.** A topic returns whole (about 30 approved cards at most), so paging isn't needed |
| Grouped by `topic`/`conceptId` | **Changed.** Grouped by `chunkId` (45 handbook topics). `conceptId` (499) is a finer sub-concept, too small to study on its own |
| Empty topic returns `[]` + `nextCursor: null` | **Changed.** Returns a `not-found` error, which the UI (ph-2-us-3) treats as "nothing here yet" |

What `getFlashcards` adds beyond the original story: a per-user rate limit (30 calls / 10 min,
`resource-exhausted` when exceeded). The frontend has to handle it (ph-2-us-3).

## Dependencies
- **Parent**: ph-2-us-1 — the backend half of "browse flashcards by topic", now delivered by
  Phase 1.

## Questions
- The open bulk-extraction tradeoff this story flagged was accepted in Phase 1 (ph-1-us-10
  Context): auth, one topic per call and the rate limit slow scraping but don't prevent it.
- `Flashcard` stays a 1:1 mapping to `Question` for MVP (`prd.md` Section 7).
