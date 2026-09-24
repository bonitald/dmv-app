# Per-concept report: baseline results and strong / shaky / likely gap

**ID:** ph-4-us-6
**Layer:** Parent
**Status:** Not Started

## Story
As a teen user,
I want to see, after my baseline and as I keep practising, which handbook concepts I'm strong in
and which need work, and jump straight into the ones that need work,
So that I spend my study time where it matters.

## Context
- **Product area**: Phase 4 (`docs/phases.md`, fourth bullet); `prd.md` Section 4 (baseline results
  per topic, indicative only; "got it / missed it", with "shaky" once mini-quiz scores exist) and
  Section 5 (baseline "per-concept strong/shaky/likely-gap report", Must).
- **Layer**: Frontend (Expo/React Native). No Backend split: all inputs are already
  client-readable, and the calculation is small and per-user, so it runs on the device. A backend
  child would be empty. Inputs:
  - **Baseline**: `baselineReview` on the final baseline attempt — one question per topic
    (ph-1-us-8/11).
  - **Mini-quiz**: `latestMiniQuizScore` on Concept Progress (ph-2-us-11).
  - **Practice tests**: `perTopic` totals on recent practice attempts (ph-1-us-11).
- A "concept" is a handbook topic (`chunkId`, 45), as in the Phase 2 concept list.
- **Strength is not the same as status.** Status (not started / in progress / reviewed / needs
  revisit, ph-2-us-10) is the user's own choice. Strength (strong / shaky / likely gap) is
  computed from answers. This report shows strength; the concept list keeps showing status.

### Strength rule (the one place it's defined)
For each topic, use the most specific evidence available:
1. **Latest mini-quiz score** exists → strong ≥ 80%, shaky 50–79%, likely gap < 50%.
2. Otherwise, **practice tests** gave at least `MIN_PRACTICE_ANSWERS` (proposed 3) answers on this
   topic → the same bands on practice accuracy for this topic.
3. Otherwise, **baseline only** → "Got it" (shown like strong) or "Missed it" (shown like likely
   gap). No "shaky" from one question, per `prd.md` Section 4.
4. No evidence → "Not tested yet".
Every label is shown as indicative ("based on N answers").

## Acceptance Criteria
- [ ] Given the user completes the baseline, when section 3 is graded, then the baseline results
  screen shows the overall score (N of 45) and all 45 topics in handbook order, each marked Got
  it or Missed it, with a note that one question per topic is only a rough guide.
- [ ] Given the baseline results screen, when the user taps a topic, then that concept's
  flashcards open (ph-2-us-3). A "Start with what you missed" button opens the first missed topic.
- [ ] Given the baseline results screen, when the user taps "Review answers", then the 45-question
  review opens (ph-4-us-4).
- [ ] Given the user has later mini-quiz or practice-test results, when they open the concept
  report (Progress tab), then each topic shows strong / shaky / likely gap per the rule above,
  and how many answers it's based on.
- [ ] Given the concept report, when the user sorts by "Needs work first", then likely gap topics
  come first, then shaky, then not tested, then strong.
- [ ] Given a practice test is graded, when its results show (ph-4-us-1), then a "Topics to work
  on" section lists that test's weakest topics (from its `perTopic`), each linking to its
  flashcards.
- [ ] Given a user who hasn't done the baseline or any test, when they open the report, then it
  explains what fills it in, and offers the baseline and the concept list.

## UI/UX Notes
- **Screens/flows**:
  - Baseline results: after section 3 (ph-3-us-13) → baseline results → flashcards / review /
    home. Replaces ph-3-us-13's placeholder. Phase 9's "save your progress" prompt
    (ph-9-us-10) is offered here, after the results (not blocking them).
  - Concept report: on the Progress tab (currently a placeholder). Phase 5 adds the test-date
    and outcome log to the same tab later.
- Labels use existing tokens: `success`/`successSoft` strong, `secondary`/`secondarySoft` shaky,
  `alert` likely gap, neutral for not tested. Always paired with a text label, not color alone.

## Dependencies
- **Blocked by**: ph-3-us-13 (baseline flow), ph-2-us-12 (Concept Progress reads), ph-2-us-7 /
  ph-2-us-3 (concept list and flashcards to jump into). Uses ph-1-us-9 `topics` for titles and
  order.
- **Related**: ph-4-us-1 (practice results section), ph-4-us-7 (baseline comparison, same tab),
  Phase 9 (post-baseline account-linking prompt).

## Test Notes
- **Happy path**: baseline 30/45 → 15 Missed it topics, first one opens from "Start with what
  you missed"; later a mini-quiz at 60% turns that topic to shaky.
- **Edge cases**: a topic in the baseline whose question was deleted (`unavailable` → not
  tested); a topic with practice answers but no mini-quiz; exactly 80% and 50% boundaries;
  a user with mini-quiz data but no baseline.
- **Failure modes**: missing Concept Progress or attempts (treated as no evidence, not an
  error); offline with cached data.

## Tasks
- [ ] Add a pure `conceptStrength(evidence)` function implementing the rule, with constants, unit
  tested with `npm run test:app`.
- [ ] Add an evidence loader combining the baseline attempt, Concept Progress and recent practice
  attempts.
- [ ] Build the baseline results screen (replacing ph-3-us-13's placeholder).
- [ ] Build the concept report on the Progress tab (replacing its `PlaceholderScreen`), with sort
  and links into the Study tab.
- [ ] Add the "Topics to work on" section to practice results (ph-4-us-1).

## Questions
- Band edges (80% / 50%) and `MIN_PRACTICE_ANSWERS = 3` are proposals. The 80% edge matches the
  real test's pass mark.
- Should the concept list (ph-2-us-7) also show a small strength marker next to each status? Not
  assumed. Two labels on one row may confuse. Revisit after using it.
