# Wire the Firebase SDK into the Expo app

**ID:** ph-0-us-4
**Layer:** Frontend
**Parent:** ph-0-us-2
**Status:** In Progress (2026-09-08) — SDK wired and verified end-to-end on Android emulator;
still blocked on the final "Firestore write succeeds" half of AC4. ph-0-us-6 (rules) is now
done and deployed to dev, but the smoke test writes to a scratch `_smoke_test/` collection
from an unauthenticated client (no `signInAnonymously()` yet — that's ph-0-us-7), so it's
still correctly outside `firestore.rules`' `users/{uid}` allow rule and still gets
`permission-denied`. That's still expected, not a bug — full closure needs ph-0-us-7. See
Tasks/Test Notes below.

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
- [x] Given the app starts in local development, when it initializes Firebase, then it
  connects to the **dev** project (ph-0-us-3) by default — never staging or prod.
  `app.config.ts` defaults `APP_ENV` to `development`, which maps to `firebase-config/dev/`.
  Confirmed via logcat: `FirebaseInitProvider: FirebaseApp initialization successful`
  against `dmv-app-dev`.
- [x] Given a build is created for a specific environment (dev/staging/prod), when
  environment variables are read, then the correct project's config is loaded without a
  code change — only an env-var/build-profile change. `APP_ENV=production` (via new
  `npm run android:prod` / `ios:prod` scripts, using `cross-env`) switches `app.config.ts`
  to `firebase-config/prod/` with no code change. No separate staging Firebase project
  exists yet (see `docs/phase-0-plan.md`), so `staging` currently maps to the dev project's
  config — noted in `app.config.ts` as a placeholder, not a real 3-way split yet.
- [x] Given Firebase config values are needed, when the app is built, then they're sourced
  from `.env` files already covered by the repo's `.gitignore` — no API keys or project IDs
  are hardcoded in source. **Implementation deviates slightly from literal `.env.*` files**:
  the actual secrets live in `firebase-config/{dev,prod}/` (the native `google-services.json`
  / `GoogleService-Info.plist` files handed off in `docs/phase-0-plan.md` Section C), which
  is gitignored wholesale — nothing in source (`app.config.ts` included) contains an API key
  or project ID literal. The only env var involved is `APP_ENV`, which selects *which*
  gitignored config directory to use; there was no other per-environment key/value data to
  justify separate `.env.development`/`.env.production` files on top of that. Flagging this
  as a deliberate scope call, not an oversight — revisit if a later story needs actual env
  var secrets (e.g. non-Firebase API keys).
- [~] Given the SDK is wired up, when a developer calls a basic Firestore read/write (e.g. a
  smoke-test write to a scratch collection) and logs a test Analytics event, then both
  succeed against the dev project, confirming the wiring works end-to-end. **Analytics: verified**
  (`logEvent` call completes without error). **Firestore: blocked, as expected** — the
  smoke-test write to `_smoke_test/ph-0-us-4` gets `[firestore/permission-denied]` because
  Firestore is still locked deny-all per ph-0-us-3's AC (rules aren't defined until
  ph-0-us-6). This confirms the SDK is correctly wired to the real dev project (a
  misconfigured project would fail differently, e.g. `not-found`/network error, not a rules
  rejection) — full read/write success is deferred to ph-0-us-6/7 once rules exist.

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
- [x] Install and configure `@react-native-firebase/app`, `@react-native-firebase/firestore`,
  and `@react-native-firebase/analytics`, plus their required Expo config plugins.
  Also required adding `metro.config.js` with `resolver.unstable_enablePackageExports = true`
  — without it, Metro can't resolve React Native Firebase v22+'s package.json `exports` map
  and the app crashed on bundle load (`Unable to resolve module ../common/index.js`). Not
  called out in this story's original Tasks list, but a hard blocker without it.
- [x] Add `.env.development` / `.env.staging` / `.env.production` (or the project's chosen
  env-file convention) holding each environment's Firebase config, gitignored. See AC3 note
  above — implemented as an `APP_ENV` var selecting a gitignored `firebase-config/<env>/`
  directory instead of literal `.env.*` files, since there's no other key/value config yet.
- [x] Wire env-based config loading so the correct Firebase project is selected per build
  profile. Done via `app.config.ts` (replacing the static `app.json`).
- [x] Add a one-off smoke test (Firestore write + Analytics event) to confirm the wiring,
  gated behind `__DEV__` in `App.tsx`. Not yet removed — left in place until ph-0-us-6/7
  give it something real to be replaced by.

## Questions
- None outstanding.
