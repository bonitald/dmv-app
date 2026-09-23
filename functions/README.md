# Cloud Functions

The first Cloud Function in this project (`CLAUDE.md`'s pure-BaaS architecture has one
deliberate, narrow exception here — see `docs/phases/phase-1-question-bank-and-content-model/ph-1-us-4-assemble-test-cloud-function.md`
for why). Has its own `package.json`/`node_modules`, separate from the Expo app's — the
deployed Functions runtime only installs what's declared here.

Run this package's own test suite with `npm run test:functions` from the repo root (starts the
Firestore emulator and runs `functions/`'s Jest suite against it). The suite talks to
`firebase-admin` directly against the emulator — it does not spin up the Functions emulator or
call through `httpsCallable`, since `assembleTestForUser` (the testable core) is a plain
function that the thin `onCall` wrapper in `assembleTest.ts` just forwards to.

## `assembleTest` (callable)

Server-side selects a bounded, randomized set of `approved` questions and returns it to an
authenticated caller. This is the **only** sanctioned way for a client to read question content
— `firestore.rules` denies all direct client reads of the `questions` collection (see
`ph-1-us-1`), specifically to prevent bulk extraction of the question bank.

**Auth**: requires a signed-in caller (anonymous auth is fine). Rejects with an `unauthenticated`
`HttpsError` and returns no content otherwise.

**Input**: none required for MVP.

**Output**:
```json
{
  "testId": "a locally-generated UUID, used as the frontend cache key (ph-1-us-5)",
  "questions": [
    { "id": "...", "text": "...", "choices": ["..."], "type": "fact | scenario", "chunkId": "...", "conceptId": "..." }
  ]
}
```
Deliberately omits `sourceRef`, `selfCheck`, and review metadata — the client never needs those.

**Selection**: reads only `status == 'approved'` questions, shuffles them (Fisher-Yates,
injectable random source for testing), and returns up to `DEFAULT_QUESTION_COUNT` (currently 25
— exact per-test count is still an open product question, see `prd.md` Section 9). Randomization
strategy is intentionally simple for MVP: fully random each call, repeats across a user's tests
allowed. Revisit if practice starts feeling repetitive.

**Persistence**: also writes `users/{uid}/testAssignments/{testId}` — `{ type: 'practice',
questionIds: string[], createdAt: FieldValue, scored: false }` — recording exactly which question
IDs were assigned. `scoreTest` (ph-1-us-11) reads this record to grade only questions actually
handed to this caller, rather than trusting arbitrary question IDs submitted by the client.

## `assembleMiniQuiz` (callable)

Server-side selects a bounded, topic-scoped, randomized set of `approved` questions for a specific
handbook chunk and returns it to an authenticated caller. Similar to `assembleTest` but intended
for review/drill sessions on a single topic rather than full practice tests.

**Auth**: requires a signed-in caller (anonymous auth is fine). Rejects with an `unauthenticated`
`HttpsError` and returns no content otherwise.

**Input**:
```json
{
  "chunkId": "string (required) — the handbook topic/chunk to quiz on (e.g. 'right-of-way')",
  "count": "number (optional) — how many questions to return; defaults to 10, capped at 10",
  "excludeIds": "string[] (optional) — question IDs from a previous quiz on this topic; used to avoid immediate repeats when the pool is large enough"
}
```

**Output**:
```json
{
  "testId": "a locally-generated UUID, used as the frontend cache key",
  "questions": [
    { "id": "...", "text": "...", "choices": ["..."], "type": "fact | scenario", "chunkId": "...", "conceptId": "..." }
  ]
}
```
Deliberately omits `correctAnswer`, `sourceRef`, and review metadata — the client never needs those.

**Selection**: reads only `status == 'approved'` questions matching the requested `chunkId`,
shuffles them (Fisher-Yates, injectable random source for testing), and returns up to
`MAX_MINI_QUIZ_COUNT` (10). When `excludeIds` is provided and the pool has enough questions
remaining after filtering them out, uses only the remaining pool; otherwise falls back to the
full pool to ensure repeats are unavoidable only on small topics.

