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

## Local development

```bash
npm install        # from functions/
npm run build       # tsc -> lib/
```

Deployment isn't wired up yet (no `firebase deploy --only functions` has been run against a real
project) — this story only covers building and testing the function.
