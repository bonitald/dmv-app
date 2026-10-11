# Concept mini-quiz after its flashcards

**ID:** ph-2-us-8
**Layer:** Parent
**Status:** Complete (Slice 4b, 2026-10-11)

## Story
As a teen user,
I want each concept to end with a short quiz on that concept only, after I've gone through its
flashcards,
So that I can check I actually learned it before moving on.

## Context
- **Product area**: Phase 2 (`docs/phases.md`, sixth bullet); `prd.md` Section 5 "Concept
  learning path": each concept is its flashcards followed by a short mini-quiz. For MVP the
  concept's "lesson" is its flashcards (`prd.md` Section 4, post-MVP lessons).
- **Layer**: Frontend (Expo/React Native). No Backend split: the functions exist.
  - `assembleMiniQuiz({ chunkId, count?, excludeIds? })` (ph-1-us-7): up to 10 approved
    questions from the topic, **no answers**, persisted as `users/{uid}/testAssignments/{testId}`.
  - `scoreTest({ testId, answers })` (ph-1-us-11): grades it and returns `score`, `perQuestion`
    (with correct answers) and `recommendation` (`move-on` at ≥ 80%, otherwise `review-again`).
    It can grade each `testId` only once.
- The quiz uses its own question card: question plus choices. It records the choice and reveals
  nothing until grading. Answers only come back from `scoreTest`. This is where choices appear:
  flashcards (ph-2-us-3) show only the question and its correct answer. The quiz card shares
  styling and the scenario badge (ph-2-us-5) with the flashcard, and is reused by Phase 3 tests.
- **The quiz runner is owned by ph-3-us-4** (test-taking screen): quiz question card,
  navigation, unanswered warning, submit, callable wrappers. This story plugs the mini-quiz
  into it; it doesn't build its own. Offline / force-quit resilience for all quizzes
  (`testCache.ts`) is ph-3-us-1.
- The quiz is offered at the end of the deck, next to "Start this concept over" (ph-2-us-3);
  it's not forced. A user can also start it straight from a topic without doing the flashcards
  (free navigation, `prd.md` Section 5).
- The quiz is where per-question misses come from: the `scoreTest` result is recorded locally
  (ph-2-us-6) so the next pass through the flashcards puts missed cards first (ph-2-us-4).

## Acceptance Criteria
- [x] Given the user reaches the end of a topic's flashcards (ph-2-us-3), when they choose
  "Take the quiz", then `assembleMiniQuiz` is called for that `chunkId` and the first question
  shows.
- [x] Given a quiz is in progress, when the user answers a question, then no right/wrong or
  correct answer is shown until the quiz is submitted.
- [x] Given the user has answered every question, when they submit, then answers go to
  `scoreTest` and the results screen (ph-2-us-9) shows the score and which questions were missed,
  with the correct answers.
- [x] Given `scoreTest` returns, when the result arrives, then its `perQuestion` results are
  recorded locally (ph-2-us-6).
- [x] Given the user skips questions and submits, when it's graded, then skipped questions count
  as wrong (per `scoreTest`) and the user is warned about unanswered questions before submitting.
- [x] Given the user retakes a topic's quiz, when `assembleMiniQuiz` is called again, then the
  previous quiz's question IDs are passed as `excludeIds`, so the retake avoids immediate
  repeats where the topic is big enough.
- [x] Given `scoreTest` fails because the device is offline, when the user submits, then their
  answers are kept on screen with a retry option, not lost.
- [x] Given the topic has fewer than 10 approved questions, when the quiz is assembled, then it
  runs with however many there are.

## UI/UX Notes
- **Screens/flows**: flashcard end-of-deck → mini-quiz → results (ph-2-us-9). Also reachable
  from a topic's entry point without doing the flashcards first.
- Progress indicator ("Question 3 of 10"), back/forward between questions before submitting.
- Leaving mid-quiz asks for confirmation. The unscored assignment can simply be abandoned; a new
  quiz gets a new `testId`.
- **Empty/error/offline states**: `not-found` from `assembleMiniQuiz` (no approved questions)
  shouldn't happen from the list (ph-2-us-7 disables empty topics), but show "nothing here yet"
  if it does.

## Dependencies
- **Blocked by**: ph-1-us-7 and ph-1-us-11 (Complete); ph-3-us-4 (quiz runner, callable
  wrappers, `@react-native-firebase/functions`); ph-2-us-3 (end-of-deck entry point).
- **Leads to**: ph-2-us-9 (results + recommendation).
- **Shares with**: ph-3-us-4 (runner) and ph-3-us-1 (cache resilience).

## Test Notes
- **Happy path**: flashcards → quiz → submit → results with correct answers for misses.
- **Edge cases**: topic with 1–9 approved questions; retake with `excludeIds` on a small topic
  (repeats are unavoidable, allowed); all questions skipped.
- **Failure modes**: offline at assemble (retry state); offline at submit (answers kept, retry);
  double-submit (`already-exists` from `scoreTest`) shows the existing result, not an error.

## Tasks
- [x] Use the `assembleMiniQuiz` / `scoreTest` wrappers from ph-3-us-4.
- [x] Plug the mini-quiz into ph-3-us-4's runner (fetch via `assembleMiniQuiz`, submit via
  `scoreTest`).
- [x] Wire end-of-deck → quiz, and quiz → results (ph-2-us-9).
- [x] Record `perQuestion` via ph-2-us-6's `recordQuizResults` when grading returns.
- [x] Track the last quiz's question IDs per topic in memory for `excludeIds`.
- [x] Handle offline/assemble/submit errors per Acceptance Criteria.

## Implementation notes (Slice 4b)
Built in Slice 4b on `feat/mini-quiz-progress`; plan `docs/superpowers/plans/2026-10-11-slice-4b-mini-quiz-progress.md`, design `docs/superpowers/specs/2026-10-11-slice-4b-mini-quiz-progress-design.md` (including its Amendment A1-A7 from device testing). Device-tested on the Android emulator 2026-10-11.
- **Quiz size is scaled on the server** (supersedes "up to 10"): `assembleMiniQuiz` returns `round(approved / 3)` questions, at least 5 and at most 15, or the whole pool if the topic has fewer than 5. The app sends no `count`. The "fewer than 10 approved" criterion is met by the whole-pool rule.
- **No force-quit resume:** mini-quizzes stay out of `quizSession` (it holds one active test per user, so a mini-quiz would drop an in-progress baseline; spec decision 6). A killed quiz is abandoned and a new one gets a new `testId`. Offline at submit still keeps the answers on screen. ph-3-us-1 no longer covers mini-quizzes.
- **Skip to quiz** sits beside the "N of M" counter on every card.
- **Confirm before submit (ph-3-us-4):** Submit appears on any question once all are answered, and every submit asks for confirmation: "All questions have been answered. Are you ready to submit?" (Not yet / Submit); with skipped questions it says "N unanswered". This replaces the unanswered-only warning in the criterion above.
- Retakes pass the previous quiz's question ids as `excludeIds`, held in memory per topic. Leaving mid-quiz asks "Leave the quiz?".
- Built on the shared runner from ph-3-us-4. Results are ph-2-us-9.

## Questions
- Should starting a quiz without doing the flashcards be offered on the concept list itself, or
  only inside the topic? Decided (Slice 4b): a "Skip to quiz" link beside the card counter on every card of the flashcard viewer (first built on the first card only, then changed to every card after device testing).
