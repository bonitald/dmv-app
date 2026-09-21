---
name: cloud-function-documentation
description: Require every Firebase Cloud Function written or modified in this repo (functions/src/) to carry a summary doc comment plus explanatory inline comments, so a developer new to the team can understand it without asking anyone. Use this skill whenever you write, add, scaffold, refactor, or review a Cloud Function (onCall, onRequest, Firestore/Auth/Scheduler triggers, or the helpers they call) — even if the user only says "add a function for X", "implement ph-1-us-N", or "write the backend for this story" and never mentions comments or documentation.
---

# Cloud Function documentation

Every Cloud Function in `functions/src/` must be readable by someone who has never seen this
codebase, the PRD, or the phase stories. Functions here touch minors' data, question content, and
test/driving logs, so a newcomer needs to know *what* a function does, *who* may call it, and *what
it changes* before they dare edit it. Comments are part of the deliverable, not polish — a function
without them is not finished.

Apply this when writing new functions and when materially editing existing ones. Don't rewrite
comments on untouched functions unless asked.

## What to write

### 1. A summary doc comment on every function

Put a JSDoc block directly above each exported Cloud Function **and** each non-trivial helper it
calls. Use this shape:

```ts
/**
 * <One-sentence plain-English summary of what the function does.>
 *
 * <Optional short paragraph: why it exists / where it fits in the product,
 * with the story or PRD reference, e.g. "ph-1-us-4".>
 *
 * Trigger:  <onCall | onRequest | Firestore onDocumentCreated(path) | scheduled (cron) | ...>
 * Auth:     <who may call it; what happens for unauthenticated callers>
 * Inputs:   <request fields / event data, with types and defaults>
 * Returns:  <shape of the result, or "nothing" for triggers>
 * Reads:    <Firestore collections/docs read>
 * Writes:   <Firestore docs written, other side effects: emails, analytics, etc. — or "none">
 * Errors:   <each HttpsError code thrown and the condition that causes it>
 */
```

Rules for the block:
- Omit a line only if it truly doesn't apply — write `none` rather than leaving it out for
  Reads/Writes, since "no side effects" is useful information.
- Describe behavior, not implementation. "Picks 25 random approved questions" beats "calls shuffle".
- State non-obvious guarantees and gaps explicitly (e.g. "does not persist the test; the client
  submits answers separately", "answers are deliberately not returned").
- Link the source of truth when a decision comes from a doc: story ID (`ph-1-us-4`) or PRD section.

### 2. Inline comments throughout the body

Comment the function's logic in reading order so the code reads like a walkthrough:
- One comment per logical step ("Reject callers who aren't signed in", "Load every approved
  question", "Shuffle so each test differs", "Strip fields the client must not see").
- Explain the **why** for anything a newcomer could plausibly "fix" wrongly: security choices,
  ordering requirements, why a field is omitted, why a constant exists, why an injectable
  parameter (like `random`) is there (usually testability).
- Explain Firebase-specific behavior a newcomer may not know (e.g. `onCall` auto-verifies the ID
  token and populates `request.auth`; `HttpsError` codes map to client error codes).
- Don't restate what the code says word for word (`// increment i` on `i++`). If a line is
  self-evident, skip it — noise hides the useful comments.

### 3. Comments on supporting declarations

Add a short comment to exported interfaces/types the function returns or accepts (what each field
means, and which fields are intentionally absent), and to module-level constants (why this value,
where it's defined to change).

## Workflow

1. Write the function.
2. Add the doc block and inline comments as part of the same edit — not as a follow-up.
3. Reread it as a new hire: could they answer "who can call this, what does it change, how can it
   fail?" from the comments alone? If not, fill the gap.
4. Keep comments in sync when you later change behavior; a stale comment is worse than none.

## Example

This is the target level of documentation, shown on the pattern used in
`functions/src/assembleTest.ts`:

```ts
/**
 * Builds a fresh practice test for the signed-in user from the approved question bank.
 *
 * Implements ph-1-us-4. Split from the `assembleTest` export below so it can be unit-tested
 * without the Firebase runtime (db, auth and randomness are all passed in).
 *
 * Trigger:  called by the `assembleTest` onCall wrapper
 * Auth:     requires a signed-in user (anonymous auth counts); otherwise throws
 * Inputs:   db — Firestore instance; auth — request.auth; options.count (default 25);
 *           options.random (default Math.random, injectable for deterministic tests)
 * Returns:  { testId, questions[] } — questions include text/choices/type/conceptId only;
 *           the correct answer is deliberately NOT sent to the client
 * Reads:    `questions` collection, where status == 'approved'
 * Writes:   none (the test is not persisted here)
 * Errors:   HttpsError('unauthenticated') when `auth` is missing
 */
export async function assembleTestForUser(/* ... */) {
  // Callable functions expose the caller via `auth`; it is undefined when no valid ID token was sent.
  if (!auth) {
    throw new HttpsError('unauthenticated', 'assembleTest requires a signed-in caller.');
  }

  // Only questions reviewed and marked 'approved' may reach students (draft/rejected stay hidden).
  const snapshot = await db.collection('questions').where('status', '==', 'approved').get();

  // Shuffle the whole pool, then take the first N — gives each test a random, non-repeating set.
  const selected = shuffle(snapshot.docs, random).slice(0, count);

  // Map to the client-safe shape. Fields like the correct answer are intentionally left out.
  // ...
}
```

## Existing code

If asked to retrofit older functions, follow the same rules and change comments only — no
behavior changes in the same edit.
