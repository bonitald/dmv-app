# Phase 0: Project Foundations — Summary

## Status: Done — all 8 stories complete.

## Stories

| ID | Title | Layer | Parent | Status |
|----|-------|-------|--------|--------|
| ph-0-us-1 | Expo project scaffolded with custom dev client | Frontend | — | Done |
| ph-0-us-2 | Firebase project provisioned and wired into the app | Parent | — | Done |
| ph-0-us-3 | Provision the Firebase project (Firestore, Hosting, Analytics) | Backend | ph-0-us-2 | Done |
| ph-0-us-4 | Wire the Firebase SDK into the Expo app | Frontend | ph-0-us-2 | Done |
| ph-0-us-5 | Persistent anonymous device identifier on first launch | Parent | — | Done |
| ph-0-us-6 | Firestore schema and security rules scoped to device identity | Backend | ph-0-us-5 | Done |
| ph-0-us-7 | Sign in anonymously and persist device identity on first launch | Frontend | ph-0-us-5 | Done |
| ph-0-us-8 | Basic navigation shell across core sections | Frontend | — | Done |

## Notes
- ph-0-us-1 and ph-0-us-8 have no Backend/Frontend split — both are pure client-side setup
  with no Firebase-side component to divide.
- ph-0-us-2 and ph-0-us-5 are parent stories whose Backend/Frontend children must be
  sequenced Backend-then-Frontend in practice (Firestore rules/provisioning before the
  client code that depends on them), even though both children are recorded here as
  siblings under the same parent.
- Key architectural decision made while detailing this phase: device identity uses Firebase
  **Anonymous Authentication** (`signInAnonymously()`), not a raw client-generated UUID —
  see ph-0-us-6's Context section for why (server-side enforceability via
  `request.auth.uid`). This is the identifier every later phase's per-user Firestore data
  (test attempts, driving sessions, test outcomes) will be scoped under.
- **Navigation**: React Navigation (not Expo Router) — see ph-0-us-8's Tasks for why. Not a
  hard lock-in, just the lower-disruption choice given `App.tsx`'s existing `AuthProvider`
  wiring; revisit if a later phase's needs (e.g. deep linking) push toward Expo Router.
- **Design system**: `src/theme/tokens.ts` mirrors the locked design canvas
  (`docs/design/mockups.md`) — "Teal & Coral" palette, Outfit + Plus Jakarta Sans type, 4px
  spacing/radius scale. All new screens/components should pull from these tokens rather than
  hand-picking colors/sizes; if the canvas's locked choices change, migrate `tokens.ts` (and
  grep for any hardcoded values that drifted from it) rather than letting the two diverge.
- **Known gaps carried out of Phase 0, not blockers**: ph-0-us-1's iOS native project
  (`ios/`) isn't generated (needs macOS/Linux or EAS Build — this repo is worked from
  Windows); ph-0-us-7's offline/no-connection path is implemented but not device-tested
  (no airplane-mode run performed).
