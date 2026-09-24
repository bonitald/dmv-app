# Home screen with both routes, onboarding shown only once

**ID:** ph-9-us-6
**Layer:** Parent
**Children:** ph-9-us-7 (Frontend)
**Status:** Not Started

## Story
As a teen user who has finished onboarding,
I want a home screen that always offers both taking a test and studying concepts,
So that the choice I made on day one never limits what I do next.

## Context
- **Product area**: Phase 9 (`docs/phases.md`, fourth bullet: "the first-run choice is stored,
  and the home screen offers both 'start a test' and the concept list from then on, without
  re-showing onboarding").
- **Layer**: Frontend. Storing the choice is ph-9-us-2; not re-showing onboarding is ph-9-us-3's
  gate. What's left is the Home screen itself (ph-9-us-7). No separate Backend child.
- **There's no Home screen today.** `RootNavigator` (ph-0-us-8) has four tabs: Study, Practice,
  Driving Log, Progress. The Home mockup (`docs/design/mockups.md`) shows the test-date countdown,
  flashcard and practice-test entry points, "weak spots", and a driving-log summary. ph-9-us-7
  adds Home as the first tab.

## Acceptance Criteria
- [ ] Given onboarding is done, when the app opens, then it lands on Home.
- [ ] Given Home, when it renders, then it offers both a test entry (baseline if not finished,
  otherwise a practice test) and a study entry (continue learning / concept list), whichever
  route was picked at onboarding.
- [ ] Given Home, when it renders, then it shows the test-date countdown or "add date" card
  (ph-9-us-5).

## Dependencies
- **Children**: ph-9-us-7 (Home tab).
- **Uses**: ph-9-us-2 (profile), ph-9-us-3 (onboarding gate), ph-9-us-5 (countdown), ph-3-us-13
  (baseline state), ph-2-us-7/12 (concepts and status), ph-4-us-6 (weak spots).
