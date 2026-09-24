# Latest score compared to my baseline

**ID:** ph-4-us-7
**Layer:** Parent
**Status:** Not Started

## Story
As a teen user,
I want to see how my latest practice test score compares with my baseline,
So that I can tell whether my studying is paying off.

## Context
- **Product area**: Phase 4 (`docs/phases.md`, fifth bullet); `prd.md` Section 2 secondary success
  metric: "per-user score improvement from the one-time baseline diagnostic to later practice
  tests".
- **Layer**: Frontend (Expo/React Native). No Backend split: the baseline attempts and practice
  attempts are client-readable (`testAttempts`), and the per-user data for the success metric is
  already stored server-side, so later analysis (Phase 8) can query it without any new writes.
  A backend child would be empty.
- **Baseline score** = correct / graded across all 45 baseline questions, from `baselineReview`
  on the final section's attempt. **Latest score** = the most recent practice test's `score`.
  Mini-quizzes don't count: they cover one topic, so they aren't comparable.
- The two use different questions (45 fixed vs. 25 random), so the comparison is indicative.
  Show it as percentages, not raw counts.

## Acceptance Criteria
- [ ] Given a completed baseline and at least one practice test, when the practice results screen
  shows (ph-4-us-1), then it shows "Baseline X% → This test Y%" with the change in points.
- [ ] Given the same data, when the user opens the Progress tab, then a summary shows the
  baseline score, the latest practice score, and the change.
- [ ] Given no completed baseline, when either place would show the comparison, then it instead
  invites the user to take (or finish) the baseline, depending on `baseline/progress`.
- [ ] Given a completed baseline but no practice test yet, when the Progress tab shows, then it
  shows the baseline score and invites them to take a practice test.
- [ ] Given the latest score is lower than the baseline, when it's shown, then the wording stays
  neutral and encouraging (no red "worse" framing).

## UI/UX Notes
- **Screens/flows**: a comparison line on practice results (ph-4-us-1); a summary card at the top
  of the Progress tab above the concept report (ph-4-us-6).
- Two numbers and an arrow. No chart needed for MVP; a trend over time can come later.

## Dependencies
- **Blocked by**: ph-3-us-13 (baseline completes), ph-4-us-1 (practice results screen).
- **Related**: ph-4-us-6 (same Progress tab).

## Test Notes
- **Happy path**: baseline 60% (27/45), practice 76% (19/25) → "+16 points".
- **Edge cases**: baseline with an `unavailable` question (44 graded); baseline in progress; no
  practice tests; latest lower than baseline; equal scores.
- **Failure modes**: attempts can't be read offline and aren't cached (hide the comparison, don't
  show an error).

## Tasks
- [ ] Add a pure `baselineScore(baselineReview)` helper, unit-tested.
- [ ] Add the comparison line to practice results.
- [ ] Add the summary card to the Progress tab with its empty and in-progress states.

## Questions
- Compare against the **latest** test (assumed) or the average of the last few? Latest is
  simpler and matches the `docs/phases.md` wording. An average would be steadier.
