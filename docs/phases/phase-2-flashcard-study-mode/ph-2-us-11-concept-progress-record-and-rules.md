# Concept Progress record, rules, and `scoreTest` score write

**ID:** ph-2-us-11
**Layer:** Backend
**Parent:** ph-2-us-10
**Status:** Complete (Slice 4a; rules and `scoreTest` deployed to dev 2026-10-10)

## Story
As a developer,
I want a per-user, per-topic Concept Progress document where the server owns the score and the
client can set only the status,
So that the learning path can show and save progress without letting a client forge quiz
scores.

## Context
- **Product area**: Phase 2 (`docs/phases.md`, eighth bullet); `prd.md` Section 7.
- **Layer**: Backend (Firestore schema + rules, Cloud Function change).
- Field split and status transitions are defined on the parent, ph-2-us-10.
- `firestore.rules` (2026-09-23) replaced the old `users/{uid}/**` wildcard with explicit paths
  and says new client-writable subcollections must add their own `match` block. This is the
  first **client-writable** one; the existing ones (`testAssignments`, `testAttempts`,
  `baseline`) are read-only to clients.
- `scoreTest` already writes `users/{uid}/testAttempts/{testId}` with `chunkId` and `score` for a
  mini-quiz (`functions/src/scoreTest.ts`). This story adds one more write in the same function.
- New or changed functions follow the `cloud-function-documentation` skill (summary doc comment
  plus inline comments).

## Acceptance Criteria
- [x] Given a signed-in user, when they read `users/{uid}/conceptProgress/{chunkId}` for their
  own uid, then it succeeds; for another uid, it's denied.
- [x] Given a signed-in user, when they create or update their own doc with only `status`
  (one of `in-progress`, `reviewed`, `needs-revisit`) and `statusUpdatedAt`
  (`request.time`), then it succeeds.
- [x] Given a client write that sets or changes any other field (`latestMiniQuizScore`,
  `latestMiniQuizAt`, `latestTestId`, or any unknown key), when it reaches Firestore, then it's
  denied.
- [x] Given a client write with a `status` outside the allowed values (including
  `not-started`), when it reaches Firestore, then it's denied.
- [x] Given a client tries to delete a Concept Progress doc, when it reaches Firestore, then it's
  denied.
- [x] Given `scoreTest` grades a `mini-quiz`, when it writes the attempt, then it also merges
  `latestMiniQuizScore`, `latestMiniQuizAt` and `latestTestId` into
  `users/{uid}/conceptProgress/{chunkId}`, in the same transaction/batch as the attempt, without
  touching `status`.
- [x] Given `scoreTest` grades a practice test or baseline section, when it runs, then Concept
  Progress is not touched (mini-quiz only).
- [x] Given no Concept Progress doc exists yet when a mini-quiz is scored, when `scoreTest`
  writes, then it creates the doc with score fields only (no `status`). The client treats a
  missing `status` as "in progress" if a score exists (ph-2-us-12).

## Data and API
- **Firestore schema** — new `users/{uid}/conceptProgress/{chunkId}`:
  - `status`: `'in-progress' | 'reviewed' | 'needs-revisit'` — client-written. Absent =
    not started (or in progress, if a score exists).
  - `statusUpdatedAt`: timestamp — client-written, must equal `request.time`.
  - `latestMiniQuizScore`: number 0–1 — server-only (`scoreTest`).
  - `latestMiniQuizAt`: timestamp — server-only.
  - `latestTestId`: string — server-only; links to the `testAttempts` doc with full detail.
  - *(Slice 4b)* `latestMiniQuizCorrect`, `latestMiniQuizTotal`: numbers — server-only; "N of M right".
  - *(Slice 4b)* `miniQuizPassCount`, `miniQuizFailCount`: numbers — server-only counters (`FieldValue.increment`).
- **Security rules**: new `match /users/{uid}/conceptProgress/{chunkId}`:
  - read: owner only.
  - create: owner, `request.resource.data.keys().hasOnly(['status','statusUpdatedAt'])`, status in
    the allowed set, `statusUpdatedAt == request.time`.
  - update: owner,
    `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status','statusUpdatedAt'])`,
    same status/timestamp checks.
  - delete: denied.
- **Cloud Functions**: `scoreTest` — add the Concept Progress merge for `mini-quiz` attempts.
  No new function.

## Dependencies
- **Blocked by**: ph-1-us-11 (`scoreTest`, Complete).
- **Parent**: ph-2-us-10 — this is the server-side half: record shape, what's writable, and the
  trusted score.
- **Consumed by**: ph-2-us-12 (client module).

## Test Notes
- **Happy path**: rules tests — owner reads, owner creates/updates status; functions test —
  scoring a mini-quiz writes score fields and leaves an existing `status` untouched.
- **Edge cases**: `scoreTest` on a topic with no existing doc (creates it, no status); a client
  status update after `scoreTest` has written score fields (allowed: only status keys change);
  retaking a quiz overwrites the latest score.
- **Failure modes**: client writes score (denied); client writes unknown key (denied); client
  writes `not-started` or a typo status (denied); other user's doc (denied); delete (denied);
  `statusUpdatedAt` set to a client-chosen time (denied).

## Tasks
- [x] Add the `conceptProgress` match block to `firestore.rules`.
- [x] Add rules tests to `firestore-tests/rules.test.ts` for every allow/deny case above
  (`npm run test:rules`).
- [x] Extend `scoreTest` to merge score fields for mini-quiz attempts, atomically with the
  attempt write, documented per the `cloud-function-documentation` skill.
- [x] Add functions tests (`npm run test:functions`).
- [x] Document `conceptProgress` in `functions/README.md` (under `scoreTest` persistence) and
  update the `firestore.rules` header comments.

## Implementation notes (Slice 4a)
Built in Slice 4a on `feat/concept-list-flashcards`; plan `docs/superpowers/plans/2026-10-03-slice-4a-concept-list-flashcards.md`, design `docs/superpowers/specs/2026-10-03-slice-4a-concept-list-flashcards-design.md`.
- Rules tests 54, functions tests 71. Deployed to dev 2026-10-10: the first attempt hit a transient `generateUploadUrl` upload error, the retry succeeded, and the invoker smoke check still returns 401.

## Implementation notes (Slice 4b)
Built in Slice 4b on `feat/mini-quiz-progress`; plan `docs/superpowers/plans/2026-10-11-slice-4b-mini-quiz-progress.md`, design `docs/superpowers/specs/2026-10-11-slice-4b-mini-quiz-progress-design.md` (including its Amendment A1-A7 from device testing). Device-tested on the Android emulator 2026-10-11.
- `scoreTest` also saves `latestMiniQuizCorrect` and `latestMiniQuizTotal` (spec decision 10) and increments `miniQuizPassCount` or `miniQuizFailCount` per topic (pass = score >= `MINI_QUIZ_PASS_THRESHOLD`, 0.8; spec A5), in the same merge as the score. Clients cannot write them (the existing `hasOnly` rule; new rules tests). Records from before Slice 4b have no counts or correct/total.
- `assembleMiniQuiz` sizes the quiz on the server: `round(pool / 3)`, at least 5, at most 15, the whole pool if fewer than 5 (ph-2-us-8).
- Rules tests 58, functions tests 86. Deployed to dev (`dmv-app-dev`), invoker smoke check 401.

## Questions
- Should Concept Progress also keep a best score, or a count of quiz attempts? Assumed not for
  MVP: `prd.md` Section 7 asks only for the latest score; full history is in `testAttempts`.