**Persistence**: also writes `users/{uid}/testAssignments/{testId}` — `{ type: 'mini-quiz',
chunkId: string, questionIds: string[], createdAt: FieldValue, scored: false }` — recording
exactly which questions were assigned and their topic. `scoreTest` (ph-1-us-11) reads this record
to grade only questions actually handed to this caller, rather than trusting arbitrary question
IDs submitted by the client.

## `startOrResumeBaseline` (callable)

Serves the fixed baseline diagnostic (ph-1-us-8) one section at a time: starts a new user on
section 1, or returns the section they're currently on. The baseline doubles as the user's one
free full test.

**Auth**: requires a signed-in caller (anonymous auth is fine). Rejects with an `unauthenticated`
`HttpsError` otherwise.

**Input**: none. Which section to serve comes only from the server-side progress doc, so a client
can't skip ahead or replay an earlier section.

**Output**:
```json
{
  "testId": "baseline-{version}-{section}, e.g. baseline-v1-1 — scoreTest parses this format",
  "version": "v1",
  "section": 1,
  "totalSections": 3,
  "questions": [
    { "id": "...", "text": "...", "choices": ["..."], "type": "fact | scenario", "chunkId": "...", "conceptId": "..." }
  ]
}
```
Deliberately omits `correctAnswer`, `sourceRef`, and review metadata.

**Selection**: every user gets the same 45 questions — 3 sections of 15 in handbook order — read
by ID from `baselineTests/{version}` (published by `npm run qb:build-baseline`). No shuffling.
`CURRENT_BASELINE_VERSION` (`v1`) is the version new users start on; users keep the version stored
in their progress doc, so publishing and switching to a new version never disrupts someone
mid-baseline.

**Persistence**: on a user's first call, creates `users/{uid}/baseline/progress` —
`{ version, currentSection: 1, completedAt: null, freeTestUsedAt: null, createdAt }`. Calling again
without submitting returns the same section. Only `scoreTest` (ph-1-us-11) advances
`currentSection` and sets `completedAt`. Clients can read the progress doc but never write it.

**Errors**: `already-exists` means the baseline (and so the free test) has already been used;
`failed-precondition` means the baseline version isn't published yet, or the section
references a question that has since been deleted (the message names it; publish a new baseline
version to fix).

## `getFlashcards` (callable)

Returns every approved question in one topic, **with answers**, for flashcard study (ph-1-us-10).

**Auth**: requires a signed-in caller (anonymous auth is fine). Rejects with an `unauthenticated`
`HttpsError` otherwise.

**Input**:
```json
{ "chunkId": "string (required) — the handbook topic, e.g. 'right-of-way'" }
```

**Output**:
```json
{
  "chunkId": "right-of-way",
  "cards": [
    { "id": "...", "text": "...", "choices": ["..."], "correctAnswer": "...", "type": "fact | scenario", "chunkId": "...", "conceptId": "..." }
  ]
}
```
Unlike `assembleTest` and `assembleMiniQuiz`, cards **include `correctAnswer`** — flashcards show
the answer. `sourceRef` and review metadata are still omitted. Cards are shuffled on every call.

**Rate limit**: 30 calls per 10 minutes per user (`RATE_LIMIT_MAX_CALLS` / `RATE_LIMIT_WINDOW_MS`),
tracked server-side at `users/{uid}/rateLimits/flashcards`, which clients can't read or write. It
slows bulk scraping of the answer key; it doesn't prevent it. **These values are a starting
proposal, not a validated product decision** — tune them if real study sessions hit the limit.

**Persistence**: none beyond the rate-limit counter. Studying is unscored: nothing is written to
`testAssignments` or `testAttempts`.

**Errors**: `invalid-argument` (missing/empty `chunkId`), `not-found` (topic has no approved
questions), `resource-exhausted` (over the rate limit).

## `scoreTest` (callable)

