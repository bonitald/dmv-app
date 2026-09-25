# Scenario cards woven into the flashcard flow

**ID:** ph-2-us-5
**Layer:** Parent
**Status:** Not Started

## Story
As a teen user,
I want situational/scenario-style cards mixed naturally into my regular flashcard browsing,
visually marked so I know they're a different style of question,
So that I get comfortable reasoning through road situations, not just recalling isolated facts.

## Context
- **Product area**: Phase 2 (`docs/phases.md`)
- **Layer**: Frontend (Expo/React Native) — no Backend split. The `type` flag distinguishing
  `fact` vs. `scenario` questions already exists on the `Question` schema (ph-1-us-1) and is
  already returned by `assembleTest` (ph-1-us-4), `assembleMiniQuiz` (ph-1-us-7) and
  `getFlashcards` (ph-1-us-10).
  This story is purely about how the frontend renders that existing flag — no new backend work.
- `prd.md` Section 1 and Section 5 call this out as the app's core differentiator: scenario cards
  must be "woven into the regular flashcard flow... not siloed into a separate mode."
- The visual design already exists: the "Scenario question card" mockup (`docs/design/mockups.md`)
  has the SCENARIO badge. The badge maps to the `caption` style
  (coral) in `src/theme/tokens.ts`. The mockup's intersection diagram isn't supported: the schema
  has no image/diagram field. Leave it out for MVP.
- The scenario treatment goes on both card types: the flip flashcard (ph-2-us-3) and the quiz
  question card (ph-2-us-8, reused in Phase 3 tests). Build the badge as a small shared piece
  both use. The mockup's answer feedback states (right/wrong marking) belong to the quiz card,
  not the flashcard.

## Acceptance Criteria
- [ ] Given a topic's flashcard set contains both `fact` and `scenario` type cards, when the user
  browses that topic, then both types appear interleaved in the same draw order (subject to the
  weak-card weighting from ph-2-us-4) — never a separate "scenario mode" toggle or screen.
- [ ] Given a card's `type` is `scenario`, when it's rendered, then it's visually distinguishable
  from a `fact` card (e.g. a label/badge, distinct accent color, or layout cue) without changing
  the core interaction pattern (still reveal-answer/advance like any other card).
- [ ] Given a card's `type` is `fact`, when it's rendered, then it displays without the scenario
  visual treatment.
- [ ] Given a scenario card's text is typically longer/more narrative than a fact card's, when it
  renders, then the card layout accommodates that (no truncation or overflow) rather than
  assuming fact-card-length text throughout.

## Dependencies
- **Blocked by**: ph-1-us-1 (`type` flag already exists on the schema), ph-2-us-3 (flashcard
  viewer this renders inside of).

## Test Notes
- **Happy path**: a topic with a mix of `fact` and `scenario` cards renders each with the correct
  visual treatment as the user pages through.
- **Edge cases**: a topic that's entirely one type (no mixing to visually contrast against); a
  scenario card with unusually long text.
- **Failure modes**: a card with a missing/unexpected `type` value should fall back to the plain
  `fact` treatment rather than crashing the viewer.

## Tasks
- [ ] Apply the mockup's scenario treatment (SCENARIO badge, accent) using existing tokens only —
  no new colors/sizes outside `src/theme/tokens.ts`.
- [ ] Implement the type-aware rendering in the flashcard viewer component from ph-2-us-3.
- [ ] Verify layout handles longer scenario-card text without overflow on smaller device sizes.

## Questions
None outstanding.
