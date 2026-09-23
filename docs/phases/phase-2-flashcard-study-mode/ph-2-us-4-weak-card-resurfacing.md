# Weak/missed cards resurface more often

**ID:** ph-2-us-4
**Layer:** Parent
**Status:** Not Started

## Story
As a teen user,
I want flashcards I've missed or marked as weak to come up more often than ones I already know
well,
So that my study time concentrates on what I actually need to learn, without needing to run a
full spaced-repetition system.

## Context
- **Product area**: Phase 2 (`docs/phases.md`)
- **Layer**: Frontend (Expo/React Native) — no Backend split. This story is pure client-side
  ordering logic over locally tracked performance data; it needs no Firestore/Cloud Function
  changes of its own, so it stays a single story rather than being forced into a Backend/Frontend
  pair (per the skill's guidance not to manufacture a hollow child).
- `prd.md` Section 5 and Section 2 (Success Metrics context) both describe this as "a lightweight
  spaced-repetition-style ordering, not a fixed browse order or a full SRS algorithm" — explicitly
  not SM-2/Anki-style scheduling. Keep the algorithm simple (e.g. weighted random draw favoring
  higher miss-rate/lower-confidence cards) rather than building interval-based scheduling.

## Acceptance Criteria
- [ ] Given a teen user has missed or marked weak some cards in a topic (tracked by ph-2-us-6),
  when they browse that topic again, then those cards appear more frequently in the draw order
  than cards they've consistently gotten right.
- [ ] Given a card has never been seen before, when the ordering logic runs, then it's treated as
  neutral priority (neither boosted nor suppressed) — a lack of data is not the same as "known
  well."
- [ ] Given a teen user answers a card correctly several times in a row, when the ordering logic
  runs again, then that card's resurfacing frequency decreases (it doesn't stay permanently
  "weak" after being learned).
- [ ] Given this is explicitly not a full SRS, when the ordering runs, then it does not schedule
  cards for specific future dates/intervals — it only weights the current session's/topic's draw
  order.

## Dependencies
- **Blocked by**: ph-2-us-1 (browse flow to plug into), ph-2-us-6 (local per-card performance
  data this logic reads from).

## Test Notes
- **Happy path**: a card missed 3 times in a row is drawn noticeably more often than a card
  answered correctly 3 times in a row, within the same topic session.
- **Edge cases**: a topic where every card has identical performance history (falls back to
  even/random ordering); a brand-new topic with no performance history at all.
- **Failure modes**: missing/corrupted local performance data for a card should not crash the
  ordering logic — treat as neutral/never-seen rather than erroring.

## Tasks
- [ ] Define the weighting function (e.g. weight = f(missCount, lastResult)) and keep it as an
  isolated, unit-testable module rather than inlined into the browse UI.
- [ ] Wire the weighting function into the flashcard draw order from ph-2-us-3.
- [ ] Unit test the weighting function directly against the Acceptance Criteria scenarios above.

## Questions
- Exact weighting formula (how much to boost a missed card, how fast the boost decays after
  correct answers) is not specified in `prd.md` — start with a simple, easy-to-tune constant-based
  formula rather than over-engineering; revisit based on how flashcard sessions feel once built.
