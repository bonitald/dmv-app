# Post-quiz recommendation and next-step choice

**ID:** ph-2-us-9
**Layer:** Parent
**Status:** Not Started

## Story
As a teen user,
I want the app to tell me after a concept's quiz whether I'm ready to move on, and then let me
decide what to do next,
So that I get guidance on where I stand without being blocked from studying my own way.

## Context
- **Product area**: Phase 2 (`docs/phases.md`, seventh bullet); `prd.md` Section 5: a
  recommendation, **not a gate**, and three choices: "Review Again", "Come Back Later, Continue to
  Next Concept", "Mark Reviewed". Concepts are "reviewed", never "completed", and can be
  restarted any time.
- **Layer**: Frontend (Expo/React Native). No Backend split: the recommendation already comes
  from `scoreTest` (`move-on` at ≥ 80%, else `review-again`; threshold is the tunable
  `MINI_QUIZ_PASS_THRESHOLD` in `functions/src/scoreTest.ts`, still unvalidated per
  `prd.md` Section 9). Saving the choice is ph-2-us-12's client module writing to ph-2-us-11's
  record.
- How each choice changes status is defined in ph-2-us-10.

## Acceptance Criteria
- [ ] Given `scoreTest` returns a mini-quiz result, when the results screen shows, then the
  user sees their score, the questions they missed with the correct answers (`perQuestion`), and
  a recommendation: "move on" wording for `move-on`, "review again" wording for `review-again`.
- [ ] Given any score, when the results screen shows, then all three choices are available —
  the recommendation highlights one but never disables the others.
- [ ] Given the user taps "Review Again", when it's handled, then the topic's status becomes
  in progress and the flashcard viewer restarts on the same topic (from the session cache,
  no new `getFlashcards` call).
- [ ] Given the user taps "Come Back Later, Continue to Next Concept", when it's handled, then
  the topic's status becomes needs revisit and the next topic in handbook order that has
  approved questions opens.
- [ ] Given the user taps "Mark Reviewed", when it's handled, then the topic's status becomes
  reviewed and the user returns to the concept list.
- [ ] Given the results screen, when it renders, then a note tells the user they can restart any
  concept later from the concept list.
- [ ] Given the user leaves the results screen without choosing (back button / tab switch), when
  that happens, then the status stays as it was before (in progress) — no choice is inferred.
- [ ] Given the choice can't be saved (offline), when the user taps it, then the navigation still
  happens and the status write is retried/queued (Firestore offline persistence), not dropped.
- [ ] Given the last topic in handbook order, when the user picks "Continue to Next Concept",
  then they return to the concept list instead.

## UI/UX Notes
- **Screens/flows**: mini-quiz (ph-2-us-8) → results/recommendation → flashcards (Review
  Again) / next topic (Come Back Later) / concept list (Mark Reviewed).
- Tone: encouraging, not graded-feeling (`prd.md` avoids gamification). The missed-question list
  is the main learning value, so make it easy to scan.
- The same results layout can be reused for Phase 3 practice-test results, minus the three
  choices.

## Dependencies
- **Blocked by**: ph-2-us-8 (quiz + `scoreTest` result); ph-2-us-12 (status writes).
- Related: ph-2-us-7 (list reflects the new status).

## Test Notes
- **Happy path**: score 90% → "move on" highlighted → Mark Reviewed → list shows reviewed.
- **Edge cases**: score exactly 80%; score 0%; last topic + Continue; next topic has zero
  approved questions (skip it); user picks "Mark Reviewed" despite `review-again` (allowed).
- **Failure modes**: offline when choosing; app killed on the results screen (status unchanged,
  quiz attempt still saved server-side by `scoreTest`).

## Tasks
- [ ] Build the results screen (score, missed questions with correct answers, recommendation),
  reusing the shared result pieces from ph-4-us-1 and linking "Review answers" to ph-4-us-4.
- [ ] Implement the three choices and their navigation.
- [ ] Call ph-2-us-12's status setter for each choice.
- [ ] "Next topic" helper: next by `order` with `approvedQuestionCount > 0`.

## Questions
- **"Come Back Later" → needs revisit** is assumed regardless of score (the user is saying they
  want to come back to it). Alternative: only set needs revisit when the recommendation was
  `review-again`, and otherwise leave it in progress. See ph-2-us-10.
