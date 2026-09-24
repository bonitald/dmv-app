# Phase 9: First-Run Onboarding & Account Linking — Summary

## Status: Not Started

Numbered last, but onboarding is the first thing a new user sees. It routes into Phase 2 (concept
list), Phase 3 (baseline) and Phase 4 (results), so in build order it comes as soon as the
baseline flow exists, with destinations stubbed until they land. Account linking can come later,
but it must ship before Phase 8 (beta).

## Stories

| ID | Title | Layer | Parent | Status |
|----|-------|-------|--------|--------|
| ph-9-us-1 | First-run choice: "test what I know" or "learn first" | Parent | — | Not Started |
| ph-9-us-2 | Profile fields for onboarding and test date, with tightened rules | Backend | ph-9-us-1 | Not Started |
| ph-9-us-3 | Onboarding flow: welcome, route choice, optional test date | Frontend | ph-9-us-1 | Not Started |
| ph-9-us-4 | Tentative test date and countdown | Parent | — | Not Started |
| ph-9-us-5 | Test date step and countdown card | Frontend | ph-9-us-4 | Not Started |
| ph-9-us-6 | Home screen with both routes, onboarding shown only once | Parent | — | Not Started |
| ph-9-us-7 | Home tab | Frontend | ph-9-us-6 | Not Started |
| ph-9-us-8 | "Save your progress": link to a real sign-in and recover on a new phone | Parent | — | Not Started |
| ph-9-us-9 | Sign-in providers and the `deleteAccount` function | Backend | ph-9-us-8 | Not Started |
| ph-9-us-10 | Linking prompts, sign-in on a new phone, and Settings | Frontend | ph-9-us-8 | Not Started |

`docs/phases.md` bullet → story: 1 → us-1; 2 → us-4; 3 → us-8; 4 → us-6.

## Key decisions made during planning

- **Profile doc holds `onboarding` and `testDate`** (ph-9-us-2), and its rule is tightened from
  "owner writes anything" to "owner may change only those two fields, with valid values". Delete
  is denied. `testDate` is a `YYYY-MM-DD` string, so the countdown is never off by a day across
  time zones.
- **Phase 9 defines the test date; Phase 5 builds on it** (outcome prompt after the date, Test
  Outcome record). Editing the date is done here via the countdown card, which covers Phase 5's
  "edit flow" wording.
- **Onboarding gate = profile field + local flag**, so returning users skip it instantly, even
  offline. Three taps from launch to the first question or concept if the date is skipped.
- **A new Home tab, first of five** (ph-9-us-7). It only shows and links. Each card renders only
  once its feature exists, so Home can ship early and fill in as Phases 2–6 land. The route
  picked at onboarding never hides the other route.
- **Linking keeps the uid** — no data migration. "Credential already in use" is handled by
  offering to switch to that account, with a clear warning. Nothing about the account is stored
  in Firestore (email stays in Firebase Auth).
- **Providers assumed Apple (iOS) + Google**, email link deferred (`prd.md` recommendation).
- **`deleteAccount` callable** (ph-9-us-9) deletes everything under `users/{uid}` plus the Auth
  user. It's offered to all users, anonymous included, and revokes the Apple token first where
  needed. New per-user subcollections from later phases are covered automatically.
- **Local device data is cleared** on sign-out, account switch and deletion, so histories never
  mix between users.

## Open items carried into implementation

- Confirm sign-in providers (Apple + Google assumed).
- Privacy review for minors before launch (`prd.md` Section 8), before Phase 8.
- Removing the dev smoke test in `App.tsx` (ph-9-us-2) — it's currently denied by the narrowed
  rules, so it fails in dev today. This could be pulled forward and done any time.
- Phase 5 stories should reference ph-9-us-2 / us-5 for `testDate`. Phase 7 should add the
  "save your progress" prompt before export (ph-9-us-8).
- Cleanup of orphaned anonymous users after reinstalls — not MVP, flag for Phase 8.
