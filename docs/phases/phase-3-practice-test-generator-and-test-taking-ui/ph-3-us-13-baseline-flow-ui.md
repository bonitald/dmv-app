# Baseline flow: intro, sections, "keep going?" and resume

**ID:** ph-3-us-13
**Layer:** Frontend
**Parent:** ph-3-us-12
**Status:** In Progress (code-complete 2026-09-25, Slice 2; device test pending the published baseline. Per the 2026-09-25 decision the baseline card lives on Home, not the Practice tab, which stays a placeholder until Slice 5)

## Story
As a teen user,
I want a short intro to the baseline, a check-in after each section, and a clear way to pick it
up where I left off,
So that the baseline feels quick and low-pressure and I never lose my place.

## Context
- **Product area**: Phase 3 (`docs/phases.md`, seventh bullet).
- **Layer**: Frontend (Expo/React Native).
- Backed by Phase 1 functions, both built (contracts in `functions/README.md`):
  - `startOrResumeBaseline()` — no input. Returns `{ testId: 'baseline-v1-<n>', version, section,
    totalSections: 3, questions[15] }`. Calling it again before submitting returns the same
    section. Errors: `already-exists` (baseline already completed), `failed-precondition`
    (baseline not published, or references a deleted question — a content problem, not the
    user's).
  - `scoreTest({ testId, answers })` — grades the section and advances progress. For sections 1–2,
    `perQuestion` has `correctAnswer: null`. Section 3's response adds `baselineReview` for all 45
    questions.
- The client can read `users/{uid}/baseline/progress` (`currentSection`, `completedAt`) to show
  the right state without calling a function. No doc means "not started".
- Uses the shared runner from ph-3-us-4. Mid-section force-quit resilience comes from
  ph-3-us-1 (a section's answers are cached locally; the server keeps the section position).
- **Journey entry points**: (1) Phase 9's first-run "test what I know" choice; (2) the baseline
  card on the Practice tab home. Expose one navigation route (e.g. `Baseline`) that both use.
- Always untimed (ph-3-us-7).

## Acceptance Criteria
- [ ] Given the Practice tab home, when it loads, then a baseline card shows one of three states
  from `baseline/progress`: not started ("Find your starting point — 45 questions in 3 short
  sections"), in progress ("Resume — section 2 of 3"), or complete ("Baseline done — see your
  results").
- [ ] Given a user starts the baseline for the first time, when the intro screen shows, then it
  explains: 3 sections of 15, one question per handbook topic, you can take a break between
  sections, it's a starting point not a pass/fail, and it's based on the Colorado handbook
  (ph-3-us-11).
- [ ] Given the user taps Start or Resume, when `startOrResumeBaseline` returns, then the
  section's questions open in the runner with a "Section N of 3" header.
- [ ] Given the user submits section 1 or 2, when `scoreTest` returns, then a check-in screen
  shows "Section N done" with two choices: "Keep going" (starts the next section) and "Take a
  break" (back to the Practice tab, card shows Resume). It shows no score or right/wrong at this
  point.
- [ ] Given the user submits section 3, when `scoreTest` returns with `baselineReview`, then they
  go to the baseline results screen (ph-4-us-6; minimal placeholder until then).
- [ ] Given `startOrResumeBaseline` returns `already-exists`, when the user tries to start, then
  they're taken to the completed state/results, not shown an error.
- [ ] Given `startOrResumeBaseline` returns `failed-precondition`, when the user tries to start,
  then they see "The baseline isn't available right now — try a practice test instead", and the
  error is logged for us.
- [ ] Given the user leaves mid-section, when they come back, then they resume the same section
  (answers restored if ph-3-us-1's cache has them; otherwise the section starts again).
- [ ] Given the user is offline, when they try to start or resume, then they see the standard
  no-connection state with retry.

## UI/UX Notes
- **Screens/flows**: Practice tab home (baseline card) or Phase 9 first-run → baseline intro →
  runner (section N) → check-in → next section or back to Practice tab → after section 3 →
  baseline results (Phase 4).
- Check-in screen: short, encouraging, a visible 3-step progress (e.g. ●●○), two equal-weight
  buttons. It's a break point, not a nudge to continue.
- The intro only shows before section 1. Resuming goes straight into the section.

## Dependencies
- **Parent**: ph-3-us-12 — the user-facing baseline flow.
- **Backed by**: `startOrResumeBaseline` (ph-1-us-8) and `scoreTest` (ph-1-us-11), both built.
- **Blocked by**: ph-3-us-4 (runner, callable wrappers, `@react-native-firebase/functions`).
- **Works with**: ph-3-us-1 (mid-section resilience), Phase 4 (baseline results screen), Phase 9
  (first-run entry).

## Test Notes
- **Happy path**: intro → section 1 → keep going → section 2 → take a break → relaunch → resume
  section 3 → results.
- **Edge cases**: kill the app mid-section 2 and relaunch; complete sections on two devices
  (second device resumes at the server's section); tapping Start twice quickly (one call);
  completed user opening the baseline route from a stale screen.
- **Failure modes**: offline at start; offline at submit (answers kept, retry — ph-3-us-4);
  `already-exists`; `failed-precondition`.

## Tasks
- [ ] Add a `useBaselineProgress()` hook reading `users/{uid}/baseline/progress`.
- [ ] Build the baseline card on the Practice tab home (3 states).
- [ ] Build the intro and check-in screens.
- [ ] Wire start/resume → runner → `scoreTest` → check-in or results, via one `Baseline` route
  that Phase 9 can also navigate to.
- [ ] Handle `already-exists`, `failed-precondition`, and offline.
- [ ] Minimal baseline results placeholder until Phase 4.

## Questions
- **No score between sections** is assumed, to keep the check-in low-pressure. `scoreTest` does
  return a section score (and per-topic right/wrong is technically visible), so showing "8 of 15"
  there is possible if you'd rather.
