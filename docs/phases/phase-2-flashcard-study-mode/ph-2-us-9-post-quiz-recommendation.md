# Post-quiz recommendation and next-step choice

**ID:** ph-2-us-9
**Layer:** Parent
**Status:** Complete (Slice 4b, 2026-10-11)

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
- [x] Given `scoreTest` returns a mini-quiz result, when the results screen shows, then the
  user sees their score, the questions they missed with the correct answers (`perQuestion`), and
  a recommendation: "move on" wording for `move-on`, "review again" wording for `review-again`.
- [x] Given any score, when the results screen shows, then both choices are available —
  the recommendation highlights one but never disables the other. *(Changed: the story said three choices; see Implementation notes.)*
- [x] Given the user taps "Review Again", when it's handled, then the topic's status becomes
  in progress. *(Changed: it returns to the concept list rather than restarting the viewer; the missed cards come back when the topic is reopened, ph-2-us-4.)*
- [ ] ~~Given the user taps "Come Back Later, Continue to Next Concept"...~~ *Superseded (spec A3): the choice was removed.*
- [x] Given the user taps "Mark Reviewed", when it's handled, then the topic's status becomes
  reviewed and the user returns to the concept list.
- [x] Given the results screen, when it renders, then a note tells the user they can restart any
  concept later from the concept list.
- [x] Given the user leaves the results screen without choosing (back button / tab switch), when
  that happens, then the status stays as it was before (in progress) — no choice is inferred.
- [x] Given the choice can't be saved (offline), when the user taps it, then the navigation still
  happens and the status write is retried/queued (Firestore offline persistence), not dropped.
- [ ] ~~Given the last topic in handbook order, when the user picks "Continue to Next Concept"...~~ *Superseded (spec A3): there is no next-concept navigation.*

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
- [x] Build the results screen (score, missed questions with correct answers, recommendation),
  reusing the shared result pieces from ph-4-us-1 and linking "Review answers" to ph-4-us-4.
- [x] Implement the choices and their navigation. *(Two choices, both to the concept list.)*
- [x] Call ph-2-us-12's status setter for each choice.
- [ ] ~~"Next topic" helper~~ *Superseded (spec A3): removed with Come Back Later.*

## Implementation notes (Slice 4b)
Built in Slice 4b on `feat/mini-quiz-progress`; plan `docs/superpowers/plans/2026-10-11-slice-4b-mini-quiz-progress.md`, design `docs/superpowers/specs/2026-10-11-slice-4b-mini-quiz-progress-design.md` (including its Amendment A1-A7 from device testing). Device-tested on the Android emulator 2026-10-11.
- **Two choices, not three (spec A1-A3):** **Mark Reviewed** (status `reviewed`) and **Review Again** (status `in-progress`). "Come Back Later, Continue to Next Concept" was removed, with its next-topic helper. Mark Reviewed is highlighted on a pass (`move-on`), Review Again on a fail (`review-again`); both are always enabled.
- **Both choices return to the concept list (A2, A7).** The user picks what to do next. Review Again no longer restarts the viewer or passes a route param; the missed cards come back through the not-passed reopen rule (ph-2-us-4). "Review answers" stays on the results screen.
- Nothing sets `needs-revisit` any more; the value stays valid in the rules and still displays for existing records (ph-2-us-10).
- The results screen shows the score, the recommendation, the missed questions with the right answers, and Review answers (the existing Review screen). The "Come Back Later" question below is closed because that choice no longer exists.

## Questions
- **"Come Back Later" → needs revisit** is assumed regardless of score (the user is saying they
  want to come back to it). Alternative: only set needs revisit when the recommendation was
  `review-again`, and otherwise leave it in progress. See ph-2-us-10.
