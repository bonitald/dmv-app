# Home tab

**ID:** ph-9-us-7
**Layer:** Frontend
**Parent:** ph-9-us-6
**Status:** In Progress (Slice 1 part complete 2026-09-25; remaining cards land in Slices 2–6)

## Story
As a teen user,
I want one screen that shows how long until my test and what to do next,
So that every time I open the app I can get straight into studying or testing.

## Context
- **Product area**: Phase 9 (`docs/phases.md`, fourth bullet).
- **Layer**: Frontend (Expo/React Native).
- **Navigation change**: add a `Home` tab as the first of five in `RootNavigator`
  (`src/navigation/RootNavigator.tsx`), with its own stack like the others (ph-0-us-8 pattern).
  Five bottom tabs is within platform guidance.
- Home only **shows and links**; each card reads data other stories already provide:
  - Countdown / add-date card — ph-9-us-5 (profile `testDate`)
  - Test card — baseline state from `users/{uid}/baseline/progress` (ph-3-us-13): "Start your
    baseline" / "Resume section N" / once done, "Take a practice test" with the last score
    (ph-4-us-1) and the baseline comparison (ph-4-us-7)
  - Study card — "Continue learning": the first concept in handbook order that's in progress or
    needs revisit, else the first not started (ph-2-us-7 / ph-2-us-12), plus "All concepts"
  - Weak spots — up to 3 likely gap / Missed it topics from the concept report (ph-4-us-6), each
    linking to its flashcards. Hidden until there's evidence.
  - Driving log summary — Phase 6. Leave a slot, hidden until Phase 6 exists.
  - "Save your progress" card — ph-9-us-10, only for anonymous users, dismissible.
- No streaks, points or leaderboards (`prd.md` scope, mockup notes).
- Cards whose feature isn't built yet should simply not render, so Home can ship early in the
  journey order and fill in as Phases 2–6 land.
- A settings gear in Home's header opens Settings (account, test date, delete data — ph-9-us-10).

## Acceptance Criteria
- [x] Given onboarding is done, when the app opens, then it lands on the Home tab, the first tab.
- [ ] Given the baseline isn't finished, when Home renders, then the test card offers Start or
  Resume. Given it's finished, then it offers a practice test with the latest score.
- [ ] Given concept progress, when Home renders, then "Continue learning" opens the right
  concept's flashcards, and "All concepts" opens the concept list.
- [x] Given the user picked "Learn first" at onboarding, when Home renders, then the test card is
  still there. Given "Test what I know", the study card is still there. The route choice never
  hides either.
- [ ] Given the concept report has likely gap / Missed it topics, when Home renders, then up to 3
  show as weak spots with links. Given none, the section is hidden.
- [x] Given a feature a card depends on isn't built yet, when Home renders, then that card is
  absent (not an error or an empty box).
- [ ] Given data is loading or offline, when Home renders, then cards show skeletons or cached
  values, and each card fails on its own without blanking the screen.

## UI/UX Notes
- **Screens/flows**: Home tab (first) → baseline / runner / flashcards / concept list / date
  editor / Settings.
- Order top to bottom: countdown, test card, study card, weak spots, driving summary, save-progress
  card. Follow the Home mockup and locked tokens.

## Dependencies
- **Parent**: ph-9-us-6.
- **Uses**: ph-9-us-5, ph-3-us-13, ph-4-us-1, ph-4-us-6, ph-4-us-7, ph-2-us-7, ph-2-us-12,
  ph-9-us-10. Cards render as those land.
- **Blocked by**: ph-9-us-3 (onboarding gate decides when Home is shown).

## Test Notes
- **Happy path**: new user after onboarding sees countdown, "Start your baseline", "Continue
  learning" (first concept).
- **Edge cases**: baseline in progress; baseline done, no practice tests; all concepts reviewed
  (study card → "All concepts"); no test date; returning to Home after a test (data refreshes).
- **Failure modes**: offline cold start with cached data; one card's data read fails.

## Tasks
- [x] Add the Home tab and stack to `RootNavigator` as the first tab.
- [ ] Build Home with the cards above, each as its own component reading its own data.
- [ ] Add a pure `nextConceptToStudy(topics, progress)` helper, unit-tested.
- [x] Add the Settings entry point (screen content in ph-9-us-10).

## Implementation notes (Slice 1)
- Built: Home tab (first of five), test date card, "Start your baseline" card (→ `Baseline`
  placeholder), "Learn concept by concept" card (→ Study tab), Settings gear. Settings holds only
  the test date until ph-9-us-10.
- Still to come, per `docs/build-order.md`: Resume baseline (Slice 2), Continue learning (Slice
  4a), weak spots (4b), practice test + latest score (5), save progress (6).

## Questions
- Should the Study tab's own first screen stay the concept list (assumed yes), with Home only
  linking into it?
