# Phase 0: Project Foundations — Summary

## Status: Not Started

## Stories

| ID | Title | Layer | Parent | Status |
|----|-------|-------|--------|--------|
| ph-0-us-1 | Expo project scaffolded with custom dev client | Frontend | — | Done |
| ph-0-us-2 | Firebase project provisioned and wired into the app | Parent | — | Not Started |
| ph-0-us-3 | Provision the Firebase project (Firestore, Hosting, Analytics) | Backend | ph-0-us-2 | Done |
| ph-0-us-4 | Wire the Firebase SDK into the Expo app | Frontend | ph-0-us-2 | Not Started |
| ph-0-us-5 | Persistent anonymous device identifier on first launch | Parent | — | Not Started |
| ph-0-us-6 | Firestore schema and security rules scoped to device identity | Backend | ph-0-us-5 | Not Started |
| ph-0-us-7 | Sign in anonymously and persist device identity on first launch | Frontend | ph-0-us-5 | Not Started |
| ph-0-us-8 | Basic navigation shell across core sections | Frontend | — | Not Started |

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
