# Browse flashcards organized by topic

**ID:** ph-2-us-1
**Layer:** Parent
**Children:** ph-2-us-2 (Backend), ph-2-us-3 (Frontend)
**Status:** Not Started

## Story
As a teen user,
I want to browse flashcards grouped by topic,
So that I can study the parts of the CO DMV handbook I'm weakest on, or work through the
content systematically, rather than seeing an unordered pile of cards.

## Context
- **Product area**: Phase 2 (`docs/phases.md`)
- **Layer**: cross-cutting (Backend Cloud Function + Frontend browse UI)
- `prd.md` Section 5 lists "Flashcard study mode" as a Must-have: "Browseable flashcards built
  from CO handbook content, organized by topic."
- This directly collides with a decision already made in Phase 1: `ph-1-us-1` closed off all
  direct client reads/queries of the `questions` collection (deny-all in `firestore.rules`) to
  prevent bulk extraction of the question bank, and `ph-1-us-3`'s summary explicitly notes
  "General flashcard-mode (Phase 2) offline caching is explicitly out of scope for this phase —
  revisit if/when Phase 2 needs it." This phase is that revisit. Flashcard browsing needs
  broader, by-topic access to the bank than a single scoped test does, so it can't reuse
  `assembleTest` (ph-1-us-4) as-is — see ph-2-us-2 for how this is resolved.

## Acceptance Criteria
- [ ] Given the question bank has multiple topics/categories, when a teen user opens flashcard
  study mode, then they see a list of topics to choose from.
- [ ] Given a teen user selects a topic, when the flashcard set for that topic loads, then cards
  are presented one at a time in a swipe/tap-through flashcard UI.
- [ ] Given no direct Firestore client read/query path to `questions` exists (per ph-1-us-1),
  when flashcard content is fetched for browsing, then it goes through a server-side callable
  function (ph-2-us-2), not a direct collection read — consistent with the Phase 1 extraction
  decision.

## Dependencies
- **Blocked by**: ph-1-us-1 (Question schema + deny-all rule), ph-2-us-2, ph-2-us-3.
- Related: ph-2-us-4 (resurfacing ordering), ph-2-us-5 (scenario cards woven in), ph-2-us-6
  (local performance tracking) all build on top of this browse flow.

## Notes
No separate Tasks/Test Notes here — see child stories ph-2-us-2 and ph-2-us-3.
