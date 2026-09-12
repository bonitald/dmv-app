# Flashcard browse UI by topic

**ID:** ph-2-us-3
**Layer:** Frontend
**Parent:** ph-2-us-1
**Status:** Not Started

## Story
As a teen user,
I want to pick a topic and flip through its flashcards,
So that I can study CO DMV handbook content in focused chunks rather than one long undifferentiated
list.

## Context
- **Product area**: Phase 2 (`docs/phases.md`)
- **Layer**: Frontend (Expo/React Native)
- Backed by `ph-2-us-2` (`listFlashcardsByTopic` callable function) — not built yet as of this
  story's authoring, so this frontend work is blocked until that function exists and its
  contract is documented.

## Acceptance Criteria
- [ ] Given the teen user opens the Study tab, when the flashcard mode screen loads, then they
  see a list of topics (fetched via the topic-listing path from ph-2-us-2).
- [ ] Given a teen user taps a topic, when its flashcards load, then the first card is shown with
  a way to reveal the answer and advance to the next card (tap/swipe).
- [ ] Given the topic has more cards than one page returns, when the user reaches the end of the
  loaded page, then the next page is fetched using the cursor from ph-2-us-2 before the user runs
  out of cards (prefetch, not a visible loading gap mid-session).
- [ ] Given the device is offline, when the user opens a topic they haven't viewed this session,
  then they see a clear "no connection" state rather than a blank or frozen screen — no offline
  bulk cache of the full bank exists (per the extraction-prevention constraint on ph-2-us-2), so
  offline flashcard study is only possible for topics already fetched this session.
- [ ] Given a network/function call fails mid-browse, when the error occurs, then the user sees a
  retry option rather than a silent failure.

## UI/UX Notes
- **Screens/flows**: Study tab → topic list → flashcard viewer (one card at a time, front/back
  flip or reveal-answer pattern).
- **Empty/error/offline states**: empty topic (zero cards) shows a clear "nothing here yet"
  message rather than a blank screen; offline state per Acceptance Criteria above.
- Visual treatment for scenario vs. fact-recall cards is handled by ph-2-us-5, not duplicated
  here — this story's viewer just needs to render whatever type flag the card carries.

## Dependencies
- **Blocked by**: ph-2-us-2 (not built yet).
- **Parent**: ph-2-us-1 — this is the frontend half of "browse flashcards by topic."
- **Backed by**: ph-2-us-2 — not built yet as of this writing.

## Test Notes
- **Happy path**: pick a topic, flip through all its cards, reach the end cleanly.
- **Edge cases**: topic with exactly one card; topic spanning multiple pages; rapid
  next-card tapping while a page fetch is in flight.
- **Failure modes**: function call throws/times out; device goes offline mid-topic after the
  current page is already cached in memory.

## Tasks
- [ ] Build the topic-list screen consuming the topic-listing read path.
- [ ] Build the flashcard viewer screen with reveal/advance interaction.
- [ ] Wire pagination/prefetch against `listFlashcardsByTopic`'s cursor.
- [ ] Implement offline/error/empty states per Acceptance Criteria.

## Questions
None outstanding.
