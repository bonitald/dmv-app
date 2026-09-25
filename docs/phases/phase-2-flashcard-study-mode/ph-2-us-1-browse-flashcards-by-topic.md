# Browse flashcards organized by topic

**ID:** ph-2-us-1
**Layer:** Parent
**Children:** ph-2-us-2 (Backend, superseded by ph-1-us-9/10), ph-2-us-3 (Frontend)
**Status:** Not Started

## Story
As a teen user,
I want to browse flashcards grouped by topic,
So that I can study the parts of the CO DMV handbook I'm weakest on, or work through the
content systematically, rather than seeing an unordered pile of cards.

## Context
- **Product area**: Phase 2 (`docs/phases.md`)
- **Layer**: cross-cutting. The backend already exists from Phase 1; the remaining work is
  frontend.
- `prd.md` Section 5 lists "Flashcard study mode" as a Must-have: "Browseable flashcards built
  from CO handbook content, organized by topic."
- A "topic" is a handbook chunk (`chunkId`, 45 of them, in PDF order). The concept learning path
  (ph-2-us-7) calls the same thing a "concept". The topic list the user picks from is the
  concept list screen (ph-2-us-7), so this story doesn't build a second list.
- `questions` stays deny-all for clients (ph-1-us-1). Cards come only from the `getFlashcards`
  callable (ph-1-us-10).

## Acceptance Criteria
- [ ] Given the question bank has multiple topics, when a teen user opens the Study tab, then
  they see the topics to choose from (the concept list, ph-2-us-7).
- [ ] Given a teen user selects a topic, when its cards load, then they are shown one at a time
  in a flashcard viewer (ph-2-us-3).
- [ ] Given no direct client read path to `questions` exists (ph-1-us-1), when flashcard content
  is fetched, then it goes through `getFlashcards` (ph-1-us-10), never a collection read.

## Dependencies
- **Blocked by**: ph-1-us-9 and ph-1-us-10 (both Complete).
- **Children**: ph-2-us-2 (superseded, delivered by Phase 1), ph-2-us-3 (flashcard viewer).
- Related: ph-2-us-4 (resurfacing order), ph-2-us-5 (scenario cards), ph-2-us-6 (local
  performance tracking) all build on the viewer; ph-2-us-7 provides the topic list.

## Notes
No separate Tasks/Test Notes here — see child story ph-2-us-3.