Grades a submitted practice test, mini-quiz, or baseline section (ph-1-us-11). This is the only
place correct answers are compared with a student's choices — answers never leave the server.

**Auth**: requires a signed-in caller (anonymous auth is fine). Rejects with an `unauthenticated`
`HttpsError` otherwise.

**Input**:
```json
{
  "testId": "string — as returned by assembleTest, assembleMiniQuiz, or startOrResumeBaseline",
  "answers": [{ "questionId": "string", "choice": "string — the choice text picked" }]
}
```
Unanswered questions, and answers for questions that weren't assigned, count as wrong rather than
causing an error. Malformed answer entries are ignored.

**Output**:
```json
{
  "testId": "...",
  "type": "practice | mini-quiz | baseline",
  "score": 0.8,
  "correctCount": 12,
  "totalCount": 15,
  "perTopic": [{ "chunkId": "right-of-way", "correct": 3, "total": 4 }],
  "perQuestion": [{ "questionId": "...", "chunkId": "...", "choice": "... | null if skipped", "correctAnswer": "...", "correct": false }],
  "recommendation": "move-on | review-again | null"
}
```
`perQuestion` lists every assigned question in the order it was handed out, with the correct
answer, so the app can show what the student missed. Answers are revealed only after grading,
only for questions this user was assigned, and each session can be graded only once.

If an assigned question was deleted from the bank before grading, it's listed in `perQuestion`
with `unavailable: true` (and `chunkId`/`correctAnswer`/`correct` null) and left out of
`totalCount` and the score, so the student isn't marked down for it. Retire questions with a
non-`approved` status instead of deleting them where possible.

**Baseline answers are held back until the whole baseline is complete.** Every user takes the
same 45 questions, so revealing section 1's answers early would let them be shared. For each
section before the last, `perQuestion` has `correctAnswer: null` and `correct: null` — in the
response and in the saved attempt (which the client can read). Per-topic totals and the score
are still returned; because the baseline has one question per topic, those totals do show
right/wrong per question, just not the correct answer. Scoring the last section adds `baselineReview`: every question from all sections, in
baseline order, with the student's choice, the correct answer and whether it was right —
rebuilt from the choices saved on each earlier section's attempt.

**How each type is graded** — always against a server-side record, never question IDs the client
sends:
- **practice** / **mini-quiz**: `users/{uid}/testAssignments/{testId}`, written when
  `assembleTest` / `assembleMiniQuiz` handed the questions out. Marked `scored: true` afterward.
- **baseline**: detected by the `testId` format `baseline-{version}-{section}` (set by
  `startOrResumeBaseline`; practice and mini-quiz testIds are UUIDs and never start with
  `baseline-`). Grades that section of `baselineTests/{version}`, then advances
  `users/{uid}/baseline/progress`. After the last section it sets `completedAt` and
  `freeTestUsedAt`. Only the user's current section, in the version they're pinned to, can be
  submitted.

**Recommendation**: mini-quizzes only. `move-on` at or above `MINI_QUIZ_PASS_THRESHOLD` (0.8),
otherwise `review-again`. **The 80% threshold is prd.md's proposed default, not a validated
product decision.** `null` for practice tests and baseline sections.

**Persistence**: writes `users/{uid}/testAttempts/{testId}` — `{ type, chunkId (topic for a
mini-quiz, or for a practice test whose questions all share one; otherwise null), score,
correctCount, totalCount, perTopic, perQuestion, recommendation, createdAt }`, plus
`baselineReview` on the final baseline section's attempt. Clients can read attempts but
never write them.

**Errors**: `invalid-argument` (missing `testId`, non-array `answers`, malformed baseline
`testId`), `not-found` (no matching assignment or baseline for this user), `already-exists`
(already scored, or not the user's current baseline section).

## Local development

```bash
npm install        # from functions/
npm run build       # tsc -> lib/
```

Deployment isn't wired up yet (no `firebase deploy --only functions` has been run against a real
project) — this story only covers building and testing the function.
