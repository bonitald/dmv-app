# Phase 4: Scoring & Review — Summary

## Status: Not Started

Depends on Phase 3 (test attempts exist to score and review). Grading and saved attempts already
exist from Phase 1 (`scoreTest`, ph-1-us-11), so this phase is mostly results and review screens.
The one backend change saves each question's text, choices and optional explanation on graded
attempts, so past tests can be reviewed without reading the deny-all `questions` collection.

## Stories

| ID | Title | Layer | Parent | Status |
|----|-------|-------|--------|--------|
| ph-4-us-1 | See my score and pass/fail right after a practice test | Parent | — | Not Started |
| ph-4-us-2 | Review every question from a completed test | Parent | — | Not Started |
| ph-4-us-3 | Save question text, choices and explanation on graded attempts | Backend | ph-4-us-2 | Not Started |
| ph-4-us-4 | Question review screen | Frontend | ph-4-us-2 | Not Started |
| ph-4-us-5 | Missed questions I can come back to | Parent | — | Not Started |
| ph-4-us-6 | Per-concept report: baseline results and strong / shaky / likely gap | Parent | — | Not Started |
| ph-4-us-7 | Latest score compared to my baseline | Parent | — | Not Started |

`docs/phases.md` bullet → story: 1 → us-1; 2 → us-2; 3 → us-5; 4 → us-6; 5 → us-7.

## Key decisions made during planning

- **Pass/fail uses the real bar**: 80% (20 of 25), computed as `score >= PASS_MARK` so it still
  works when a deleted question leaves 24 graded (ph-4-us-1).
- **Question text and choices are saved on each graded attempt** (ph-4-us-3) instead of adding a
  "get review" function. `scoreTest` already reads those docs, and the user was already shown
  those questions, so nothing new is exposed. Baseline sections 1–2 still hold back answers, and
  explanations too.
- **Optional `explanation` field** added to the `Question` schema and passed through only after
  grading. The assemble and flashcard functions must never return it. Writing explanations for the
  bank is a content task. Until then the review falls back to "From the handbook: <topic>" plus a
  link to that concept's flashcards.
- **"Missed" means the latest result is wrong** (ph-4-us-5): answering it correctly later takes
  it off the list. Practice tests and the completed baseline are also recorded into Phase 2's
  local card performance, so weak-card ordering sees them (closes the loop `docs/phases.md`
  asks for).
- **One strength rule, most specific evidence first** (ph-4-us-6): latest mini-quiz → practice
  tests (≥ 3 answers on the topic) → baseline "Got it / Missed it" → "Not tested yet". Strength
  (computed) is kept separate from status (the user's choice, ph-2-us-10).
- **The baseline results screen belongs to ph-4-us-6**: 45 topics marked Got it / Missed it, with
  "Start with what you missed" and review. Phase 9's "save your progress" prompt goes after it.
- **The Progress tab gets the concept report and the baseline comparison.** Phase 5 adds the test
  date and outcome log to the same tab.
- **Only ph-4-us-2 has a Backend/Frontend split**: every other story reads data that's already
  client-readable and computes on the device, so a backend child would be empty.

## Open items carried into implementation

- Writing paraphrased explanations for the existing 1,415 questions (content work, not
  scheduled).
- Tunables: strength bands (80% / 50%), `MIN_PRACTICE_ANSWERS = 3`, missed-questions read window
  (last 30 attempts).
- Baseline comparison uses the latest practice test (assumed), not an average (ph-4-us-7).
- Whether the concept list should also show a strength marker (ph-4-us-6).
