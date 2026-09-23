# Fixed baseline diagnostic (sectioned, resumable, doubles as the free test)

**ID:** ph-1-us-8
**Layer:** Backend
**Status:** Complete

## Story
As a first-time teen user,
I want a one-time baseline test that covers every handbook topic, delivered in short sections I
can pause between (even switching phones),
So that I learn where my gaps are without a long, tiring sitting.

## Context
- **Product area**: Phase 1 (`docs/phases.md`), consumed by Phase 3 (baseline UI) and Phase 9
  (onboarding).
- **Layer**: Backend (Cloud Function + Firestore)
- **Decided 2026-09-20:**
  - **Same baseline for every user.** One fixed set, not a per-user random draw. This means
    retaking it never reveals more of the question bank, and there is no per-user assignment to
    store — only a shared, server-owned baseline definition plus each user's progress.
  - **Size:** 3 sections × 15 questions, one per handbook topic (45 topics), in handbook order.
  - **It is the user's "Free Test".** Completing it records that this user has used their free
    test. The flag is needed for the future subscription; **in the MVP nothing is gated** (PRD
    Section 6: no paywall, practice tests stay unlimited) — we only record it.
- **Known hole to be aware of**: anonymous auth gives a new uid on reinstall, so a determined
  user could retake the baseline by reinstalling. Tying the free-test flag to a linked account
  (Phase 9) closes this later; not solved in MVP. See Questions.
- **Rules gap**: `firestore.rules` currently has one wildcard, `users/{uid}/{document=**}`,
  letting a signed-in user read *and write* everything under their uid. Firestore rules are
  OR'd, so a more specific "deny" rule cannot tighten it. The wildcard must be narrowed to
  explicit client-writable sub-collections (e.g. driving sessions, test outcomes, settings),
  with server-owned data (baseline progress, attempts, the free-test flag) as read-only.

## Acceptance Criteria
- [x] Given a fixed baseline definition (45 approved question IDs, one per topic, 3 sections of
  15 in handbook order), when any user starts the baseline, then they receive section 1's
  questions — text, choices, `type`, `chunkId`, `conceptId` — and no answers.
- [x] Given a baseline in progress, when the user returns (same or another device, same uid),
  then the function returns their current section's same questions.
- [x] Given a section is finished, when the client requests the next one, then only that section
  is returned; the whole baseline is never sent at once.
- [x] Given the user finishes all 3 sections, when the final section is scored (ph-1-us-11), then
  the user's server-owned record is marked baseline-complete with a `freeTestUsedAt` timestamp.
- [x] Given a user who has completed the baseline, when they start it again, then the function
  rejects (`already-exists`) and the baseline result is not overwritten.
- [x] Given a baseline question that later becomes non-approved, when the baseline definition is
  next validated, then it is flagged for replacement (a stale question must not silently
  remain).
- [x] Given the stored progress or flag, when a client tries to write it directly, then security
  rules deny the write.

## Data and API
- **Cloud Function**: callable `startOrResumeBaseline` (optional `section` input).
- **Firestore**:
  - `baselineTests/{version}` (e.g. `v1`): the shared baseline definition — 3 sections of 15
    question IDs. Created once by a script; not readable by clients (only the function reads it).
    Replacing a question means publishing a new version: users mid-test finish their version,
    finished users keep their result against the version they took.
  - `users/{uid}/baseline/progress`: per-user version taken, current section, section results,
    `freeTestUsedAt`. Read-only to the owning client. Created lazily on the user's first
    `startOrResumeBaseline` call — not at first login, since users who choose "learn first" may
    never need it.
- **Not bundled in the app**: shipping the 45 questions in the binary would make them trivially
  copyable and would need an app release to fix a question. The client instead fetches section 1
  when onboarding starts and caches it locally (ph-1-us-3) so it opens instantly and works
  offline.
- **Security rules**: replace the `users/{uid}/**` wildcard with explicit paths, as above, plus
  `rules.test.ts` cases for client-write denial.
- Answer recording and scoring are ph-1-us-11.

## Dependencies
- **Blocked by**: ph-1-us-4 (question shape), ph-1-us-9 (topic list), ph-1-us-11 (scoring sets
  the completion flag).
- Consumed by: Phase 3, Phase 4 (topic report), Phase 9.

## Test Notes
- **Happy path**: start returns section 1; resume returns identical questions; completed
  baseline rejects a restart; two users receive identical sets.
- **Edge cases**: topic with no approved question at build time (script must fail loudly, not
  ship a shorter baseline); two concurrent start calls.
- **Failure modes**: unauthenticated; rules test that clients cannot write progress or the flag.

## Tasks
- [ ] Script to build and validate the fixed baseline definition (one approved question per
  topic, fact/scenario mix noted).
  - _Note (2026-09-23):_ Build + validate scripts are done (`qb:build-baseline`, `qb:validate-baseline`). Not done: reporting the fact/scenario mix of the selection.
- [x] Implement `startOrResumeBaseline`.
- [x] Narrow `firestore.rules` and add rules tests.
- [x] Emulator tests; document the contract in `functions/README.md`.

## Questions
- Pick the baseline questions by hand (balanced fact/scenario, reviewed), or automatically?
  Since every user sees the same 45, a human pass is worth it.
- Reinstall loophole: is recording the flag against the anonymous uid enough for MVP, given no
  gating exists yet?
