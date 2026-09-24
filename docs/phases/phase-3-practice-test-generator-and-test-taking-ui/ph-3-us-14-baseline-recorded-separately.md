# Baseline recorded as its own attempt type, and marks the free test used

**ID:** ph-3-us-14
**Layer:** Parent
**Status:** Complete — delivered by ph-1-us-8 and ph-1-us-11

## Story
As a product owner,
I want the baseline scored and stored separately from practice tests, and completing it to record
that the user's free test is used,
So that later scores can be compared against a true starting point, and the future subscription
knows who has already had their free test.

## Context
- **Product area**: Phase 3 (`docs/phases.md`, eighth bullet); `prd.md` Section 4 (baseline is the
  "free test"; nothing gated in MVP) and Section 7 (Test Attempt `type`).
- **Already delivered in Phase 1:**
  - Each baseline section's attempt is saved with `type: 'baseline'`, separate from `practice`
    and `mini-quiz` (ph-1-us-11). The final section's attempt carries `baselineReview` for all 45
    questions.
  - `users/{uid}/baseline/progress` gets `completedAt` and `freeTestUsedAt` when section 3 is
    graded (ph-1-us-8, ph-1-us-11). Clients can read it, never write it.
  - Every user gets the same fixed baseline version (`baselineTests/{version}`), so scores are
    comparable across users.
- Nothing is gated on `freeTestUsedAt` in MVP. The known gap — reinstalling issues a new
  anonymous uid, so the baseline can be retaken — closes with account linking (Phase 9).

## Acceptance Criteria
- [x] Given a baseline section is graded, when its attempt is saved, then its `type` is
  `baseline`, distinct from practice tests and mini-quizzes.
- [x] Given the final baseline section is graded, when progress is updated, then `completedAt` and
  `freeTestUsedAt` are set.
- [x] Given a client, when it tries to write baseline progress or attempts, then it's denied.

## Dependencies
- **Delivered by**: ph-1-us-8, ph-1-us-11.
- **Consumed by**: ph-3-us-13 (shows completed state), Phase 4 (baseline results and "latest
  score vs. baseline"), future subscription work.
