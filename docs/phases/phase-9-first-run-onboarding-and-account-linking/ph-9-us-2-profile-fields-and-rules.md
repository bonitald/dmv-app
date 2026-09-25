# Profile fields for onboarding and test date, with tightened rules

**ID:** ph-9-us-2
**Layer:** Backend
**Parent:** ph-9-us-1
**Status:** Complete (Slice 1, 2026-09-25) — rules deploy still pending

## Story
As a developer,
I want the user's profile doc to hold the first-run choice and tentative test date in a defined
shape, with rules that only allow those fields to change,
So that onboarding state survives across launches and devices (once linked), and a client can't
write arbitrary data onto its profile.

## Context
- **Product area**: Phase 9 (`docs/phases.md`, first, second and fourth bullets); `prd.md`
  Section 7 data model: "Profile settings (tentative test date, first-run choice made)".
- **Layer**: Backend (Firestore schema + security rules).
- `users/{uid}` exists today with `createdAt`, written once by `AuthProvider`
  (`src/auth/AuthProvider.tsx`, ph-0-us-7). Its rule is
  `allow read, write: if request.auth.uid == uid` — any field, any value, including deleting the
  doc. This story narrows it.
- **Test date ownership**: Phase 5's first bullet says Phase 5 "owns the data and the edit flow".
  In journey order Phase 9 is built first, so this story defines the `testDate` field and Phase 5
  builds on it (outcome, past-date prompt). Phase 5's stories should reference this one.
- Store the test date as a **plain `YYYY-MM-DD` string**, not a timestamp: it's a calendar date,
  and a timestamp would shift a day across time zones.
- **Existing dev issue**: `App.tsx`'s dev smoke test writes `users/{uid}/_smoke_test/ph-0-us-4`.
  Since the rules were narrowed on 2026-09-23 that path matches no rule and is denied, so the smoke
  test fails in dev. Its own comment says to remove it once a real feature exercises the path;
  onboarding is that feature.

## Acceptance Criteria
- [x] Given a signed-in user, when they read their own `users/{uid}`, then it succeeds; another
  user's doc is denied (unchanged).
- [x] Given the first-launch create in `AuthProvider`, when it writes `{ createdAt }`, then it
  still succeeds (create allows only `createdAt`, and it must be `request.time`).
- [x] Given an update that changes only `onboarding` and/or `testDate`, when the values are valid,
  then it succeeds:
  - `onboarding`: `{ choice: 'baseline' | 'learn', completedAt: request.time }`
  - `testDate`: a `YYYY-MM-DD` string, or `null` to clear it
- [x] Given an update that touches any other field (including `createdAt`), or an invalid value
  (unknown choice, badly formatted date, client-chosen `completedAt`), when it reaches Firestore,
  then it's denied.
- [x] Given a client tries to delete its profile doc, when it reaches Firestore, then it's denied
  (account deletion goes through ph-9-us-9's function).
- [x] Given the dev smoke test, when this ships, then it's removed from `App.tsx`.

## Data and API
- **Firestore schema** — `users/{uid}`:
  - `createdAt`: timestamp (existing)
  - `onboarding`: `{ choice: 'baseline' | 'learn', completedAt: timestamp }` — absent until
    onboarding finishes
  - `testDate`: `string` (`YYYY-MM-DD`) | `null` — absent or null when not set
- **Security rules**: replace the `users/{uid}` rule with separate read / create / update rules
  as above; delete denied. Use
  `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['onboarding','testDate'])` and
  a regex match for the date.
- **Cloud Functions**: none.

## Dependencies
- **Blocked by**: ph-0-us-6/7 (profile doc exists, Complete).
- **Parent**: ph-9-us-1 — where the first-run choice is stored.
- **Consumed by**: ph-9-us-3 (onboarding), ph-9-us-5 (test date), ph-9-us-7 (Home), Phase 5
  (test date and outcome).

## Test Notes
- **Happy path**: rules tests for create, set onboarding, set/clear test date.
- **Edge cases**: setting both fields in one write; setting `testDate` before onboarding is done;
  re-running onboarding (overwrite allowed).
- **Failure modes**: write to `createdAt`, unknown field, `choice: 'other'`, `testDate:
  '2026-13-40'` or `'next week'`, client `completedAt`, delete, other user's doc — all denied.

## Tasks
- [x] Rewrite the `users/{uid}` rule in `firestore.rules`.
- [x] Add allow and deny cases to `firestore-tests/rules.test.ts` (`npm run test:rules`).
- [x] Remove the dev smoke test from `App.tsx`.
- [x] Document the profile fields (a short comment in the rules plus a line in the README's data
  section).

## Questions
- The date regex only checks the format, not real calendar dates (e.g. `2026-02-31` would pass).
  The client validates properly. Good enough for a non-critical field?
