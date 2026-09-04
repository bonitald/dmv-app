# Wire the Firebase SDK into the Expo app

**ID:** ph-0-us-4
**Layer:** Frontend
**Parent:** ph-0-us-2
**Status:** Not Started

## Story
As a developer,
I want the Firebase SDK integrated into the Expo app with environment-based config,
So that the app can read/write Firestore and log Analytics events, and automatically points
at the right Firebase project per build environment.

## Context
- **Product area**: Phase 0 — Project Foundations
- **Layer**: Frontend (Expo/React Native)
- Uses the React Native Firebase SDK (native modules, not the Firebase JS SDK) since the
  project is already committed to a custom dev client / prebuild workflow per ph-0-us-1 —
  the JS SDK's web-only limitations aren't a constraint here.

## Acceptance Criteria
- [ ] Given the app starts in local development, when it initializes Firebase, then it
  connects to the **dev** project (ph-0-us-3) by default — never staging or prod.
- [ ] Given a build is created for a specific environment (dev/staging/prod), when
  environment variables are read, then the correct project's config is loaded without a
  code change — only an env-var/build-profile change.
- [ ] Given Firebase config values are needed, when the app is built, then they're sourced
  from `.env` files already covered by the repo's `.gitignore` — no API keys or project IDs
  are hardcoded in source.
- [ ] Given the SDK is wired up, when a developer calls a basic Firestore read/write (e.g. a
  smoke-test write to a scratch collection) and logs a test Analytics event, then both
  succeed against the dev project, confirming the wiring works end-to-end.

## UI/UX Notes
- **Screens/flows**: No user-facing UI in this story — purely SDK initialization/config.
- **Empty/error/offline states**: If Firebase fails to initialize (bad config, no network on
  first launch), the app should not crash outright — log the error and let later phases
  define specific offline/error UX as their own features touch Firestore.

## Dependencies
- **Blocked by**: ph-0-us-1 (custom dev client scaffold, since React Native Firebase
  requires native modules), ph-0-us-3 (a provisioned Firebase project to point at).
- **Parent**: ph-0-us-2 — this is the "wired" half of "provisioned and wired."
- **Backed by**: ph-0-us-3. Not yet built as of this story's authoring — sequence ph-0-us-3
  before this story in implementation.

## Test Notes
- **Happy path**: App launches, Firebase initializes against dev, a smoke-test Firestore
  write and Analytics event both succeed, confirmed via the Firebase console.
- **Edge cases**: Switching build profiles (dev → staging) via env vars correctly changes
  which project the app talks to, verified by checking the console for each.
- **Failure modes**: Missing/malformed `.env` values fail loudly at build or startup time
  (clear error) rather than silently connecting to the wrong project or failing every
  Firestore call with an opaque error later.

## Tasks
- [ ] Install and configure `@react-native-firebase/app`, `@react-native-firebase/firestore`,
  and `@react-native-firebase/analytics`, plus their required Expo config plugins.
- [ ] Add `.env.development` / `.env.staging` / `.env.production` (or the project's chosen
  env-file convention) holding each environment's Firebase config, gitignored.
- [ ] Wire env-based config loading so the correct Firebase project is selected per build
  profile.
- [ ] Add a one-off smoke test (Firestore write + Analytics event) to confirm the wiring,
  then remove or gate it behind a dev-only debug screen.

## Questions
- None outstanding.
