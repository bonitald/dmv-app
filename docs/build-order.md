# Build Order — Journey Slices

> Companion to `phases.md`. Stories stay in their phase folders (`docs/phases/phase-N-*/`); this
> file only sets the order they're built in. Each slice follows the next step a new teen takes
> through the app, and ends in something that can be tested on a device from a fresh install.
> Decided 2026-09-24. Covers Phases 2, 3, 4 and 9 (Phases 5–8 have no stories yet).

## The journey

1. **First launch**: welcome, pick a route, optional test date, Home.
2. **Baseline**: start, stop, resume and finish the 45-question diagnostic.
3. **Results**: baseline score, Got it / Missed it per topic, review answers.
4. **Learning path**: concept list → flashcards → mini-quiz → recommendation → progress.
5. **Practice tests**: 25-question tests, pass/fail, timed mode, missed questions.
6. **Save progress**: link a real sign-in, recover on a new phone, delete the account.

Each slice replaces the stubs the previous one left behind. Home (ph-9-us-7) shows a card only
once its feature exists, so each slice also adds its Home card.

---

## Slice 1 — First launch

**Test from a fresh install:** welcome → "Test what I know" or "Learn first" → optional test
date → lands on a stub for that route. Relaunching skips onboarding and opens Home, which shows
the countdown.

| Order | Story | What it adds |
|-------|-------|--------------|
| 1 | ph-9-us-2 (Backend) | `onboarding` and `testDate` profile fields; tightened `users/{uid}` rule; removes the `App.tsx` smoke test the new rule denies |
| 2 | ph-9-us-3 (Frontend) | Onboarding flow. Baseline and concept list are placeholder screens for now |
| 3 | ph-9-us-5 (Frontend) | Test date step and countdown card |
| 4 | ph-9-us-7 (Frontend) | Home tab, first of five: countdown, "Start your baseline" and "Learn concept by concept" cards, Settings (test date only) |
| 5 | ph-3-us-11 (Parent) | Colorado-only wording check, no state selector |

Parents closed by this slice: ph-9-us-1, ph-9-us-4, ph-9-us-6 (partly: Home fills in over later
slices).

**Moved into this slice:** the `jest-expo` component-test config (a task on ph-2-us-3) lands
with the first screen, which is now onboarding.

**Status: Complete (2026-09-25).** Tested on the Android emulator (onboarding → baseline stub → Home countdown; relaunch skips onboarding). Rules deploy still pending. ph-9-us-6/us-7 and ph-3-us-11 stay open for their later-slice parts.

---

## Slice 2 — Baseline

**Test:** from "Test what I know" (or the Home card), start the baseline → answer part of
section 1 → force-quit → reopen and resume where you left off → finish section 1 → "keep
going?" → leave → come back later → finish all 3 sections → placeholder results.

| Order | Story | What it adds |
|-------|-------|--------------|
| 1 | ph-3-us-4 (Frontend) | Shared quiz runner and quiz card; typed callable wrappers in `src/api/`; installs `@react-native-firebase/functions` (**dev-client rebuild**) |
| 2 | ph-3-us-13 (Frontend) | Baseline intro, sections, "keep going?" break with no score, resume; replaces Slice 1's baseline stub |
| 3 | ph-3-us-1 (Frontend) | On-device test cache in the runner: survives force-quit and offline mid-section |

Parents closed: ph-3-us-12. (ph-3-us-14 was already delivered by Phase 1.)

The runner is built for the baseline first, but it has to fit practice tests (Slice 5) and
mini-quizzes (Slice 4) too; ph-3-us-4 already describes all three.

---

## Slice 3 — Results

**Test:** finish the baseline → results show N of 45 and all 45 topics as Got it / Missed it →
"Review answers" shows every question with the right answer → tapping a topic or "Start with
what you missed" goes to the concept-list stub.

| Order | Story | What it adds |
|-------|-------|--------------|
| 1 | ph-4-us-3 (Backend) | `scoreTest` saves question text, choices and optional `explanation` on graded attempts |
| 2 | ph-4-us-4 (Frontend) | Question review screen (reuses the quiz card) |
| 3 | ph-4-us-6, **baseline results part** | Baseline results screen: score, Got it / Missed it, "Start with what you missed", "Review answers". Replaces Slice 2's placeholder |

Parents closed: ph-4-us-2.

**Split story:** ph-4-us-6 is built in two parts. The baseline results screen (its first three
acceptance criteria and the "no evidence yet" state) is here. The Progress-tab concept report
with strong / shaky / likely gap needs mini-quiz data, so it's in Slice 4b. The practice
"Topics to work on" section is in Slice 5a.

Baseline attempts made while testing Slice 2 don't carry question text. Test this slice with a
fresh anonymous user (clear app data).

---

## Slice 4 — Learning path

Built as two testable halves.

### 4a — Concept list and flashcards

**Test:** from "Learn first" or a baseline results topic → concept list in handbook order →
open a topic → flip through every card (scenario cards badged) → end of deck offers "Start
this concept over" (mini-quiz button is a stub). The topic shows "in progress" on the list.
Topics with no approved questions show "coming soon".

