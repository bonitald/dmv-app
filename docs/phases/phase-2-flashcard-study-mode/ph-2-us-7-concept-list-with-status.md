# Concept list in handbook order, with status

**ID:** ph-2-us-7
**Layer:** Parent
**Status:** Complete (Slice 4a, 2026-10-10; row marker and quiz line added in Slice 4b, 2026-10-11)

## Story
As a teen user,
I want to see every concept in the order of the handbook, each showing how far I've got with it,
and jump into any of them,
So that I can follow the handbook step by step or go straight to what I need, without being
forced through a fixed order.

## Context
- **Product area**: Phase 2 (`docs/phases.md`, fifth bullet); `prd.md` Section 5 "Concept
  learning path" (Must).
- **Layer**: Frontend (Expo/React Native). No Backend split: the topic catalog already exists
  (ph-1-us-9) and the status data comes from ph-2-us-10's Concept Progress record. A backend
  child here would be empty.
- A "concept" in the learning path is a handbook **topic** (`chunkId`, 45, PDF order), per the
  Phase 1 journey decision (`phase-1-summary.md`). `conceptId` (499) is a finer sub-concept and
  isn't shown as its own list item.
- This screen is also the topic picker for flashcard browsing (ph-2-us-1), so there's one list,
  not two.
- Statuses (`prd.md` Section 5): not started / in progress / reviewed / needs revisit. How each
  one is set is defined in ph-2-us-10.
- Many topics may have no approved questions yet (about 900 questions still await review). Each
  `topics` doc carries `approvedQuestionCount`.

## Acceptance Criteria
- [x] Given the `topics` collection is populated, when the teen user opens the Study tab, then
  they see every topic ordered by `order` (handbook PDF order), each with its `title` and short
  `description`.
- [x] Given the user has a Concept Progress record for a topic, when the list renders, then that
  topic shows its status and, if one exists, its latest mini-quiz score.
- [x] Given the user has no Concept Progress record for a topic, when the list renders, then the
  topic shows "not started". A missing record is not an error.
- [x] Given any topic in the list, when the user taps it, then it opens that topic's flashcards
  (ph-2-us-3), whatever its status or position — no locked or gated topics.
- [x] Given a topic has `approvedQuestionCount == 0`, when the list renders, then it's shown but
  clearly marked as "coming soon" and not tappable, rather than opening an empty deck.
- [x] Given the user changes a topic's status (ph-2-us-9) and comes back to the list, when the
  list shows again, then the new status is visible without restarting the app.
- [x] Given the device is offline on first open, when the list can't load, then the user sees a
  "no connection" state with retry. Once loaded, Firestore's offline cache is enough to show
  it again.

## UI/UX Notes
- **Screens/flows**: replaces the Study tab's `PlaceholderScreen` (`src/navigation/RootNavigator.tsx`,
  `StudyHome` route). Tapping a topic pushes the flashcard viewer onto the Study stack.
- Status as a chip on each row. Use only existing tokens (e.g. `successSoft` for reviewed,
  `secondarySoft` for needs revisit, `primarySoft` for in progress, neutral for not started).
- A short line at the top: you can start any concept, in any order, and restart one any time.
- **Empty/error/offline states**: per Acceptance Criteria.

## Dependencies
- **Blocked by**: ph-1-us-9 (`topics`, Complete); ph-2-us-12 (client Concept Progress module,
  for statuses). The list can render all "not started" before ph-2-us-12 lands.
- **Leads to**: ph-2-us-3 (flashcard viewer).

## Test Notes
- **Happy path**: 45 topics in PDF order with mixed statuses; tap one, it opens.
- **Edge cases**: every topic "not started" (new user); a topic with zero approved questions;
  a topic status changed then back-navigated to the list.
- **Failure modes**: offline first launch; `topics` read denied (signed-out) shows the error
  state, not a crash.

## Tasks
- [x] Add `src/study/topics.ts`: read `topics` ordered by `order`.
- [x] Build the concept list screen, merging `topics` with Concept Progress (ph-2-us-12).
- [x] Replace the Study tab placeholder and wire navigation to the flashcard viewer.
- [x] Implement status chips, "coming soon" rows, and offline/error states.

## Implementation notes (Slice 4a)
Built in Slice 4a on `feat/concept-list-flashcards`; plan `docs/superpowers/plans/2026-10-03-slice-4a-concept-list-flashcards.md`, design `docs/superpowers/specs/2026-10-03-slice-4a-concept-list-flashcards-design.md`.
- **Viewer is on the root stack** (design decision 3), like Baseline and Review, not pushed onto the Study stack as the UI/UX Notes above first said. Back returns to wherever the user came from (list, results, review) and the tab bar is hidden while studying.
- The Study tab header stays "Study"; the list has its own intro line. A topic doc missing `approvedQuestionCount` counts as 0 ("coming soon"). An error reading Concept Progress is treated as "everything not started".
- Final-review fixes (commit 028d960): the coming-soon chip uses `inkSoft` for contrast, Concept Progress resets on uid change, and an empty concept list offers Try again.
- Device-tested on the Android emulator against dev: all passed.

## Implementation notes (Slice 4b)
Built in Slice 4b on `feat/mini-quiz-progress`; plan `docs/superpowers/plans/2026-10-11-slice-4b-mini-quiz-progress.md`, design `docs/superpowers/specs/2026-10-11-slice-4b-mini-quiz-progress-design.md` (including its Amendment A1-A7 from device testing). Device-tested on the Android emulator 2026-10-11.
- The list row keeps the status chip and adds a coral "Last quiz not passed" marker when the latest quiz score is below the pass mark (spec A6). This replaces the "Latest quiz: N%" display.
- A new line reads "Quizzes: {p} passed · {f} not passed · latest {c} of {t}" (parts with no data are left out). Records without counts or correct/total fall back to "Latest quiz: {n}%".
- The `needs-revisit` chip still displays for old records, but nothing sets it any more (ph-2-us-9).

## Questions
- ph-1-us-9 asked whether small or empty topics should be hidden. This story shows them as
  "coming soon" instead, so the handbook order stays complete. Change it here if hiding is
  preferred.
