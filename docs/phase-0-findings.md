# Phase 0 Spike Findings: Driving-Timer Persistent Indicator

_Date: 2026-08-28_

Research pass answering the open questions from `prd.md` Section 9 ("Planned
spike: driving-timer persistent indicator"). Covers the persistent visible
indicator for the driving-time logger feature: iOS Live Activity, Android
foreground service, Expo feasibility, accuracy/reliability, and a fallback
option.

## iOS — Live Activity / Dynamic Island
- Achievable inside Expo's tooling without a full bare React Native eject.
  Path: `expo prebuild` + a config plugin (`@bacons/apple-targets` /
  `expo-apple-targets`, or the newer
  `software-mansion-labs/expo-live-activity`) that generates a native Widget
  Extension target, plus hand-written Swift for the widget UI itself.
- Cost: loses Expo Go (requires a custom dev client build), and requires some
  native Swift code for the widget. Stays within Expo's Continuous Native
  Generation (CNG) workflow — materially less work than a bare RN eject.
- Accuracy when working: the standard pattern (`Text(timerInterval:)`) is
  rendered by the OS from a fixed start/end date, not driven by the app's JS
  process — so it keeps ticking correctly even while the app is suspended.
- Known risk: documented iOS 18 bugs where the Live Activity timer freezes
  (a "chronod" issue in Console logs). Workaround is falling back to
  periodic `activity.update()` calls rather than relying purely on the
  auto-ticking timer text. This is a platform stability risk, not an
  architecture problem — worth testing directly on target iOS versions
  before committing.

## Android — foreground service + persistent notification
- Well-trodden pattern (same primitive used by Google Maps, Strava, timer
  apps): a foreground service + a notification using
  `setUsesChronometer(true)` + `setWhen(startTime)`.
- Like iOS, the displayed time is OS-rendered from a timestamp, not the
  app's JS loop — drift-resistant and independent of the app being
  backgrounded.
- Expo's built-in `expo-notifications` does not expose foreground-service
  control directly. Needs `react-native-background-actions` or a small
  custom native module/config plugin.
- Play Store policy (checked current 2026 rules): foreground services are
  only approved for user-initiated, user-perceptible, core functionality
  that can't be deferred by the system — this explicitly includes
  fitness/exercise-tracker-style long-running use cases. A driving-session
  timer fits that pattern well; just declare the correct
  `foregroundServiceType`.

## Expo feasibility
- Neither platform requires ejecting to bare React Native. Both are doable
  via Expo prebuild + config plugins + a custom dev client.
- Real but bounded cost increase: loses Expo Go, adds some native code and a
  custom dev client build step to the workflow — not a framework-level
  fork.

## Accuracy/reliability if the app is killed mid-session
- Safe pattern on both platforms: persist the session start timestamp to
  local storage/DB the instant "start" is tapped, not just an in-memory
  counter.
- Compute the final logged duration from the stored start time vs. the
  actual stop time (or, if the app reopens with a session still marked
  "running," detect that and prompt the user to confirm/adjust) rather than
  trusting a JS timer to have survived a process kill.
- This is standard practice for this kind of feature and makes the log
  resilient regardless of what the OS does to the process — important here
  since this data is meant to be relied on for the actual driving test.

## Fallback if full effort isn't justified for MVP
- The two platforms are not symmetric in cost. Android's foreground-service
  notification is low-effort and robust — worth building regardless of
  what's decided for iOS.
- iOS's Live Activity is the higher-effort, less mature piece. A reasonable
  interim fallback for v1: skip Dynamic Island/lock-screen presence on iOS
  and run an in-app timer (visible only while the app is open), optionally
  paired with a recurring local notification as a "session still running"
  nudge.

## Recommendation
- Build the Android foreground-service + chronometer-notification version
  as planned — low cost, robust, policy-compliant.
- Build the iOS Live Activity version via Expo prebuild + config plugin,
  but budget time for testing against current iOS versions given the known
  timer-freeze bug, and design the driving-log data model so a working
  in-app-only timer (the fallback) is a valid degraded mode rather than a
  blocker — don't let iOS Live Activity polish gate shipping the feature.
- Always persist session start/stop timestamps immediately (not just an
  in-memory timer) on both platforms, regardless of which
  indicator approach ships.
