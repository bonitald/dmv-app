# Test-taking screen (shared quiz runner)

**ID:** ph-3-us-4
**Layer:** Frontend
**Parent:** ph-3-us-2
**Status:** Not Started

## Story
As a teen user,
I want a clear screen for answering a test one question at a time and submitting it when I'm
done,
So that taking a practice test on my phone feels like the real thing and I don't lose answers or
submit by accident.

## Context
- **Product area**: Phase 3 (`docs/phases.md`, first bullet).
- **Layer**: Frontend (Expo/React Native).
- **This story owns the shared quiz runner**: the quiz question card (question + choices, no
  answer reveal) and the runner around it (navigation, answer state, unanswered warning,
  submit). It serves three session kinds, all graded by the same `scoreTest`:
  - practice test — `assembleTest` (ph-1-us-4, with ph-3-us-3's mix)
  - baseline section — `startOrResumeBaseline` (ph-1-us-8), flow in ph-3-us-13
  - concept mini-quiz — `assembleMiniQuiz` (ph-1-us-7), flow in ph-2-us-8
  All three return the same question shape (`id`, `text`, `choices`, `type`, `chunkId`,
  `conceptId`, no answers). The runner takes the questions and a submit handler; each flow owns
  how it fetches and what happens after grading.
- In journey order the baseline comes first (first-run "test what I know", Phase 9), so this
  runner is probably first used by ph-3-us-13, not the practice test.
- Flashcards (ph-2-us-3) are a different component (flip card, no choices). The quiz card shares
  their styling and the scenario badge (ph-2-us-5), per the Scenario question card mockup
  (`docs/design/mockups.md`).
- The app can't call Cloud Functions yet: `@react-native-firebase/functions` isn't installed
  (native module; requires rebuilding the dev client). This is likely the first story that
  needs it, so it adds it, plus the typed callable client wrappers (`assembleTest`,
  `startOrResumeBaseline`, `assembleMiniQuiz`, `scoreTest`) with error codes mapped to UI states.
- Offline and force-quit resilience for this screen is ph-3-us-1, which hooks into it. Timed mode
  is ph-3-us-9.
- After grading, the runner hands the `scoreTest` result to a results screen. The practice
  results screen is ph-4-us-1 and answer review is ph-4-us-4. If this story ships first, a minimal
  "score + back" screen is enough until they land.

## Acceptance Criteria
- [ ] Given the teen user opens the Practice tab, when it loads, then it shows "Start a practice
  test" (replacing the tab's `PlaceholderScreen`), plus the baseline entry from ph-3-us-13.
- [ ] Given the user starts a practice test, when `assembleTest` returns, then the first
  question shows with its choices and a progress indicator ("Question 1 of 25").
- [ ] Given a question is showing, when the user taps a choice, then it's selected (and can be
  changed), with no right/wrong or correct answer shown.
- [ ] Given a test is in progress, when the user moves forward or back, then they can go to any
  question, and earlier answers are kept.
- [ ] Given some questions are unanswered, when the user taps Submit, then they're warned how many
  are unanswered and can go back or submit anyway (unanswered count as wrong, per `scoreTest`).
- [ ] Given the user submits, when `scoreTest` returns, then the result is passed to the results
  screen (Phase 4, or the minimal placeholder).
- [ ] Given the user tries to leave mid-test (back button or tab switch), when that happens, then
  they're asked to confirm. Leaving keeps the test resumable (ph-3-us-1) instead of discarding it
  silently.
- [ ] Given `assembleTest` fails (offline or error), when the user starts a test, then they see a
  retry state, not a blank screen.
- [ ] Given `scoreTest` fails because the device is offline, when the user submits, then the
  answers are kept and they can retry.
- [ ] Given `scoreTest` returns `already-exists` (a double submit), when that happens, then the
  user is shown the saved attempt's result, not an error.
- [ ] Given a `scenario` question, when it renders, then it gets the scenario treatment
  (ph-2-us-5), and long text scrolls without truncation.

## UI/UX Notes
- **Screens/flows**: Practice tab home → test runner → results (Phase 4). The same runner is
  pushed from the baseline flow (ph-3-us-13) and the Study stack's mini-quiz (ph-2-us-8).
- Big tap targets for choices; a sticky Next/Submit bar; a question-number strip or grid to jump
  to unanswered questions.
- **Empty/error/offline states**: per Acceptance Criteria. Use the `NoConnectionScreen` pattern
  from `App.tsx`.

## Dependencies
- **Parent**: ph-3-us-2 — the frontend half of "start a practice test".
- **Backed by**: `assembleTest` (ph-1-us-4, built; mix added by ph-3-us-3), `scoreTest`
  (ph-1-us-11, built).
- **Used by**: ph-3-us-13 (baseline), ph-2-us-8 (mini-quiz), ph-3-us-1 (cache), ph-3-us-9 (timer).

## Test Notes
- **Happy path**: start → answer all 25 → submit → result.
- **Edge cases**: change an answer; submit with some unanswered; very long scenario question;
  fewer than 25 questions returned; rapid double-tap on Submit (one `scoreTest` call).
- **Failure modes**: offline at start; offline at submit; `already-exists` on submit; function
  timeout.

## Tasks
- [ ] Add `@react-native-firebase/functions` and rebuild the dev client (if not already done).
- [ ] Add `src/api/` typed wrappers for the four callables with error-code → UI-state mapping.
- [ ] Build the quiz question card (choices, selected state, scenario variant hook).
- [ ] Build the runner (navigation, answer state, question strip, unanswered warning, submit,
  leave confirmation) as a reusable component taking `questions` + `onSubmit`.
- [ ] Build the Practice tab home and wire the practice-test flow.
- [ ] Add a minimal results placeholder until Phase 4's results screen lands.
- [ ] Add a `jest-expo` config (`jest.app.config.js` is Node-only) and component-test the runner
  (if ph-2-us-3 hasn't already).

## Questions
- Should a practice test show right/wrong after each question (study-style) as an option? Assumed
  no: the real test doesn't, and Phase 4's review covers learning from misses.
