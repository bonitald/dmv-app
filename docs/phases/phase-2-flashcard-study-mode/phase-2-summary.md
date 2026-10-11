# Phase 2: Flashcard Study Mode & Concept Learning Path — Summary

## Status: In Progress (Slice 4a complete 2026-10-10: concept list, flashcard viewer, Concept Progress backend and client; Slice 4b remains)

Depends on Phase 1 (question bank), which is Complete. Phase 1's journey stories (ph-1-us-7 to
11) already built every server function this phase calls, so Phase 2 is mostly frontend. The
only new backend work is the Concept Progress record (ph-2-us-11).

## Stories

| ID | Title | Layer | Parent | Status |
|----|-------|-------|--------|--------|
| ph-2-us-1 | Browse flashcards organized by topic | Parent | — | Not Started |
| ph-2-us-2 | `listFlashcardsByTopic` callable Cloud Function | Backend | ph-2-us-1 | Superseded by ph-1-us-9/10 |
| ph-2-us-3 | Flashcard viewer for a topic | Frontend | ph-2-us-1 | In Progress (viewer done; mini-quiz button is a placeholder until ph-2-us-8) |
| ph-2-us-4 | Weak/missed cards resurface more often | Parent | — | Not Started |
| ph-2-us-5 | Scenario cards woven into the flashcard flow | Parent | — | Complete |
| ph-2-us-6 | Local per-card performance tracking | Parent | — | Not Started |
| ph-2-us-7 | Concept list in handbook order, with status | Parent | — | Complete |
| ph-2-us-8 | Concept mini-quiz after its flashcards | Parent | — | Not Started |
| ph-2-us-9 | Post-quiz recommendation and next-step choice | Parent | — | Not Started |
| ph-2-us-10 | Concept progress saved to my account | Parent | — | In Progress |
| ph-2-us-11 | Concept Progress record, rules, and `scoreTest` score write | Backend | ph-2-us-10 | Complete |
| ph-2-us-12 | Client Concept Progress module | Frontend | ph-2-us-10 | Complete |

`docs/phases.md` bullet → story: 1 → us-1; 2 → us-4; 3 → us-5; 4 → us-6; 5 → us-7; 6 → us-8;
7 → us-9; 8 → us-10.

## Key decisions made during planning

- **Flashcard browsing needs no new function.** `getFlashcards` (ph-1-us-10) and the `topics`
  collection (ph-1-us-9) replace the originally planned `listFlashcardsByTopic` (ph-2-us-2,
  superseded 2026-09-23). A topic returns whole (no paging), grouped by `chunkId`.
- **A "topic" and a "concept" are the same thing**: a handbook chunk (`chunkId`, 45, PDF order).
  The concept list (ph-2-us-7) is also the flashcard topic picker, so there's one list.
- **Flashcards are flip cards for memorizing** (ph-2-us-3, changed 2026-09-23): the front is
  the question only, the back is only the correct answer, no wrong choices. There's no per-card
  marking. The concept is the unit of study: at the end of the deck the user picks "Take the
  mini-quiz" or "Start this concept over". Choices appear only in the mini-quiz and tests.
- **Weak cards come from quiz misses**: `scoreTest`'s per-question results are stored locally
  (ph-2-us-6), and the next pass through a concept's flashcards puts missed cards first
  (ph-2-us-4). Every card still appears once per pass.
- **Two card types, shared styling**: the flip flashcard (ph-2-us-3) and the quiz question card
  (ph-2-us-8) share the card surface and scenario badge (ph-2-us-5). The quiz card and quiz
  runner are owned by ph-3-us-4 and reused here for the mini-quiz.
- **Per-topic session cache** in memory, so reopening a topic or "Review Again" doesn't use up
  `getFlashcards`' 30-calls / 10-min rate limit (ph-2-us-3).
- **Concept Progress is split by field** (ph-2-us-10/11): `scoreTest` writes the score (can't be
  forged), the client writes only `status` (the user's own choice), enforced by rules. This
  resolves the Phase 1 open item on who updates Concept Progress.
- **Status transitions are defined once**, on ph-2-us-10: opening a not-started topic → in
  progress; opening never downgrades; Review Again → in progress; Come Back Later → needs
  revisit; Mark Reviewed → reviewed; grading changes the score only.
- **Per-card performance stays local-only** (ph-2-us-6, AsyncStorage). Concept Progress is the
  server-side record, per `prd.md` Section 7.
- **Resurfacing, scenario cards, per-card tracking, concept list, mini-quiz and recommendation
  have no Backend/Frontend split**: they're client-only or use functions that already exist.
  Splitting them would have produced empty Backend children.

## Open items carried into implementation

- `@react-native-firebase/functions` was installed in Slice 2 (done).
- Component tests need a `jest-expo` config (`jest.app.config.js` is Node-only); added with the
  first screen, which in journey order is onboarding (ph-9-us-3, `build-order.md` Slice 1).
- The mini-quiz's offline/force-quit resilience is ph-3-us-1's scope, built in `build-order.md`
  Slice 2 (before the mini-quiz in Slice 4b).
- About 900 questions still await review, so many topics may have no approved content yet.
  ph-2-us-7 shows them as "coming soon" rather than hiding them.
- Unvalidated tunables: mini-quiz threshold (80%), flashcard rate limit (30 / 10 min),
  weak-card weighting constants (ph-2-us-4).
- "Come Back Later" → needs revisit regardless of score is an assumption (ph-2-us-9).
- Questions worded around their choices ("Which of the following...") are shown as-is on the flashcard front (decided for Slice 4a). No problems were noticed in the device test; revisit if reviewers flag cards (ph-2-us-3).
- Whether local per-card performance should ever sync to Firestore stays a future consideration
  (ph-2-us-6).

## Slice 4a carry-forwards

- Slice 4b: "Review Again" from the mini-quiz back to an existing Flashcards route needs goBack/popTo or a state reset on `chunkId` change; once `reviewed` exists, ignore a cache-only empty first progress snapshot before `markOpened`.
- Slice 6: `clearDeckCache()` and reset last-opened and progress on sign-out.
