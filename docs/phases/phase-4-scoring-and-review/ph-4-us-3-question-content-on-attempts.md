# Save question text, choices and explanation on graded attempts

**ID:** ph-4-us-3
**Layer:** Backend
**Parent:** ph-4-us-2
**Status:** Code complete (Slice 3, 2026-09-29; dev deploy and device test pending)

## Story
As a developer,
I want `scoreTest` to include each question's text, choices and (if present) explanation in its
graded results and saved attempt,
So that the app can show a full review of any past test without reading the `questions`
collection.

## Context
- **Product area**: Phase 4 (`docs/phases.md`, second bullet).
- **Layer**: Backend (Cloud Functions, question schema, ingestion validation).
- `scoreTest`'s `gradeQuestions` (`functions/src/scoreTest.ts`) already reads every assigned
  question doc to grade it, so adding `text` / `choices` / `explanation` to each
  `PerQuestionResult` costs no extra reads.
- **Extraction check**: this exposes nothing new. An attempt only covers questions the user was
  already handed by an assemble function, and each `testId` can only be graded once. The
  baseline's held-back answers rule is unchanged: sections 1–2 still get `correctAnswer: null`,
  `correct: null` and **no `explanation`** (it would give the answer away). Text and choices are
  fine there, since the user just saw them.
- **Explanations**: add an optional `explanation` string to the `Question` schema (paraphrased,
  like everything else — `prd.md` Section 8's no-verbatim rule applies). This story makes the
  field valid and passes it through. Writing explanations for the existing 1,415 questions is a
  content task, not engineering (see Questions).
- Follows the `cloud-function-documentation` skill.
- **Decided during Slice 3 implementation** (`docs/superpowers/plans/2026-09-28-slice-3-results.md`):
  - Each entry also carries `type` (`fact` / `scenario` / null), so the review keeps the scenario
    badge (ph-4-us-4).
  - Baseline choices are saved in the seeded order the user was shown (`baselineChoices` in
    `functions/src/shuffle.ts`, shared with `startOrResumeBaseline`). Practice-test and mini-quiz
    choices are in stored order, since their shuffle isn't recorded; Slice 5 can record it on the
    assignment if it matters.
  - `baselineReview` takes text and choices from re-reading the question docs (which grading
    already does), not from the earlier sections' attempts. Same result for the user, and it
    also works for attempts saved before this change.

## Acceptance Criteria
- [x] Given a practice test or mini-quiz is graded, when `scoreTest` returns and saves the
  attempt, then each `perQuestion` entry also has `text` and `choices`, plus `explanation` when
  the question has one.
- [x] Given a baseline section before the last is graded, when `perQuestion` is built, then it
  has `text` and `choices`, but `correctAnswer`, `correct` and `explanation` stay null/absent.
- [x] Given the final baseline section is graded, when `baselineReview` is built, then every one
  of the 45 entries has `text`, `choices`, `correctAnswer`, `correct`, and `explanation` where
  present. Earlier sections' text and choices are taken from their saved attempts; explanations
  and answers are re-read from the question docs.
- [x] Given a question is `unavailable` (deleted), when results are built, then `text`,
  `choices` and `explanation` are null, as its other fields already are.
- [x] Given a question doc has `explanation` that isn't a non-empty string, when it's graded,
  then `explanation` is left out rather than sending bad data.
- [x] Given the ingestion pipeline writes a question with an `explanation`, when
  `validate.ts` runs, then an optional non-empty string is accepted and anything else is
  rejected. Questions without one stay valid.

## Data and API
- **Firestore schema**: `questions/{id}.explanation?: string` (optional, paraphrased).
- **Cloud Functions**: `scoreTest` — `PerQuestionResult` gains `text: string | null`,
  `choices: string[] | null`, `explanation?: string`. Same fields in the response,
  `testAttempts/{testId}.perQuestion`, and `baselineReview`.
- **Other readers**: `getFlashcards`, `assembleTest`, `assembleMiniQuiz`, and
  `startOrResumeBaseline` must **not** return `explanation` (it would give away answers before
  grading, and flashcards show only the correct answer per ph-2-us-3). Add a test to each that
  asserts it's absent.
- **Security rules**: no changes.

## Dependencies
- **Blocked by**: ph-1-us-11 (Complete).
- **Parent**: ph-4-us-2 — the data a review screen needs.
- **Consumed by**: ph-4-us-4 (review), ph-4-us-5 (missed questions), ph-2-us-9 (mini-quiz
  results).

## Test Notes
- **Happy path**: a graded practice test's response and saved attempt both carry text/choices,
  and explanations where seeded.
- **Edge cases**: a question with no explanation; baseline sections 1–2 (no explanation, no
  answer); final baseline section's `baselineReview` (all 45 complete); `unavailable` question.
- **Failure modes**: malformed `explanation` omitted; the assemble functions never leak
  `explanation`.

## Tasks
- [x] Add optional `explanation` to `scripts/question-bank/lib/types.ts` and `validate.ts`, with
  tests (`npm run test:question-bank`).
- [x] Extend `PerQuestionResult` and `gradeQuestions` in `scoreTest`; handle baseline withholding
  and `baselineReview`.
- [x] Extend `functions/src/scoreTest.test.ts`, and add "no explanation" assertions to the
  assemble/flashcard function tests (`npm run test:functions`).
- [x] Update `functions/README.md` (`scoreTest` output and persistence) and the question-bank
  README (new field).

## Questions
- **Writing explanations** for the existing bank is a content task: generate a short, paraphrased
  "why" per question, reviewed like the questions themselves, then re-run the write/apply-review
  tooling. Not scheduled yet. Until then, the review falls back to "From the handbook: <topic
  title>" (ph-4-us-4).
- Attempts saved before this ships have no text. There are no real users yet, so no backfill is
  planned; the review screen just shows "question text unavailable" for those.
