# Expo project scaffolded with custom dev client

**ID:** ph-0-us-1
**Layer:** Frontend
**Status:** In Progress (2026-09-04) — scaffolded, `android/` generated via prebuild, TS clean;
blocked on device/emulator verification and iOS native-dir generation, see Tasks below.

## Story
As a developer,
I want an Expo-managed React Native project scaffolded via `expo prebuild` with a custom
dev client (not Expo Go),
So that subsequent phases have a working project to build in, already set up for the native
modules Phase 6 (Driving Time Logger) will need.

## Context
- **Product area**: Phase 0 — Project Foundations
- **Layer**: Frontend (project scaffold; no backend component)
- `docs/phase-0-findings.md` establishes that the driving-timer persistent indicator (iOS
  Live Activity / Android foreground service) requires a custom dev client and config
  plugins, and specifically **cannot** be built inside Expo Go. Scaffolding straight onto
  the custom-dev-client path now avoids an expensive migration later once Phase 6 starts.
- No split into Backend/Frontend children — this story is pure project setup with no
  Firebase-side component to divide it from.

## Acceptance Criteria
- [ ] Given a fresh clone of the repo, when a developer runs the project's install + start
  commands, then the app builds and launches on a custom dev client (iOS simulator/device
  and Android emulator/device) — not Expo Go.
- [ ] Given the project is scaffolded, when `expo prebuild` has been run, then the
  `ios/` and `android/` native directories exist and are checked in (or the project's chosen
  convention for native-dir tracking is documented), consistent with the CNG (Continuous
  Native Generation) workflow described in `docs/phase-0-findings.md`.
- [ ] Given the scaffold is complete, when a developer looks for a config-plugin entry
  point, then the project's `app.json`/`app.config.ts` already has a `plugins` array ready
  to receive Phase 6's Live Activity / foreground-service config plugins without a
  structural rework.
- [ ] Given the project is scaffolded, when TypeScript is checked, then the project
  compiles with zero errors on the default template's own code (baseline, before any
  feature code is added).

## UI/UX Notes
- **Screens/flows**: N/A — this story produces the default Expo template screen only;
  Phase 0's actual navigation shell is ph-0-us-8.
- **Empty/error/offline states**: N/A.

## Dependencies
- **Blocked by**: None — this is the first story in the project.

## Test Notes
- **Happy path**: `npx expo run:ios` and `npx expo run:android` both succeed on a clean
  machine after following the repo's README setup steps.
- **Edge cases**: A developer without Xcode/Android Studio installed gets a clear, actionable
  error (missing toolchain) rather than an opaque build failure.
- **Failure modes**: `expo prebuild` regenerating native directories in a way that silently
  drops a manually-added config-plugin entry — guard by keeping all native customization
  expressed as config plugins in `app.config.ts`, not hand-edited native files, so prebuild
  stays reproducible.

## Tasks
- [x] Run `npx create-expo-app` (or equivalent) to scaffold the project.
- [x] Run `expo prebuild` to generate native projects; commit per the repo's chosen
  native-dir convention. **Partial**: `android/` generated and committed. `ios/` could not
  be generated — Expo CLI's iOS prebuild step requires macOS or Linux and this repo is
  worked on from Windows; documented as a known gap in README with the fix (run from
  macOS/Linux, or use EAS Build per `docs/phase-0-plan.md` Section D).
- [ ] Set up a custom dev client build (`expo run:ios` / `expo run:android` or EAS dev
  client build) and confirm both platforms launch. **Not verified**: `expo-dev-client` is
  installed and `npm run android`/`npm run ios` scripts point at `expo run:*`, but this
  machine has the Android SDK without a JDK on PATH, so `expo run:android` hasn't actually
  been executed/verified here. iOS is unrunnable from Windows regardless. Needs a
  JDK (and ideally Android Studio's emulator) to close out.
- [x] Add TypeScript config and confirm a clean `tsc` run. `npx tsc --noEmit` passes with
  zero errors on the scaffold's own code.
- [x] Document the setup/run commands in the project README, since none exist yet.

## Questions
- None outstanding.
