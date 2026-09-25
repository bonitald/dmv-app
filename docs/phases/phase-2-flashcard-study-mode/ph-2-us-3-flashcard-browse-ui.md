# Flashcard viewer for a topic

**ID:** ph-2-us-3
**Layer:** Frontend
**Parent:** ph-2-us-1
**Status:** Not Started

## Story
As a teen user,
I want to open a topic and work through its flashcards one at a time,
So that I can study CO DMV handbook content in focused chunks rather than one long undifferentiated
list.

## Context
- **Product area**: Phase 2 (`docs/phases.md`)
- **Layer**: Frontend (Expo/React Native)
- Backed by `getFlashcards({ chunkId })` (ph-1-us-10, built). Contract in `functions/README.md`:
  - Returns the whole topic in one call, already shuffled. No paging.
  - Each card has `id`, `text`, `choices`, `correctAnswer`, `type`, `chunkId`, `conceptId`.
  - Errors: `not-found` (topic has no approved questions), `resource-exhausted` (over 30 calls /
    10 min for this user), `unauthenticated`, `invalid-argument`.
- The app can't call Cloud Functions yet: `@react-native-firebase/functions` isn't installed.
  It's a native module, so adding it means rebuilding the dev client. This is the first story
  that needs it unless a Phase 3/9 journey story lands first.
- Flashcards are for **memorizing**, so they are classic **flip cards**. The front shows only
  the question (`text`), with no choices. Flipping shows only the correct answer
  (`correctAnswer`) on the back. The wrong choices never appear in flashcard mode: seeing them
  next to the answer works against memorizing it. Picking between choices is what the mini-quiz
  (ph-2-us-8) and practice tests are for.
- **No per-card marking.** The user flips each card and moves on. The concept is the unit of
  study: once they've been through every card, the end-of-deck screen lets them choose to **take
  the mini-quiz** (ph-2-us-8) or **start the concept over**. The miss signal for weak-card
  ordering comes from the mini-quiz (ph-2-us-6), not from the flashcards.
- The flashcard and the quiz question are separate components. They share visual styling
  (card surface, scenario badge from ph-2-us-5), but the quiz card (ph-2-us-8) shows the
  choices, and the flashcard never does.

## Acceptance Criteria
- [ ] Given the teen user opens a topic from the concept list (ph-2-us-7), when its cards load,
  then the first card shows its front: the question text only, with no answer choices.
- [ ] Given a card's front is showing, when the user taps the card, then it flips to the back,
  which shows only the correct answer (no wrong choices, no right/wrong marking).
- [ ] Given a card's back is showing, when the user taps the card again, then it flips back to
  the front.
- [ ] Given any card is showing (either side), when the user taps "Next" or swipes forward, then
  the next card's front shows; swiping back shows the previous card's front. Nothing is recorded
  per card.
- [ ] Given the user moves past the last card, when the end-of-deck screen shows, then it offers
  two choices: "Take the mini-quiz" (ph-2-us-8) and "Start this concept over".
- [ ] Given the user picks "Start this concept over", when the deck restarts, then it starts from
  the first card with a fresh order (ph-2-us-4), from the session cache (no new `getFlashcards`
  call), and the concept's status is unchanged.
- [ ] Given the user has already loaded a topic this app session, when they reopen it (including
  "Review Again", ph-2-us-9), then the cards come from an in-memory session cache, not a new
  `getFlashcards` call — reopening a topic shouldn't use up the rate limit.
- [ ] Given `getFlashcards` returns `not-found`, when the topic opens, then the user sees a
  "nothing here yet" message rather than an error or a blank screen.
- [ ] Given `getFlashcards` returns `resource-exhausted`, when the topic opens, then the user sees
  a friendly "take a short break and try again in a few minutes" message, not a generic error.
- [ ] Given the device is offline and the topic isn't in the session cache, when the user opens
  it, then they see a clear "no connection" state with a retry option. There is no offline copy
  of the full bank (extraction-prevention, ph-1-us-10), so offline study only works for topics
  already loaded this session.
- [ ] Given any other call failure, when it happens, then the user sees a retry option rather
  than a silent failure.

## UI/UX Notes
- **Screens/flows**: Study tab → concept list (ph-2-us-7) → flashcard viewer → end-of-deck →
  mini-quiz (ph-2-us-8) or back to card 1 (start over). The back button returns to the concept
  list at any point.
- Show progress through the deck (e.g. "4 of 23").
- A flip animation for the front→back turn; an "answer" label on the back so it's clear which
  side is showing.
- **Empty/error/offline states**: per Acceptance Criteria above. Use the existing
  `NoConnectionScreen` pattern from `App.tsx` as the visual reference.
- Scenario vs. fact styling is ph-2-us-5; this story only needs to pass `type` through to the
  card component.
- Card order: the server already shuffles. ph-2-us-4 reorders on the client once it lands.

## Dependencies
- **Parent**: ph-2-us-1 — this is the frontend half of "browse flashcards by topic."
- **Backed by**: ph-1-us-10 `getFlashcards` (built) and ph-1-us-9 `topics` (built).
- **Blocked by**: ph-2-us-7 (concept list is the entry point). The viewer can be built and run
  from a temporary entry point before that.

## Test Notes
- **Happy path**: open a topic, flip through every card, reach end-of-deck, start over, reach
  end-of-deck again, take the quiz.
- **Edge cases**: topic with exactly one card; a card with a very long question (scenario) or
  answer; rapid taps on the card or "Next" while the flip is animating; swiping back from the first
  card; a question whose
  wording depends on its choices (see Questions); reopening a topic in the same
  session makes no new call.
- **Failure modes**: `not-found`, `resource-exhausted`, offline before load, offline mid-topic
  (already-loaded cards keep working), call timeout.

## Tasks
- [ ] Add `@react-native-firebase/functions` and rebuild the dev client (skip if a journey story
  already did this).
- [ ] Add a typed client wrapper for `getFlashcards` that maps callable error codes to UI states
  (empty / rate-limited / offline / error). Shared with ph-2-us-8's quiz calls.
- [ ] Add the in-memory session cache keyed by `chunkId`.
- [ ] Build the flip flashcard component (front: question; back: correct answer).
- [ ] Build the flashcard viewer screen (next/previous, swipe), progress indicator, and the
  end-of-deck screen with "Take the mini-quiz" / "Start this concept over".
- [ ] Implement empty / rate-limited / offline / error states.
- [ ] Add a `jest-expo` config for component tests (`jest.app.config.js` is Node-only) and cover
  the card component and error states.

## Questions
- Some questions may be worded around their choices ("Which of the following..."). On a card
  that shows only the question, those read oddly. Options: phrase questions so they stand on
  their own at authoring time, add an optional flashcard-front field later, or show choices on
  the front only for those questions. Not decided; check how many questions this affects once
  approved content is loaded.
