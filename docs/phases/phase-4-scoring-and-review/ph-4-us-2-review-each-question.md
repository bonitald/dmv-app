# Review every question from a completed test

**ID:** ph-4-us-2
**Layer:** Parent
**Children:** ph-4-us-3 (Backend), ph-4-us-4 (Frontend)
**Status:** Not Started

## Story
As a teen user,
I want to go through each question of a test I've finished, seeing what I picked, the correct
answer, and a short explanation where there is one,
So that I understand why I got things wrong and do better next time.

## Context
- **Product area**: Phase 4 (`docs/phases.md`, second bullet); `prd.md` Section 3 "review missed
  questions".
- **Layer**: cross-cutting.
  - **Backend gap**: saved attempts (`testAttempts`, ph-1-us-11) store `questionId`, `choice`,
    `correctAnswer` and `correct` per question, but **not the question text or its choices**.
    Right after a test the app still has them in memory, but reviewing a past test would need to
    read `questions`, which is deny-all for clients (ph-1-us-1). ph-4-us-3 saves them on the
    attempt.
  - **No explanations exist**: the `Question` schema has no explanation field (`selfCheck` is
    review metadata, not a user-facing explanation). ph-4-us-3 adds an optional one; filling it is
    content work.
  - Frontend: ph-4-us-4 builds the review screen.
- Applies to practice tests, mini-quizzes (ph-2-us-9 links here) and the baseline — once it's
  complete. Baseline answers stay hidden until all 3 sections are done (ph-1-us-11).

## Acceptance Criteria
- [ ] Given a completed practice test or mini-quiz, when the user opens its review (right after
  or later from history), then every question shows its text, all choices, the user's answer,
  and the correct answer.
- [ ] Given a question has an explanation, when it's reviewed, then the explanation shows. Given
  it has none, then the review points to the handbook topic it comes from instead.
- [ ] Given a baseline in progress, when the user looks for a review, then none is offered until
  the baseline is complete. After that, all 45 questions can be reviewed.

## Dependencies
- **Children**: ph-4-us-3 (question content + explanation on attempts), ph-4-us-4 (review screen).
- **Built in Phase 1**: `scoreTest` (ph-1-us-11).
- Entry points: ph-4-us-1 (practice results), ph-2-us-9 (mini-quiz results), ph-4-us-6 (baseline
  results), ph-4-us-5 (missed questions).