| Order | Story | What it adds |
|-------|-------|--------------|
| 1 | ph-2-us-11 (Backend) | Concept Progress record and rules; `scoreTest` merges the mini-quiz score |
| 2 | ph-2-us-12 (Frontend) | Client Concept Progress module (status reads and writes) |
| 3 | ph-2-us-7 (Parent) | Concept list with status; replaces Slice 1's stub and becomes Slice 3's topic link |
| 4 | ph-2-us-3 (Frontend) | Flip-card flashcard viewer, end-of-deck choice |
| 5 | ph-2-us-5 (Parent) | Scenario badge on cards |

Home card: "Continue learning".

### 4b — Mini-quiz, recommendation and progress

**Test:** finish a deck → "Take the mini-quiz" → submit → recommendation → pick Review Again /
Come Back Later / Mark Reviewed → the list shows the new status → reopen the deck and the missed
cards come first → Progress tab shows that topic as strong / shaky / likely gap.

| Order | Story | What it adds |
|-------|-------|--------------|
| 1 | ph-2-us-6 (Parent) | Local per-card performance store (module first; mini-quiz recording once us-8 exists) |
| 2 | ph-2-us-8 (Parent) | Mini-quiz on the shared runner |
| 3 | ph-2-us-9 (Parent) | Recommendation screen and the three choices |
| 4 | ph-2-us-4 (Parent) | Missed cards come first in the next pass |
| 5 | ph-4-us-6, **concept report part** | Strength rule and Progress-tab concept report, with "Needs work first" sort |

Parents closed: ph-2-us-1, ph-2-us-10. (ph-2-us-2 was superseded by Phase 1.)

---

## Slice 5 — Practice tests

Built as two testable halves.

### 5a — Take a practice test and see the result

**Test:** Practice tab → start a test → 25 questions with at least the scenario minimum and no
more than 2 per topic → submit → score, PASS / NOT YET against 20 of 25, "Topics to work on"
→ review → the test appears in the recent list.

| Order | Story | What it adds |
|-------|-------|--------------|
| 1 | ph-3-us-3 (Backend) | `assembleTest` fact/scenario mix and per-topic cap |
| 2 | ph-4-us-1 (Parent) | Practice results with pass/fail; recent tests on the Practice tab |
| 3 | ph-4-us-6, **"Topics to work on" part** | Weakest topics on practice results, linked to flashcards |

Parents closed: ph-3-us-2.

### 5b — Timed tests, fresh questions, progress over time

**Test:** start a timed test → 60-minute countdown keeps going with the app in the background
→ it auto-submits at zero. Three tests in a row don't repeat questions (bank permitting). Missed
questions list drops a question once answered right. Progress tab compares the latest score with
the baseline.

| Order | Story | What it adds |
|-------|-------|--------------|
| 1 | ph-3-us-6 (Backend) | Repeat-avoidance in `assembleTest` (same code as ph-3-us-3: build right after it) |
| 2 | ph-3-us-8 (Backend) | `timing` saved on attempts |
| 3 | ph-3-us-9 (Frontend) | Timed/untimed picker and countdown |
| 4 | ph-4-us-5 (Parent) | Missed questions list; practice and baseline results feed card performance |
| 5 | ph-4-us-7 (Parent) | Latest score vs baseline |

Parents closed: ph-3-us-5, ph-3-us-7. (ph-3-us-10 was already delivered by Phase 1.)

Home card: "Take a practice test" / latest score.

---

## Slice 6 — Save progress to an account

**Test:** after the baseline results, "Save your progress" → link Google (or Apple on iOS) → the
uid and all progress stay the same → on a second device, "I already have an account" → progress
appears. Sign out clears local data. Delete account removes everything.

| Order | Story | What it adds |
|-------|-------|--------------|
| 1 | ph-9-us-9 (Backend) | Google and Apple providers; `deleteAccount` callable |
| 2 | ph-9-us-10 (Frontend) | Linking prompts, new-phone sign-in, Settings, `clearLocalData` |

Parents closed: ph-9-us-8, and ph-9-us-6 in full.

**Gate:** this slice must ship before Phase 8 (beta), and the **privacy review for minors**
(`prd.md` Section 9) must be done before any beta tester installs the app.

---

## Why this order

- **The quiz runner arrives with the baseline** (Slice 2) rather than with practice tests, because
  the baseline is the first test a new user takes. Mini-quizzes and practice tests reuse it.
- **Results come before learning** because the baseline results screen is where "Start with
  what you missed" sends users into the learning path.
- **Concept Progress backend leads Slice 4**, so the concept list shows real statuses from the
  start instead of being reworked later.
- **Practice tests come after learning**: the runner already works, so Slice 5 is mostly
  assembly rules and results. The learning path is the bigger part of the MVP.
- **Account linking comes last** because it protects progress that only exists once Slices 2–5
  have shipped. It isn't needed to test any earlier slice.

## Open items

- Phases 5 (test outcome), 6 (driving logger), 7 (export) and 8 (beta) have no stories yet. Where
  they fit in the journey is decided when they're written.
- About 900 questions still await review. Slice 4a's "coming soon" state and Slice 5's
  scenario minimum depend on how much is approved by then.
