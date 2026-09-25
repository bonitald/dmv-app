# Test date step and countdown card

**ID:** ph-9-us-5
**Layer:** Frontend
**Parent:** ph-9-us-4
**Status:** Built (Slice 1, 2026-09-24) — awaiting device test

## Story
As a teen user,
I want a simple date picker for my test and a countdown I can tap to change it,
So that setting and updating my test date takes seconds.

## Context
- **Product area**: Phase 9 (`docs/phases.md`, second bullet).
- **Layer**: Frontend (Expo/React Native).
- Backed by ph-9-us-2 (`users/{uid}.testDate`, `YYYY-MM-DD` or `null`) — not built yet.
- Two pieces:
  - **Date step**: a date picker used inside onboarding (ph-9-us-3) and again when editing from the
    countdown card.
  - **Countdown card**: shown on Home (ph-9-us-7).
- Countdown uses **calendar days in the device's local time zone**, computed from the stored date
  string. No time-of-day and no timestamps, so it can't be off by one across zones.
- Picker: prefer the native date picker from `@expo/ui` per the Expo skill guidance; check it
  exists for both platforms before adding any other dependency.

## Acceptance Criteria
- [ ] Given the date step, when it shows, then the picker starts at about 4 weeks from today, and
  only dates from today to 12 months ahead can be picked.
- [ ] Given the user picks a date and continues, when it's saved, then `testDate` is written as
  `YYYY-MM-DD`.
- [ ] Given the user taps Skip, when they continue, then nothing is written and nothing is blocked.
- [ ] Given a test date N days away, when the countdown card renders, then it shows "N days until
  your test" (N ≥ 2), "Your test is tomorrow" (1), or "Test day — good luck!" (0).
- [ ] Given the date is in the past, when the card renders, then it shows a neutral "Your test
  date has passed" state (Phase 5 adds the outcome prompt here).
- [ ] Given no date, when Home renders, then an "Add your test date" card shows. Dismissing it
  hides it (remembered locally); the date can still be added later from Settings.
- [ ] Given the user taps the countdown card, when the editor opens, then they can change the date
  or remove it (`testDate: null`).
- [ ] Given the device is offline, when the date is saved, then the card updates immediately and
  the write syncs later (Firestore offline persistence).

## UI/UX Notes
- **Screens/flows**: onboarding step 3 (ph-9-us-3); Home countdown card → date editor sheet.
- The countdown uses the `stat` type style for the number. Calm, not alarming, even in the last
  few days.

## Dependencies
- **Parent**: ph-9-us-4 — the date step and countdown.
- **Backed by**: ph-9-us-2 (not built yet).
- **Used by**: ph-9-us-3 (onboarding), ph-9-us-7 (Home), Phase 5 (past-date state).

## Test Notes
- **Happy path**: pick a date 30 days out → "30 days until your test"; change to 1 day → "tomorrow".
- **Edge cases**: today; the date passes while the app is open overnight (recomputed on focus);
  device time zone change; the 12-month limit.
- **Failure modes**: write rejected (log and keep the local value); stored value malformed (treat
  as no date).

## Tasks
- [ ] Add a pure `daysUntil(dateString, today)` helper with the copy rules, unit-tested with
  `npm run test:app`.
- [ ] Build the date step (picker, Skip, Continue) as a reusable component.
- [ ] Build the countdown card and the "add date" card for Home.
- [ ] Add the editor sheet (change / remove).

## Implementation notes (Slice 1)
- The picker is a JS month calendar (`src/profile/CalendarPicker.tsx`) rather than `@expo/ui`'s
  native picker, so Slice 1 needs no new native module or dev-client rebuild. It can be swapped
  later without changing callers.
- The editor is a pushed screen (`TestDateEditor`), not a sheet, so it has a Back button on both
  platforms.

## Questions
None outstanding.
