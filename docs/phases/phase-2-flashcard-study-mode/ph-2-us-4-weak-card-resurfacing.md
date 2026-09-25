# Weak/missed cards resurface more often

**ID:** ph-2-us-4
**Layer:** Parent
**Status:** Not Started

## Story
As a teen user,
I want flashcards for questions I've missed to come up sooner than ones I already know well,
So that my study time concentrates on what I actually need to learn, without needing to run a
full spaced-repetition system.

## Context
- **Product area**: Phase 2 (`docs/phases.md`)
- **Layer**: Frontend (Expo/React Native) — no Backend split. Pure client-side ordering over
  locally tracked performance data (ph-2-us-6); no Firestore or Cloud Function changes.
- `prd.md` Section 5 describes this as "a lightweight spaced-repetition-style ordering, not a fixed
  browse order or a full SRS algorithm" — explicitly not SM-2/Anki-style scheduling. Keep it
  simple: a weighted shuffle that favors missed questions, no interval scheduling.
- **Where "missed" comes from** (changed 2026-09-23): flashcards have no per-card marking. The
  user flips through the whole concept, then at the end takes the mini-quiz or starts the concept
  over (ph-2-us-3). So "missed" means **answered wrong in a graded quiz**: the mini-quiz's
  `scoreTest` results (ph-2-us-8), recorded by ph-2-us-6. Phase 3 practice tests can feed the same
  data later.
- Flashcards and quiz questions are the same `questions` docs (same `id`), so a question missed
  in a quiz maps straight to its flashcard.
- **How it shows up**: each time a concept's flashcards start (first open, "Start this concept
  over", or "Review Again" after a quiz), the deck is ordered by a weighted shuffle so missed
  cards come earlier. Every card still appears once per pass through the deck. The server's own
  shuffle (`getFlashcards`) is replaced by this order.

## Acceptance Criteria
- [ ] Given a teen user has missed some of a topic's questions in its mini-quiz (tracked by
  ph-2-us-6), when they start that topic's flashcards again, then those cards tend to come
  earlier in the deck than cards they've answered correctly.
- [ ] Given a card's question has never been graded, when the ordering runs, then it's treated as
  neutral priority (neither boosted nor suppressed) — a lack of data is not the same as "known
  well."
- [ ] Given a question has been answered correctly in several quizzes in a row, when the ordering
  runs again, then its boost goes away (it doesn't stay permanently "weak" after being learned).
- [ ] Given this is explicitly not a full SRS, when the ordering runs, then it does not schedule
  cards for specific future dates/intervals — it only weights the order of the current deck.
- [ ] Given the ordering runs, when the deck is built, then every card in the topic is still
  included exactly once — weighting changes order, never drops cards.

## Dependencies
- **Blocked by**: ph-2-us-6's read interface for the weighting logic; ph-2-us-3 (viewer) only for
  the final wiring task. The weighting module can be built and unit-tested before either screen
  exists.
- The ordering only has data to work with once ph-2-us-8 (mini-quiz) records results through
  ph-2-us-6. Before that, every card is neutral and the order is a plain shuffle.

## Test Notes
- **Happy path**: across many runs, a card whose question was missed in the last 2 quizzes lands
  in the first half of the deck noticeably more often than a card answered correctly in the last
  2 quizzes.
- **Edge cases**: every card with identical history (plain random order); a brand-new topic with
  no history; a one-card deck.
- **Failure modes**: missing/corrupted local performance data for a card should not crash the
  ordering — treat it as neutral/never-graded.

## Tasks
- [ ] Add `src/study/deckOrder.ts`: a weighted shuffle, weight = f(missCount, correctStreak), with
  the injected random source pattern used by `functions/src/shuffle.ts` so tests are
  deterministic.
- [ ] Unit test it directly against the Acceptance Criteria scenarios (`npm run test:app`).
- [ ] Use it to order the deck in the flashcard viewer (ph-2-us-3) each time a pass starts.

## Questions
- Exact weighting formula (how much to boost a missed card, how fast the boost decays after
  correct answers) isn't specified in `prd.md` — start with a simple constant-based formula and
  tune it once real sessions exist.
- Since every card appears once per pass, "resurface more often" here means "sooner". If that's
  not enough, a later option is a "just my missed cards" deck on the end-of-deck or results
  screen. Not in scope now.
