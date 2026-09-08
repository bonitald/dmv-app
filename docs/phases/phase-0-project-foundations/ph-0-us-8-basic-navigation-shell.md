# Basic navigation shell across core sections

**ID:** ph-0-us-8
**Layer:** Frontend
**Status:** Done (2026-09-07) — verified on Android emulator: 4-tab bottom navigator with a
stack per tab, active-tab indication, and placeholder screens, built on the project's locked
design system (docs/design/mockups.md canvas — Teal & Coral palette, Outfit/Plus Jakarta Sans
type, 4px spacing/radius scale) rather than default styling.

## Story
As a developer,
I want basic navigation (tab or stack) between Study, Practice Tests, Driving Log, and
Progress/Outcome sections,
So that later phases have a home to land their screens in, instead of each phase inventing
its own navigation structure ad hoc.

## Context
- **Product area**: Phase 0 — Project Foundations
- **Layer**: Frontend (Expo/React Native)
- No split into Backend/Frontend children — this is pure client-side navigation structure
  with no Firebase-side component.
- Maps directly to the four section groupings implied by `docs/prd.md`'s Core Features table
  (Section 5) and `docs/phases.md`'s phase groupings: Study (Phases 1–2), Practice Tests
  (Phases 3–4), Driving Log (Phases 6–7), and Progress/Outcome (Phase 5). This story builds
  the shell only — no real screens exist yet inside each section.

## Acceptance Criteria
- [x] Given the app launches (post sign-in, ph-0-us-7), when the user lands on the home
  screen, then a persistent tab (or equivalent) navigator is visible with four destinations:
  Study, Practice Tests, Driving Log, and Progress/Outcome. Verified live on Android emulator.
- [x] Given each destination currently has no real feature screens, when a user taps into
  one, then it shows a clearly-labeled placeholder rather than a blank/broken screen.
  `PlaceholderScreen` renders `<label> / Coming soon` for each tab.
- [x] Given a user is on any of the four sections, when they switch between them, then the
  active tab is visually indicated. `tabBarActiveTintColor: colors.primary` vs.
  `tabBarInactiveTintColor: colors.inkFaint` — confirmed visually (Study tab teal + bold when
  active).
- [x] Given later phases will add nested screens within a section (e.g. a flashcard detail
  screen under Study), when the navigator is set up, then each tab is its own stack
  navigator (not a single flat screen), so nested navigation can be added later without
  restructuring the root navigator. Each tab in `RootNavigator.tsx` is its own
  `createNativeStackNavigator()` instance.

## UI/UX Notes
- **Screens/flows**: Root tab navigator with four tabs, each wrapping its own stack
  navigator; each stack's initial screen is a placeholder for this story.
- **Empty/error/offline states**: N/A — placeholders aren't real feature screens yet, so
  there's no data-driven empty state to define here.
- **Accessibility considerations**: Tab labels/icons should be legible and have accessible
  labels (screen-reader-friendly) from the start, since retrofitting nav accessibility later
  is more disruptive than other UI.

## Dependencies
- **Blocked by**: ph-0-us-1 (project scaffold).

## Test Notes
- **Happy path**: App launches, all four tabs are visible and reachable, active tab is
  indicated correctly.
- **Edge cases**: Deep-linking directly into a nested screen (not needed yet, but the
  stack-per-tab structure should not preclude adding this later).
- **Failure modes**: A flat single-navigator structure that would force a breaking
  restructure once a later phase needs nested screens — avoided by the stack-per-tab
  requirement above.

## Tasks
- [x] Install and configure React Navigation (or Expo Router, per the team's preferred
  routing approach) with a root tab navigator. Chose React Navigation
  (`@react-navigation/native` + `bottom-tabs` + `native-stack`) over Expo Router since the
  entry point (`App.tsx`) already had `AuthProvider` wired in from ph-0-us-7 — React
  Navigation slotted in without restructuring the entry point; Expo Router would have
  required moving to file-based routing and an `app/` directory. Not a locked long-term
  decision, just the lower-disruption choice for this story.
- [x] Create one stack navigator per tab (Study, Practice Tests, Driving Log,
  Progress/Outcome), each with a single placeholder screen. See
  `src/navigation/RootNavigator.tsx`, `src/screens/PlaceholderScreen.tsx`.
- [x] Add active-tab visual indication and accessible tab labels.
  `tabBarAccessibilityLabel` set per tab; active/inactive tint from design tokens.
- [x] (Added, not originally scoped as a task) Built on the project's actual locked design
  system rather than default RN styling: `src/theme/tokens.ts` mirrors the design canvas's
  Color Tokens / Typography / Spacing & Radius artboards (`docs/design/mockups.md`) —
  oklch() values converted to hex (RN's StyleSheet doesn't support oklch()), Outfit +
  Plus Jakarta Sans loaded via `@expo-google-fonts/*` and `expo-font`, with
  `expo-splash-screen` holding the splash until fonts are ready.

## Questions
- None outstanding.
