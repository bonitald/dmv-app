# Phase 3: Practice Test Generator & Test-Taking UI — Summary

## Status: Not Started

Depends on Phase 1 (question bank), which is Complete. Phase 1 already built every server
function the test flows call (`assembleTest`, `startOrResumeBaseline`, `scoreTest`), so Phase 3
is mostly frontend. The backend work left is small changes to existing functions: a fact/scenario
mix and repeat-avoidance in `assembleTest`, and recording `timing` in `scoreTest`.

## Stories

| ID | Title | Layer | Parent | Status |
|----|-------|-------|--------|--------|
| ph-3-us-1 | Use the on-device test cache in the test-taking flow | Frontend | — | Not Started |
| ph-3-us-2 | Start a practice test that mixes fact and scenario questions | Parent | — | Not Started |
| ph-3-us-3 | `assembleTest` guarantees a fact/scenario mix and topic spread | Backend | ph-3-us-2 | Not Started |
| ph-3-us-4 | Test-taking screen (shared quiz runner) | Frontend | ph-3-us-2 | Not Started |
| ph-3-us-5 | Unlimited, distinct practice tests | Parent | — | Not Started |
| ph-3-us-6 | `assembleTest` avoids repeating a user's recent questions | Backend | ph-3-us-5 | Not Started |
| ph-3-us-7 | Timed or untimed practice test mode | Parent | — | Not Started |
| ph-3-us-8 | Record test mode and duration on the Test Attempt | Backend | ph-3-us-7 | Not Started |
| ph-3-us-9 | Timed mode picker and countdown | Frontend | ph-3-us-7 | Not Started |
| ph-3-us-10 | Every Test Attempt is recorded | Parent | — | Complete (delivered by ph-1-us-11) |
| ph-3-us-11 | Colorado-only content, no state selector | Parent | — | In Progress |
| ph-3-us-12 | Take the baseline diagnostic, with pauses between sections | Parent | — | Not Started |
| ph-3-us-13 | Baseline flow: intro, sections, "keep going?" and resume | Frontend | ph-3-us-12 | Not Started |
| ph-3-us-14 | Baseline recorded as its own attempt type, marks the free test used | Parent | — | Complete (delivered by ph-1-us-8/11) |

`docs/phases.md` bullet → story: 1 → us-2; 2 → us-1; 3 → us-5; 4 → us-7; 5 → us-10; 6 → us-11;
7 → us-12; 8 → us-14.

## Key decisions made during planning

- **ph-3-us-4 owns the shared quiz runner**: the quiz question card and the runner around it
  (navigation, unanswered warning, submit), plus the typed callable wrappers and adding
  `@react-native-firebase/functions`. Practice tests, baseline sections (ph-3-us-13) and concept
  mini-quizzes (ph-2-us-8) all plug into it. In journey order the baseline is likely its first
  user.
- **ph-3-us-1 (offline / force-quit) hooks into ph-3-us-4** rather than being its own screen, and
  covers all three session kinds.
- **Every practice test gets a guaranteed mix** (ph-3-us-3): a scenario minimum and a per-topic
  cap, as tunable constants (proposed 8 of 25 scenario, max 2 per topic).
- **Repeat-avoidance is server-side** (ph-3-us-6), using the user's recent `testAssignments`, so
  it works across devices with no client state. Conflict order (proposed): scenario minimum >
  repeat-avoidance > topic cap.
- **No rate limit or cap on practice tests**: `assembleTest` never returns answers, so there's
  nothing to scrape, and a cap would contradict "unlimited". Only the baseline sets
  `freeTestUsedAt`.
- **Practice tests mirror the real CO test**: 25 multiple-choice questions, 60 minutes, 20 correct
  (80%) to pass (`prd.md` Section 9, confirmed 2026-09-23).
- **Timed mode is practice-only, untimed by default, 60 minutes when on**, computed from a saved `startedAt` (the
  phase-0 persist-timestamps principle), keeps running in the background, auto-submits at zero
  (ph-3-us-9). Mode and duration are recorded on the attempt for analytics only (ph-3-us-8).
- **Baseline check-in shows no score between sections** (ph-3-us-13) — a low-pressure break
  point. Full results after section 3 are Phase 4.
- **One `Baseline` route** serves both the Practice tab card and Phase 9's first-run "test what I
  know" choice.
- **ph-3-us-10 and ph-3-us-14 are marked Complete**: Phase 1's `scoreTest` and baseline work
  already delivered them (ph-3-us-10 is extended by ph-3-us-8).
- **Backend splits only where there's backend work**: ph-3-us-5 has no Frontend child (starting
  another test is ph-3-us-4 / Phase 4), and ph-3-us-11 and ph-3-us-12 have no Backend child
  (nothing to build).

## Carried over from Phase 1

- **ph-3-us-1** holds the unfinished acceptance criteria of ph-1-us-3 (scoped offline caching)
  and ph-1-us-5 (on-device cache), moved here on 2026-09-23 so Phase 1 could close. It now
  depends on ph-3-us-4.

## Open items carried into implementation

- ~~**For Phase 4**: show pass/fail against the real bar~~ — covered by ph-4-us-1.
- Tunables to validate once the reviewed bank's mix is known: `MIN_SCENARIO_COUNT`,
  `MAX_PER_TOPIC`, `RECENT_TESTS_TO_AVOID`.
- Results screens are Phase 4: practice results ph-4-us-1, baseline results ph-4-us-6, review
  ph-4-us-4. ph-3-us-4 and ph-3-us-13 ship minimal placeholders if they land first.
- Stale-test expiry after a force-quit is still open (ph-3-us-1 Questions).
