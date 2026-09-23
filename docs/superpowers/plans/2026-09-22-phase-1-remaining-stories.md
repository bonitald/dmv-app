# Phase 1 Remaining User Stories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 7 remaining Phase 1 user stories (ph-1-us-3/5/7/8/9/10/11) so Phase 1's
question-bank backend is complete: topic catalog, mini-quiz assembly, baseline diagnostic,
flashcard delivery, scoring, narrowed security rules, and the frontend test-set cache.

**Architecture:** Extend the existing `functions/` Cloud Functions package (one file per
callable, thin `onCall` wrapper around a pure, unit-testable `*ForUser` function, mirroring
`assembleTest.ts`) and the existing `scripts/question-bank/` Admin-SDK CLI package (one `lib/`
module + one CLI entrypoint per script, mirroring `writeQuestions.ts`). Add one new frontend
module (`src/study/testCache.ts`). Narrow `firestore.rules` once, centrally, to unblock the
server-owned collections every backend story writes to.

**Tech Stack:** TypeScript, Firebase Cloud Functions v2 (`onCall`/`HttpsError`), `firebase-admin`
Firestore, Jest + `ts-jest` against the Firestore emulator, `@firebase/rules-unit-testing`,
`@react-native-async-storage/async-storage`.

**Spec:** `docs/phases/phase-1-question-bank-and-content-model/*.md` (ph-1-us-3, -5, -7, -8, -9,
-10, -11) and `phase-1-summary.md` for cross-story decisions.

## Global Constraints

- No direct client reads of `questions` — every new read path goes through a callable Cloud
  Function that returns a bounded, field-filtered subset.
- `correctAnswer` never leaves the server except via `getFlashcards` (deliberate, documented
  exception) — `assembleTest`/`assembleMiniQuiz`/`startOrResumeBaseline` never include it.
- Every new Firestore collection/field that must not be client-writable needs an explicit
  `firestore.rules` rule (default-deny is not enough on its own — write matching `rules.test.ts`
  cases both ways).
- Every Cloud Function is a thin `onCall` wrapper around an exported `*ForUser`/`*For...`
  function that takes `db`/`auth`/inputs as parameters (never reads globals), so it's testable
  against the emulator without the Functions emulator — mirrors `assembleTest.ts`.
- Run backend tests with `npm run test:functions` (functions/) and `npm run test:question-bank`
  (scripts/) from the repo root; rules tests with `npm run test:rules`. All three start the
  Firestore emulator themselves via `firebase emulators:exec`.
- Commit after each task.

---

## File Structure

- `functions/src/shuffle.ts` — extracted Fisher–Yates shuffle, shared by every assembly function.
- `functions/src/assembleTest.ts` — modified: adds `chunkId` to the response, persists
  `testAssignments/{testId}`.
- `functions/src/assembleMiniQuiz.ts` — new, ph-1-us-7.
- `functions/src/startOrResumeBaseline.ts` — new, ph-1-us-8.
- `functions/src/getFlashcards.ts` — new, ph-1-us-10.
- `functions/src/scoreTest.ts` — new, ph-1-us-11.
- `functions/src/index.ts` — modified: exports the four new callables.
- `firestore.rules` — modified: narrows `users/{uid}/{document=**}`, adds `topics` read rule.
- `firestore-tests/rules.test.ts` — modified: covers the narrowed rules.
- `scripts/question-bank/lib/types.ts` — modified: adds `BaselineTestRecord`/`BaselineSection`.
- `scripts/question-bank/lib/publishTopics.ts` + `publish-topics.ts` — new, ph-1-us-9.
- `scripts/question-bank/lib/buildBaseline.ts` + `build-baseline.ts` — new, ph-1-us-8.
- `scripts/question-bank/lib/validateBaseline.ts` + `validate-baseline.ts` — new, ph-1-us-8 AC.
- `src/study/testCache.ts` — new, ph-1-us-5.
- `package.json` — modified: adds `qb:publish-topics`, `qb:build-baseline`,
  `qb:validate-baseline` scripts and the AsyncStorage dependency.
- `functions/README.md`, `scripts/question-bank/README.md` — modified: document new contracts.

---

### Task 1: Shared `shuffle` helper

**Files:**
- Create: `functions/src/shuffle.ts`
- Modify: `functions/src/assembleTest.ts`

**Interfaces:**
- Produces: `shuffle<T>(items: T[], random: () => number): T[]` — used by every later assembly
  task (`assembleMiniQuiz`, `startOrResumeBaseline`, `getFlashcards`).

- [x] **Step 1: Extract the shuffle function**

Create `functions/src/shuffle.ts`:
```ts
/**
 * Returns a new array with the items in random order (Fisher–Yates shuffle).
 *
 * Fisher–Yates gives every ordering equal probability, unlike naive sort-by-random tricks.
 * The input array is copied first, so the caller's array is never mutated. `random` is
 * injected so tests can supply a predictable sequence.
 */
export function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
```

- [x] **Step 2: Remove the local copy from `assembleTest.ts` and import the shared one**

In `functions/src/assembleTest.ts`, delete the local `function shuffle<T>(...)` definition
(lines 97-113 as currently written) and add near the top:
```ts
import { shuffle } from './shuffle';
```

- [x] **Step 3: Run the existing function tests to confirm nothing broke**

Run: `npm run test:functions`
Expected: all existing `assembleTest.test.ts` tests still PASS (behavior unchanged, pure refactor).

- [x] **Step 4: Commit**

```bash
git add functions/src/shuffle.ts functions/src/assembleTest.ts
git commit -m "refactor: extract shared shuffle helper from assembleTest"
```

---

### Task 2: `assembleTest` — add `chunkId`, persist `testAssignments`

Closes the ph-1-us-11 "Persist assignments in `assembleTest`" follow-up task and the ph-1-us-7
"same collection `assembleTest` writes practice sets to" dependency. Must land before Task 4
(mini-quiz) and Task 6 (scoring), both of which read/write `testAssignments`.

**Files:**
- Modify: `functions/src/assembleTest.ts`
- Modify: `functions/src/assembleTest.test.ts`
- Modify: `functions/README.md`

**Interfaces:**
- Consumes: `shuffle` from Task 1.
- Produces: `AssembledQuestion` now includes `chunkId: string` (used by Task 4, Task 5, Task 6,
  Task 7's shared question shape). `testAssignments/{testId}` document shape:
  `{ type: 'practice', questionIds: string[], createdAt: FieldValue, scored: false }` — same
  shape Task 4 writes with `type: 'mini-quiz'` and an added `chunkId` field.

- [x] **Step 1: Update the failing test for the new field first**

In `functions/src/assembleTest.test.ts`, update the `'returns only the client-safe fields...'`
test's expectation (currently asserts an exact object without `chunkId`):
```ts
  test('returns only the client-safe fields, not sourceRef/selfCheck/review metadata', async () => {
    await seedQuestion('q1');

    const result = await assembleTestForUser(db, { uid: 'alice-uid' }, { count: 1 });

    expect(result.questions[0]).toEqual({
      id: 'q1',
      text: 'Question q1',
      choices: ['a', 'b', 'c'],
      type: 'fact',
      chunkId: 'chunk-1',
      conceptId: 'concept-1',
    });
  });
```

Add a new test at the end of the `describe` block:
```ts
  test('persists a practice testAssignments record for the caller', async () => {
    await seedQuestion('q1');
    await seedQuestion('q2');

    const result = await assembleTestForUser(db, { uid: 'alice-uid' }, { count: 2 });

    const assignmentSnap = await db
      .collection('users')
      .doc('alice-uid')
      .collection('testAssignments')
      .doc(result.testId)
      .get();

    expect(assignmentSnap.exists).toBe(true);
    const assignment = assignmentSnap.data()!;
    expect(assignment.type).toBe('practice');
    expect(assignment.scored).toBe(false);
    expect(assignment.questionIds.sort()).toEqual(result.questions.map((q) => q.id).sort());
    expect(assignment.createdAt).toBeDefined();
  });
```

- [x] **Step 2: Run tests to verify the new/updated assertions fail**

Run: `npm run test:functions`
Expected: FAIL — `chunkId` missing from the returned question, and no `testAssignments` doc.

- [x] **Step 3: Implement**

In `functions/src/assembleTest.ts`:
1. Add `chunkId: string;` to the `AssembledQuestion` interface (after `type`).
2. In `assembleTestForUser`, move `const testId = randomUUID();` above the `questions` mapping
   (currently it's only built in the return statement) and add `chunkId: data.chunkId` to the
   per-question mapping.
3. After building `questions`, before `return`, add:
```ts
  await db
    .collection('users')
    .doc(auth.uid)
    .collection('testAssignments')
    .doc(testId)
    .set({
      type: 'practice',
      questionIds: questions.map((q) => q.id),
      createdAt: FieldValue.serverTimestamp(),
      scored: false,
    });
```
4. Add `import { FieldValue } from 'firebase-admin/firestore';` (alongside the existing `type
   Firestore` import — split into two import statements or one combined import).
5. Update the final `return` to use the hoisted `testId` instead of calling `randomUUID()` again.

- [x] **Step 4: Run tests to verify they pass**

Run: `npm run test:functions`
Expected: PASS.

- [x] **Step 5: Update `functions/README.md`'s `assembleTest` section**

Add `chunkId` to the documented output JSON, and a line noting the function now also persists
`users/{uid}/testAssignments/{testId}` (`{ type: 'practice', questionIds, createdAt, scored:
false }`), consumed by `scoreTest` (ph-1-us-11).

- [x] **Step 6: Commit**

```bash
git add functions/src/assembleTest.ts functions/src/assembleTest.test.ts functions/README.md
git commit -m "feat: assembleTest returns chunkId and persists testAssignments"
```

---

### Task 3: Narrow `firestore.rules` for server-owned collections

Must land before Task 4-6, all of which rely on `testAssignments`/`baseline`/`testAttempts`
being unwritable by clients (this is the "Rules gap" flagged in ph-1-us-8).

**Files:**
- Modify: `firestore.rules`
- Modify: `firestore-tests/rules.test.ts`

**Interfaces:**
- Produces: `users/{uid}` (top-level profile doc) stays client read/write. `users/{uid}/
  testAssignments/{testId}`, `users/{uid}/testAttempts/{testId}`, `users/{uid}/baseline/{docId}`
  become client-read-only (written only by Cloud Functions via the Admin SDK, which bypasses
  rules entirely). `topics/{chunkId}` becomes authenticated-read, no client write.

- [x] **Step 1: Write the failing rules tests**

Add to `firestore-tests/rules.test.ts` (after the existing tests, before the final closing):
```ts
test('a signed-in device cannot write its own testAssignments doc', async () => {
  const alice = testEnv.authenticatedContext('alice-uid').firestore();

  await assertFails(
    setDoc(doc(alice, 'users/alice-uid/testAssignments/t1'), { type: 'practice' })
  );
});

test('a signed-in device can read its own testAssignments doc', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/alice-uid/testAssignments/t1'), {
      type: 'practice',
    });
  });

  const alice = testEnv.authenticatedContext('alice-uid').firestore();
  await assertSucceeds(getDoc(doc(alice, 'users/alice-uid/testAssignments/t1')));
});

test("a signed-in device cannot read another device's testAssignments doc", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/bob-uid/testAssignments/t1'), {
      type: 'practice',
    });
  });

  const alice = testEnv.authenticatedContext('alice-uid').firestore();
  await assertFails(getDoc(doc(alice, 'users/bob-uid/testAssignments/t1')));
});

test('a signed-in device cannot write its own testAttempts doc', async () => {
  const alice = testEnv.authenticatedContext('alice-uid').firestore();

  await assertFails(setDoc(doc(alice, 'users/alice-uid/testAttempts/t1'), { score: 1 }));
});

test('a signed-in device cannot write its own baseline progress doc', async () => {
  const alice = testEnv.authenticatedContext('alice-uid').firestore();

  await assertFails(
    setDoc(doc(alice, 'users/alice-uid/baseline/progress'), { currentSection: 1 })
  );
});

test('a signed-in device can read its own baseline progress doc', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/alice-uid/baseline/progress'), {
      currentSection: 1,
    });
  });

  const alice = testEnv.authenticatedContext('alice-uid').firestore();
  await assertSucceeds(getDoc(doc(alice, 'users/alice-uid/baseline/progress')));
});

test('a signed-in device can read topics', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'topics/right-of-way'), { title: 'Right of Way' });
  });

  const alice = testEnv.authenticatedContext('alice-uid').firestore();
  await assertSucceeds(getDoc(doc(alice, 'topics/right-of-way')));
});

test('a signed-in device cannot write topics', async () => {
  const alice = testEnv.authenticatedContext('alice-uid').firestore();

  await assertFails(setDoc(doc(alice, 'topics/right-of-way'), { title: 'Hacked' }));
});

test('an unauthenticated device cannot read topics', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'topics/right-of-way'), { title: 'Right of Way' });
  });

  const anon = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anon, 'topics/right-of-way')));
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npm run test:rules`
Expected: FAIL — the current wildcard rule still allows writes to `testAssignments`/
`testAttempts`/`baseline`, and `topics` isn't matched by any rule (falls through to deny, so the
two "cannot" topics tests already pass, but both "can read" topics tests fail).

- [x] **Step 3: Implement the narrowed rules**

Replace the full contents of `firestore.rules`:
```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // ph-0-us-6: baseline per-user scoping for the user's own top-level profile doc.
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // ph-1-us-8/ph-1-us-11: server-owned records under users/{uid} — written only by Cloud
    // Functions via the Admin SDK (which bypasses these rules entirely), read-only to the
    // owning client. The old `users/{uid}/{document=**}` wildcard let a signed-in user write
    // anything under their own uid; since Firestore rules are OR'd, a more specific deny rule
    // could not have tightened that, so it had to be replaced with these explicit paths instead.
    match /users/{uid}/testAssignments/{testId} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;
    }
    match /users/{uid}/testAttempts/{testId} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;
    }
    match /users/{uid}/baseline/{docId} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;
    }

    // ph-1-us-9: topic catalog — holds no question content, so it's safe to expose to any
    // signed-in client. Populated only by the publish-topics script (Admin SDK).
    match /topics/{chunkId} {
      allow read: if request.auth != null;
      allow write: if false;
    }

    // Everything else stays deny-all (ph-0-us-3's locked-by-default baseline). Later phases
    // that need a client-writable sub-collection under users/{uid} (driving sessions, test
    // outcomes, settings) add an explicit `match` block here rather than reopening the wildcard.
  }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm run test:rules`
Expected: PASS — all rules tests, including the pre-existing `users/{uid}` top-level ones (still
covered by the new `match /users/{uid}`).

- [x] **Step 5: Commit**

```bash
git add firestore.rules firestore-tests/rules.test.ts
git commit -m "fix: narrow firestore.rules to explicit server-owned paths under users/{uid}"
```

---

### Task 4: `assembleMiniQuiz` Cloud Function (ph-1-us-7)

**Files:**
- Create: `functions/src/assembleMiniQuiz.ts`
- Create: `functions/src/assembleMiniQuiz.test.ts`
- Modify: `functions/src/index.ts`
- Modify: `functions/README.md`

**Interfaces:**
- Consumes: `shuffle` (Task 1), `AssembledQuestion` type (Task 2, now has `chunkId`), `getDb`
  (`adminApp.ts`), the `testAssignments` write pattern from Task 2.
- Produces: `assembleMiniQuizForUser(db, auth, input, options?): Promise<{ testId: string;
  questions: AssembledQuestion[] }>` — used only by this task's `onCall` wrapper, but Task 6
  (`scoreTest`) reads the `testAssignments` doc this function writes (`type: 'mini-quiz'`,
  `chunkId`, `questionIds`, `createdAt`, `scored: false`).

- [x] **Step 1: Write the failing tests**

Create `functions/src/assembleMiniQuiz.test.ts`:
```ts
import { getDb } from './adminApp';
import { assembleMiniQuizForUser } from './assembleMiniQuiz';

describe('assembleMiniQuizForUser', () => {
  const db = getDb();

  beforeEach(async () => {
    const snap = await db.collection('questions').get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
    const usersSnap = await db.collection('users').get();
    for (const userDoc of usersSnap.docs) {
      const assignments = await userDoc.ref.collection('testAssignments').get();
      await Promise.all(assignments.docs.map((d) => d.ref.delete()));
    }
  });

  async function seedQuestion(id: string, overrides: Record<string, unknown> = {}) {
    await db
      .collection('questions')
      .doc(id)
      .set({
        conceptId: 'concept-1',
        chunkId: 'right-of-way',
        sourceRef: 'DR_2337_Jan2025.pdf#p12',
        type: 'fact',
        text: `Question ${id}`,
        choices: ['a', 'b', 'c'],
        correctAnswer: 'a',
        status: 'approved',
        selfCheck: { passed: true },
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
        ...overrides,
      });
  }

  test('rejects a call with no authenticated user', async () => {
    await expect(
      assembleMiniQuizForUser(db, undefined, { chunkId: 'right-of-way' })
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  test('rejects a missing or malformed chunkId', async () => {
    await expect(
      assembleMiniQuizForUser(db, { uid: 'alice-uid' }, { chunkId: '' })
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(
      assembleMiniQuizForUser(db, { uid: 'alice-uid' }, {})
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('returns not-found for a topic with no approved questions', async () => {
    await seedQuestion('q1', { status: 'pending_review' });

    await expect(
      assembleMiniQuizForUser(db, { uid: 'alice-uid' }, { chunkId: 'right-of-way' })
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  test('returns only approved questions from the requested topic', async () => {
    await seedQuestion('q1', { chunkId: 'right-of-way', status: 'approved' });
    await seedQuestion('q2', { chunkId: 'other-topic', status: 'approved' });
    await seedQuestion('q3', { chunkId: 'right-of-way', status: 'pending_review' });

    const result = await assembleMiniQuizForUser(db, { uid: 'alice-uid' }, {
      chunkId: 'right-of-way',
    });

    expect(result.questions.map((q) => q.id)).toEqual(['q1']);
    expect(result.questions[0]).not.toHaveProperty('correctAnswer');
    expect(result.questions[0]).not.toHaveProperty('sourceRef');
  });

  test('caps the returned count at the server maximum even if more is requested', async () => {
    for (let i = 1; i <= 12; i++) {
      await seedQuestion(`q${i}`);
    }

    const result = await assembleMiniQuizForUser(db, { uid: 'alice-uid' }, {
      chunkId: 'right-of-way',
      count: 999,
    });

    expect(result.questions.length).toBe(10);
  });

  test('persists a mini-quiz testAssignments record with the chunkId', async () => {
    await seedQuestion('q1');

    const result = await assembleMiniQuizForUser(db, { uid: 'alice-uid' }, {
      chunkId: 'right-of-way',
    });

    const assignmentSnap = await db
      .collection('users')
      .doc('alice-uid')
      .collection('testAssignments')
      .doc(result.testId)
      .get();

    expect(assignmentSnap.data()).toMatchObject({
      type: 'mini-quiz',
      chunkId: 'right-of-way',
      scored: false,
    });
  });

  test('avoids repeating the excluded set when the pool allows it', async () => {
    await seedQuestion('q1');
    await seedQuestion('q2');

    const result = await assembleMiniQuizForUser(db, { uid: 'alice-uid' }, {
      chunkId: 'right-of-way',
      count: 1,
      excludeIds: ['q1'],
    });

    expect(result.questions.map((q) => q.id)).toEqual(['q2']);
  });

  test('falls back to the full pool when excluding would leave too few questions', async () => {
    await seedQuestion('q1');

    const result = await assembleMiniQuizForUser(db, { uid: 'alice-uid' }, {
      chunkId: 'right-of-way',
      count: 1,
      excludeIds: ['q1'],
    });

    expect(result.questions.map((q) => q.id)).toEqual(['q1']);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npm run test:functions`
Expected: FAIL with "Cannot find module './assembleMiniQuiz'".

- [x] **Step 3: Implement**

Create `functions/src/assembleMiniQuiz.ts`:
```ts
import { randomUUID } from 'crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getDb } from './adminApp';
import type { AssembledQuestion } from './assembleTest';
import { shuffle } from './shuffle';

// ph-1-us-7: server-enforced cap on how many questions one mini-quiz can request.
const MAX_MINI_QUIZ_COUNT = 10;
const DEFAULT_MINI_QUIZ_COUNT = 10;

export interface AssembleMiniQuizResult {
  testId: string;
  questions: AssembledQuestion[];
}

interface AssembleMiniQuizInput {
  chunkId?: unknown;
  count?: unknown;
  excludeIds?: unknown; // question IDs from the caller's previous mini-quiz on this topic
}

interface AssembleMiniQuizOptions {
  random?: () => number;
}

/**
 * Builds a short, topic-scoped quiz for the signed-in user.
 *
 * Implements ph-1-us-7. Same shape as `assembleTestForUser` (ph-1-us-4) — no answers, a
 * persisted `testAssignments` record under the returned `testId` — but scoped to one topic
 * (`chunkId`) and capped at MAX_MINI_QUIZ_COUNT rather than the whole approved bank.
 *
 * Trigger:  called by the `assembleMiniQuiz` onCall wrapper below
 * Auth:     requires a signed-in caller; otherwise `unauthenticated`
 * Inputs:   input.chunkId — required, the topic to quiz
 *           input.count — optional, defaults to 10, capped at 10
 *           input.excludeIds — optional, previous set's question IDs; used to avoid an
 *             immediate repeat on "Review Again" when the topic's pool is large enough to do so
 * Returns:  { testId, questions[] } — no correctAnswer/sourceRef/selfCheck/review metadata
 * Reads:    `questions` where chunkId == input.chunkId and status == 'approved'
 * Writes:   `users/{uid}/testAssignments/{testId}` — { type: 'mini-quiz', chunkId,
 *           questionIds, createdAt, scored: false } — graded later by scoreTest (ph-1-us-11)
 * Errors:   HttpsError('unauthenticated'), ('invalid-argument') for a bad/missing chunkId or
 *           count, ('not-found') when the topic has no approved questions
 */
export async function assembleMiniQuizForUser(
  db: Firestore,
  auth: { uid: string } | undefined,
  input: AssembleMiniQuizInput,
  options: AssembleMiniQuizOptions = {}
): Promise<AssembleMiniQuizResult> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'assembleMiniQuiz requires a signed-in caller.');
  }

  const chunkId = input.chunkId;
  if (typeof chunkId !== 'string' || chunkId.length === 0) {
    throw new HttpsError('invalid-argument', 'chunkId must be a non-empty string.');
  }

  const requestedCount = input.count === undefined ? DEFAULT_MINI_QUIZ_COUNT : input.count;
  if (
    typeof requestedCount !== 'number' ||
    !Number.isInteger(requestedCount) ||
    requestedCount <= 0
  ) {
    throw new HttpsError('invalid-argument', 'count must be a positive integer.');
  }
  const count = Math.min(requestedCount, MAX_MINI_QUIZ_COUNT);

  const excludeIds = Array.isArray(input.excludeIds)
    ? input.excludeIds.filter((id): id is string => typeof id === 'string')
    : [];

  const random = options.random ?? Math.random;

  const snapshot = await db
    .collection('questions')
    .where('chunkId', '==', chunkId)
    .where('status', '==', 'approved')
    .get();

  if (snapshot.empty) {
    throw new HttpsError('not-found', `No approved questions exist for chunkId "${chunkId}".`);
  }

  // Prefer the pool with the previous set excluded, but only if enough remains — otherwise
  // fall back to the full pool (repeats are unavoidable on a small topic, per ph-1-us-7 AC).
  const withoutRepeats =
    excludeIds.length > 0 ? snapshot.docs.filter((doc) => !excludeIds.includes(doc.id)) : snapshot.docs;
  const pool = withoutRepeats.length >= count ? withoutRepeats : snapshot.docs;

  const shuffled = shuffle(pool, random);
  const selected = shuffled.slice(0, count);

  const questions: AssembledQuestion[] = selected.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      text: data.text,
      choices: data.choices,
      type: data.type,
      chunkId: data.chunkId,
      conceptId: data.conceptId,
    };
  });

  const testId = randomUUID();
  await db
    .collection('users')
    .doc(auth.uid)
    .collection('testAssignments')
    .doc(testId)
    .set({
      type: 'mini-quiz',
      chunkId,
      questionIds: questions.map((q) => q.id),
      createdAt: FieldValue.serverTimestamp(),
      scored: false,
    });

  return { testId, questions };
}

/** The deployed Cloud Function — thin wrapper, see `assembleMiniQuizForUser` for the logic. */
export const assembleMiniQuiz = onCall((request) =>
  assembleMiniQuizForUser(getDb(), request.auth, request.data ?? {})
);
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm run test:functions`
Expected: PASS.

- [x] **Step 5: Register the export and document it**

In `functions/src/index.ts`, add:
```ts
export { assembleMiniQuiz } from './assembleMiniQuiz';
```

In `functions/README.md`, add a new `## assembleMiniQuiz (callable)` section following the same
structure as the existing `assembleTest` section: auth requirement, input
`{ chunkId: string, count?: number, excludeIds?: string[] }`, output shape, selection rules
(topic-scoped, capped at 10, excludeIds best-effort repeat avoidance), and the
`testAssignments` write.

- [x] **Step 6: Commit**

```bash
git add functions/src/assembleMiniQuiz.ts functions/src/assembleMiniQuiz.test.ts functions/src/index.ts functions/README.md
git commit -m "feat: add assembleMiniQuiz callable for topic-scoped mini-quizzes"
```

---

### Task 5: Topic catalog population script (ph-1-us-9)

**Files:**
- Create: `scripts/question-bank/lib/publishTopics.ts`
- Create: `scripts/question-bank/lib/publishTopics.test.ts`
- Create: `scripts/question-bank/publish-topics.ts`
- Modify: `package.json` (add `qb:publish-topics` script)
- Modify: `scripts/question-bank/README.md`

**Interfaces:**
- Consumes: `getDb` (`lib/adminApp.ts`), `readChunkPlan` (`lib/readChunkPlan.ts`).
- Produces: `publishTopics(runId: string): Promise<{ runId: string; topicsWritten: number }>` —
  writes `topics/{chunkId}` docs consumed by Task 4/6's callers and Task 6 (`buildBaseline`
  reads `topics/{chunkId}.order` to sequence sections).

- [x] **Step 1: Write the failing test**

Create `scripts/question-bank/lib/publishTopics.test.ts`:
```ts
import { getDb } from './adminApp';
import { publishTopics } from './publishTopics';
import type { IngestionRunRecord } from './types';

async function seedRun(chunks: IngestionRunRecord['chunks']): Promise<string> {
  const ref = getDb().collection('ingestionRuns').doc();
  await ref.set({ sourceDoc: 'x.pdf', createdAt: new Date(), status: 'complete', chunks });
  return ref.id;
}

async function seedQuestion(chunkId: string, status: string) {
  await getDb()
    .collection('questions')
    .doc()
    .set({
      conceptId: 'c1',
      chunkId,
      sourceRef: 'p.1',
      type: 'fact',
      text: 'x',
      choices: ['a', 'b'],
      correctAnswer: 'a',
      status,
      selfCheck: { passed: true },
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null,
    });
}

describe('publishTopics', () => {
  const baseChunk = {
    title: 'Right of Way',
    description: 'desc',
    pageStart: 12,
    pageEnd: 13,
    status: 'done' as const,
    questionsGenerated: 2,
    error: null,
  };

  it('writes a topics doc per chunk with the approved question count', async () => {
    const runId = await seedRun([{ ...baseChunk, chunkId: 'row' }]);
    await seedQuestion('row', 'approved');
    await seedQuestion('row', 'approved');
    await seedQuestion('row', 'pending_review');

    const result = await publishTopics(runId);

    expect(result.topicsWritten).toBe(1);
    const topicSnap = await getDb().collection('topics').doc('row').get();
    expect(topicSnap.data()).toEqual({
      title: 'Right of Way',
      description: 'desc',
      order: 12,
      approvedQuestionCount: 2,
    });
  });

  it('is idempotent when re-run', async () => {
    const runId = await seedRun([{ ...baseChunk, chunkId: 'row' }]);
    await seedQuestion('row', 'approved');

    await publishTopics(runId);
    await seedQuestion('row', 'approved');
    await publishTopics(runId);

    const topicSnap = await getDb().collection('topics').doc('row').get();
    expect(topicSnap.data()?.approvedQuestionCount).toBe(2);
  });

  it('rejects an unknown runId', async () => {
    await expect(publishTopics('nonexistent-run')).rejects.toThrow('does not exist');
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npm run test:question-bank`
Expected: FAIL with "Cannot find module './publishTopics'".

- [x] **Step 3: Implement**

Create `scripts/question-bank/lib/publishTopics.ts`:
```ts
import { getDb } from './adminApp';
import { readChunkPlan } from './readChunkPlan';

export interface PublishTopicsResult {
  runId: string;
  topicsWritten: number;
}

export async function publishTopics(runId: string): Promise<PublishTopicsResult> {
  const run = await readChunkPlan(runId);
  const db = getDb();
  const batch = db.batch();

  for (const chunk of run.chunks) {
    const approvedSnap = await db
      .collection('questions')
      .where('chunkId', '==', chunk.chunkId)
      .where('status', '==', 'approved')
      .get();

    batch.set(db.collection('topics').doc(chunk.chunkId), {
      title: chunk.title,
      description: chunk.description,
      order: chunk.pageStart,
      approvedQuestionCount: approvedSnap.size,
    });
  }

  await batch.commit();
  return { runId, topicsWritten: run.chunks.length };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm run test:question-bank`
Expected: PASS.

- [x] **Step 5: Add the CLI entrypoint and npm script**

Create `scripts/question-bank/publish-topics.ts`:
```ts
import { publishTopics } from './lib/publishTopics';

async function main() {
  const [, , runId] = process.argv;
  if (!runId) {
    console.error('Usage: publish-topics <runId>');
    process.exit(1);
  }

  const result = await publishTopics(runId);
  console.log(`Published ${result.topicsWritten} topic(s) from ${result.runId}`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
```

In `package.json`'s `scripts`, add (alongside the other `qb:*` entries):
```json
"qb:publish-topics": "tsx scripts/question-bank/publish-topics.ts",
```

- [x] **Step 6: Document in `scripts/question-bank/README.md`**

Add a `## qb:publish-topics (after review, repeatable)` section documenting usage
(`npm run qb:publish-topics -- <runId>`), that it's safe to re-run (idempotent — recomputes
`approvedQuestionCount` each time), and that it holds no question content by design (ph-1-us-9).

- [x] **Step 7: Commit**

```bash
git add scripts/question-bank/lib/publishTopics.ts scripts/question-bank/lib/publishTopics.test.ts scripts/question-bank/publish-topics.ts package.json scripts/question-bank/README.md
git commit -m "feat: add publish-topics script for the readable topic catalog"
```

---

### Task 6: Topics Firestore rule (ph-1-us-9)

Already covered by Task 3's rules change and tests (the `topics/{chunkId}` match block and its
rules tests). No additional work — this task is a checkpoint, not new code.

- [ ] **Step 1: Confirm Task 3 is complete and its topics-specific tests pass**

Run: `npm run test:rules`
Expected: PASS, including `'a signed-in device can read topics'`, `'...cannot write topics'`,
`'an unauthenticated device cannot read topics'`.

(No commit — nothing new to add; this step exists only to make the ph-1-us-9 rules AC
traceable to a task in this plan.)

---

### Task 7: Baseline definition build + validate scripts (ph-1-us-8, part 1)

**Files:**
- Modify: `scripts/question-bank/lib/types.ts`
- Create: `scripts/question-bank/lib/buildBaseline.ts`
- Create: `scripts/question-bank/lib/buildBaseline.test.ts`
- Create: `scripts/question-bank/build-baseline.ts`
- Create: `scripts/question-bank/lib/validateBaseline.ts`
- Create: `scripts/question-bank/lib/validateBaseline.test.ts`
- Create: `scripts/question-bank/validate-baseline.ts`
- Modify: `package.json` (add `qb:build-baseline`, `qb:validate-baseline`)
- Modify: `scripts/question-bank/README.md`

**Interfaces:**
- Consumes: `getDb`, `readJsonFile` (existing), `topics/{chunkId}.order` (Task 5's output).
- Produces: `baselineTests/{version}` — `{ sections: [{ section: number, questionIds: string[]
  }], createdAt }` — read by Task 8 (`startOrResumeBaseline`) and Task 9 (`scoreTest`'s
  baseline path).

- [ ] **Step 1: Add the baseline record types**

In `scripts/question-bank/lib/types.ts`, add:
```ts
export interface BaselineSection {
  section: number;
  questionIds: string[];
}

export interface BaselineTestRecord {
  sections: BaselineSection[];
  createdAt: FieldValue;
}
```

- [ ] **Step 2: Write the failing test for `buildBaseline`**

Create `scripts/question-bank/lib/buildBaseline.test.ts`:
```ts
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDb } from './adminApp';
import { buildBaseline } from './buildBaseline';

function writeTempSelection(selection: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'baseline-test-'));
  const filePath = join(dir, 'selection.json');
  writeFileSync(filePath, JSON.stringify(selection));
  return filePath;
}

async function seedTopic(chunkId: string, order: number) {
  await getDb().collection('topics').doc(chunkId).set({
    title: chunkId,
    description: 'd',
    order,
    approvedQuestionCount: 1,
  });
}

async function seedQuestion(id: string, chunkId: string, status = 'approved') {
  await getDb()
    .collection('questions')
    .doc(id)
    .set({
      conceptId: 'c1',
      chunkId,
      sourceRef: 'p.1',
      type: 'fact',
      text: 'x',
      choices: ['a', 'b'],
      correctAnswer: 'a',
      status,
      selfCheck: { passed: true },
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null,
    });
}

function buildSelection(n: number): Record<string, string> {
  const selection: Record<string, string> = {};
  for (let i = 0; i < n; i++) selection[`topic-${i}`] = `q-${i}`;
  return selection;
}

describe('buildBaseline', () => {
  it('rejects a selection that is not exactly 45 topics', async () => {
    const filePath = writeTempSelection({ 'topic-0': 'q-0' });
    await expect(buildBaseline('v1', filePath)).rejects.toThrow('Expected exactly 45');
  });

  it('rejects a question that is not approved', async () => {
    const selection = buildSelection(45);
    for (const [chunkId, questionId] of Object.entries(selection)) {
      await seedTopic(chunkId, Number(chunkId.split('-')[1]));
      await seedQuestion(questionId, chunkId, chunkId === 'topic-0' ? 'pending_review' : 'approved');
    }
    const filePath = writeTempSelection(selection);

    await expect(buildBaseline('v1', filePath)).rejects.toThrow('not approved');
  });

  it('builds 3 sections of 15 in topic order and writes baselineTests/{version}', async () => {
    const selection = buildSelection(45);
    for (const [chunkId, questionId] of Object.entries(selection)) {
      const order = Number(chunkId.split('-')[1]);
      await seedTopic(chunkId, order);
      await seedQuestion(questionId, chunkId);
    }
    const filePath = writeTempSelection(selection);

    const result = await buildBaseline('v1', filePath);

    expect(result.sectionsWritten).toBe(3);
    expect(result.questionsWritten).toBe(45);

    const snap = await getDb().collection('baselineTests').doc('v1').get();
    const data = snap.data()!;
    expect(data.sections).toHaveLength(3);
    expect(data.sections[0].questionIds).toHaveLength(15);
    expect(data.sections[0].questionIds[0]).toBe('q-0');
    expect(data.sections[2].questionIds[14]).toBe('q-44');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test:question-bank`
Expected: FAIL with "Cannot find module './buildBaseline'".

- [ ] **Step 4: Implement `buildBaseline`**

Create `scripts/question-bank/lib/buildBaseline.ts`:
```ts
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from './adminApp';
import { readJsonFile } from './readJsonFile';

const SECTION_SIZE = 15;
const SECTION_COUNT = 3;
const EXPECTED_TOPIC_COUNT = SECTION_SIZE * SECTION_COUNT;

export interface BuildBaselineResult {
  version: string;
  sectionsWritten: number;
  questionsWritten: number;
}

/** chunkId -> the one approved questionId hand-picked for that topic's baseline slot. */
type BaselineSelectionInput = Record<string, string>;

export async function buildBaseline(
  version: string,
  selectionPath: string
): Promise<BuildBaselineResult> {
  const selection = readJsonFile(selectionPath) as BaselineSelectionInput;
  const db = getDb();

  const chunkIds = Object.keys(selection);
  if (chunkIds.length !== EXPECTED_TOPIC_COUNT) {
    throw new Error(
      `Expected exactly ${EXPECTED_TOPIC_COUNT} topics in the selection, got ${chunkIds.length}.`
    );
  }

  const ordered: { questionId: string; order: number }[] = [];
  for (const chunkId of chunkIds) {
    const questionId = selection[chunkId];

    const questionSnap = await db.collection('questions').doc(questionId).get();
    if (!questionSnap.exists) {
      throw new Error(`Question "${questionId}" (topic "${chunkId}") does not exist.`);
    }
    const question = questionSnap.data()!;
    if (question.status !== 'approved') {
      throw new Error(`Question "${questionId}" (topic "${chunkId}") is not approved.`);
    }
    if (question.chunkId !== chunkId) {
      throw new Error(
        `Question "${questionId}" belongs to chunkId "${question.chunkId}", not "${chunkId}".`
      );
    }

    const topicSnap = await db.collection('topics').doc(chunkId).get();
    if (!topicSnap.exists) {
      throw new Error(`Topic "${chunkId}" does not exist in the topics collection — run publish-topics first.`);
    }

    ordered.push({ questionId, order: topicSnap.data()!.order });
  }

  ordered.sort((a, b) => a.order - b.order);

  const sections = [];
  for (let i = 0; i < SECTION_COUNT; i++) {
    sections.push({
      section: i + 1,
      questionIds: ordered.slice(i * SECTION_SIZE, (i + 1) * SECTION_SIZE).map((q) => q.questionId),
    });
  }

  await db.collection('baselineTests').doc(version).set({
    sections,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { version, sectionsWritten: sections.length, questionsWritten: ordered.length };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:question-bank`
Expected: PASS.

- [ ] **Step 6: Add the CLI entrypoint**

Create `scripts/question-bank/build-baseline.ts`:
```ts
import { buildBaseline } from './lib/buildBaseline';

async function main() {
  const [, , version, selectionPath] = process.argv;
  if (!version || !selectionPath) {
    console.error('Usage: build-baseline <version> /path/to/baseline-selection.json');
    process.exit(1);
  }

  const result = await buildBaseline(version, selectionPath);
  console.log(
    `Wrote baselineTests/${result.version}: ${result.sectionsWritten} section(s), ${result.questionsWritten} question(s).`
  );
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
```

- [ ] **Step 7: Write the failing test for `validateBaseline`**

Create `scripts/question-bank/lib/validateBaseline.test.ts`:
```ts
import { getDb } from './adminApp';
import { validateBaseline } from './validateBaseline';

async function seedQuestion(id: string, status = 'approved') {
  await getDb()
    .collection('questions')
    .doc(id)
    .set({
      conceptId: 'c1',
      chunkId: 'row',
      sourceRef: 'p.1',
      type: 'fact',
      text: 'x',
      choices: ['a', 'b'],
      correctAnswer: 'a',
      status,
      selfCheck: { passed: true },
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null,
    });
}

describe('validateBaseline', () => {
  it('returns no stale questions when every baseline question is still approved', async () => {
    await seedQuestion('q1', 'approved');
    await getDb()
      .collection('baselineTests')
      .doc('v1')
      .set({ sections: [{ section: 1, questionIds: ['q1'] }], createdAt: new Date() });

    const result = await validateBaseline('v1');
    expect(result.staleQuestionIds).toEqual([]);
  });

  it('flags a baseline question that is no longer approved', async () => {
    await seedQuestion('q1', 'rejected');
    await getDb()
      .collection('baselineTests')
      .doc('v1')
      .set({ sections: [{ section: 1, questionIds: ['q1'] }], createdAt: new Date() });

    const result = await validateBaseline('v1');
    expect(result.staleQuestionIds).toEqual(['q1']);
  });

  it('rejects an unknown version', async () => {
    await expect(validateBaseline('nonexistent')).rejects.toThrow('does not exist');
  });
});
```

- [ ] **Step 8: Run tests to verify they fail, then implement**

Run: `npm run test:question-bank` — expect FAIL ("Cannot find module './validateBaseline'").

Create `scripts/question-bank/lib/validateBaseline.ts`:
```ts
import { getDb } from './adminApp';

export interface ValidateBaselineResult {
  version: string;
  staleQuestionIds: string[];
}

/**
 * Re-checks every question ID in a published baseline against the current `questions` bank
 * and reports any that are no longer `approved` (e.g. a reviewer later rejected or flagged
 * one). Non-destructive — flags for a human to replace via a new `buildBaseline` run rather
 * than auto-swapping, since the baseline is meant to be a deliberately hand-picked set
 * (ph-1-us-8 AC: "flagged for replacement", not auto-replaced).
 */
export async function validateBaseline(version: string): Promise<ValidateBaselineResult> {
  const db = getDb();
  const snap = await db.collection('baselineTests').doc(version).get();
  if (!snap.exists) {
    throw new Error(`baselineTests/${version} does not exist`);
  }

  const data = snap.data()!;
  const questionIds: string[] = data.sections.flatMap((s: { questionIds: string[] }) => s.questionIds);

  const staleQuestionIds: string[] = [];
  for (const id of questionIds) {
    const questionSnap = await db.collection('questions').doc(id).get();
    const status = questionSnap.exists ? questionSnap.data()!.status : 'missing';
    if (status !== 'approved') {
      staleQuestionIds.push(id);
    }
  }

  return { version, staleQuestionIds };
}
```

Run: `npm run test:question-bank` — expect PASS.

- [ ] **Step 9: Add the CLI entrypoint, npm scripts, and README docs**

Create `scripts/question-bank/validate-baseline.ts`:
```ts
import { validateBaseline } from './lib/validateBaseline';

async function main() {
  const [, , version] = process.argv;
  if (!version) {
    console.error('Usage: validate-baseline <version>');
    process.exit(1);
  }

  const result = await validateBaseline(version);
  if (result.staleQuestionIds.length === 0) {
    console.log(`baselineTests/${result.version}: all questions still approved.`);
  } else {
    console.error(
      `baselineTests/${result.version}: ${result.staleQuestionIds.length} stale question(s) need replacement: ${result.staleQuestionIds.join(', ')}`
    );
    process.exit(1);
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
```

In `package.json`'s `scripts`, add:
```json
"qb:build-baseline": "tsx scripts/question-bank/build-baseline.ts",
"qb:validate-baseline": "tsx scripts/question-bank/validate-baseline.ts",
```

In `scripts/question-bank/README.md`, add a section documenting both commands: the
`baseline-selection.json` input shape (`{ "<chunkId>": "<approved questionId>", ... }`, exactly
45 entries, one per topic, hand-picked by a human reviewer per ph-1-us-8's Questions section),
that `publish-topics` must run first (order comes from `topics/{chunkId}.order`), and that
`validate-baseline` should be re-run periodically/after review passes to catch a baseline
question that was later rejected.

- [ ] **Step 10: Commit**

```bash
git add scripts/question-bank/lib/types.ts scripts/question-bank/lib/buildBaseline.ts scripts/question-bank/lib/buildBaseline.test.ts scripts/question-bank/build-baseline.ts scripts/question-bank/lib/validateBaseline.ts scripts/question-bank/lib/validateBaseline.test.ts scripts/question-bank/validate-baseline.ts package.json scripts/question-bank/README.md
git commit -m "feat: add build-baseline and validate-baseline scripts"
```

---

### Task 8: `startOrResumeBaseline` Cloud Function (ph-1-us-8, part 2)

**Files:**
- Create: `functions/src/startOrResumeBaseline.ts`
- Create: `functions/src/startOrResumeBaseline.test.ts`
- Modify: `functions/src/index.ts`
- Modify: `functions/README.md`

**Interfaces:**
- Consumes: `AssembledQuestion` type (Task 2), `baselineTests/{version}` (Task 7's output).
- Produces: `users/{uid}/baseline/progress` — `{ version: string, currentSection: number,
  completedAt: FieldValue | null, freeTestUsedAt: FieldValue | null, createdAt: FieldValue }`
  — read and advanced by Task 9 (`scoreTest`'s baseline path). Response `testId` format
  `baseline-{version}-{section}`, which Task 9 uses to detect a baseline submission.

- [ ] **Step 1: Write the failing tests**

Create `functions/src/startOrResumeBaseline.test.ts`:
```ts
import { getDb } from './adminApp';
import { startOrResumeBaselineForUser, CURRENT_BASELINE_VERSION } from './startOrResumeBaseline';

describe('startOrResumeBaselineForUser', () => {
  const db = getDb();

  beforeEach(async () => {
    for (const collection of ['baselineTests', 'questions']) {
      const snap = await db.collection(collection).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
    }
    const usersSnap = await db.collection('users').get();
    for (const userDoc of usersSnap.docs) {
      const baselineSnap = await userDoc.ref.collection('baseline').get();
      await Promise.all(baselineSnap.docs.map((d) => d.ref.delete()));
    }
  });

  async function seedBaseline() {
    await db
      .collection('questions')
      .doc('q1')
      .set({
        conceptId: 'c1',
        chunkId: 'row',
        sourceRef: 'p.1',
        type: 'fact',
        text: 'Section 1 question',
        choices: ['a', 'b'],
        correctAnswer: 'a',
        status: 'approved',
        selfCheck: { passed: true },
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
      });
    await db
      .collection('baselineTests')
      .doc(CURRENT_BASELINE_VERSION)
      .set({
        sections: [
          { section: 1, questionIds: ['q1'] },
          { section: 2, questionIds: [] },
          { section: 3, questionIds: [] },
        ],
        createdAt: new Date(),
      });
  }

  test('rejects a call with no authenticated user', async () => {
    await seedBaseline();
    await expect(startOrResumeBaselineForUser(db, undefined)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  test('a first-time user gets section 1', async () => {
    await seedBaseline();

    const result = await startOrResumeBaselineForUser(db, { uid: 'alice-uid' });

    expect(result.section).toBe(1);
    expect(result.totalSections).toBe(3);
    expect(result.testId).toBe(`baseline-${CURRENT_BASELINE_VERSION}-1`);
    expect(result.questions.map((q) => q.id)).toEqual(['q1']);
    expect(result.questions[0]).not.toHaveProperty('correctAnswer');
  });

  test('a returning user with progress gets their current section again', async () => {
    await seedBaseline();
    await db
      .collection('users')
      .doc('alice-uid')
      .collection('baseline')
      .doc('progress')
      .set({
        version: CURRENT_BASELINE_VERSION,
        currentSection: 2,
        completedAt: null,
        freeTestUsedAt: null,
        createdAt: new Date(),
      });

    const result = await startOrResumeBaselineForUser(db, { uid: 'alice-uid' });

    expect(result.section).toBe(2);
  });

  test('rejects restarting an already-completed baseline', async () => {
    await seedBaseline();
    await db
      .collection('users')
      .doc('alice-uid')
      .collection('baseline')
      .doc('progress')
      .set({
        version: CURRENT_BASELINE_VERSION,
        currentSection: 3,
        completedAt: new Date(),
        freeTestUsedAt: new Date(),
        createdAt: new Date(),
      });

    await expect(startOrResumeBaselineForUser(db, { uid: 'alice-uid' })).rejects.toMatchObject({
      code: 'already-exists',
    });
  });

  test('two different users receive identical section-1 questions', async () => {
    await seedBaseline();

    const alice = await startOrResumeBaselineForUser(db, { uid: 'alice-uid' });
    const bob = await startOrResumeBaselineForUser(db, { uid: 'bob-uid' });

    expect(alice.questions).toEqual(bob.questions);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:functions`
Expected: FAIL with "Cannot find module './startOrResumeBaseline'".

- [ ] **Step 3: Implement**

Create `functions/src/startOrResumeBaseline.ts`:
```ts
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getDb } from './adminApp';
import type { AssembledQuestion } from './assembleTest';

// ph-1-us-8: one fixed baseline definition shared by every user. Bumping this to a new value
// (after publishing a new `baselineTests/{version}`) is how a stale question gets replaced —
// users mid-baseline finish their version; finished users keep their result against it.
export const CURRENT_BASELINE_VERSION = 'v1';

export interface StartOrResumeBaselineResult {
  testId: string; // `baseline-{version}-{section}` — scoreTest (ph-1-us-11) parses this
  version: string;
  section: number;
  totalSections: number;
  questions: AssembledQuestion[];
}

interface BaselineProgress {
  version: string;
  currentSection: number;
  completedAt: FirebaseFirestore.Timestamp | null;
  freeTestUsedAt: FirebaseFirestore.Timestamp | null;
}

/**
 * Starts a new user's baseline diagnostic, or resumes an in-progress one at their current
 * section — same fixed 45-question set for every user, delivered 15 at a time.
 *
 * Implements ph-1-us-8. Trigger: `startOrResumeBaseline` onCall wrapper below.
 * Auth:     requires a signed-in caller; otherwise `unauthenticated`
 * Reads:    `users/{uid}/baseline/progress` (created lazily if absent), `baselineTests/
 *           {CURRENT_BASELINE_VERSION}`, `questions` (Admin SDK, by ID)
 * Writes:   `users/{uid}/baseline/progress` only on first call (progress otherwise only
 *           advances when `scoreTest`, ph-1-us-11, grades a section)
 * Errors:   HttpsError('unauthenticated'); ('already-exists') if the baseline is complete
 */
export async function startOrResumeBaselineForUser(
  db: Firestore,
  auth: { uid: string } | undefined
): Promise<StartOrResumeBaselineResult> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'startOrResumeBaseline requires a signed-in caller.');
  }

  const progressRef = db.collection('users').doc(auth.uid).collection('baseline').doc('progress');
  const progressSnap = await progressRef.get();

  let progress: BaselineProgress;
  if (progressSnap.exists) {
    progress = progressSnap.data() as BaselineProgress;
    if (progress.completedAt) {
      throw new HttpsError('already-exists', 'The baseline has already been completed.');
    }
  } else {
    progress = {
      version: CURRENT_BASELINE_VERSION,
      currentSection: 1,
      completedAt: null,
      freeTestUsedAt: null,
    };
    await progressRef.set({ ...progress, createdAt: FieldValue.serverTimestamp() });
  }

  const baselineSnap = await db.collection('baselineTests').doc(progress.version).get();
  if (!baselineSnap.exists) {
    throw new HttpsError(
      'failed-precondition',
      `baselineTests/${progress.version} is not published.`
    );
  }
  const sections = baselineSnap.data()!.sections as { section: number; questionIds: string[] }[];
  const section = sections.find((s) => s.section === progress.currentSection);
  if (!section) {
    throw new HttpsError('internal', `Section ${progress.currentSection} is not defined.`);
  }

  const questionDocs = await Promise.all(
    section.questionIds.map((id) => db.collection('questions').doc(id).get())
  );
  const questions: AssembledQuestion[] = questionDocs.map((doc) => {
    const data = doc.data()!;
    return {
      id: doc.id,
      text: data.text,
      choices: data.choices,
      type: data.type,
      chunkId: data.chunkId,
      conceptId: data.conceptId,
    };
  });

  return {
    testId: `baseline-${progress.version}-${section.section}`,
    version: progress.version,
    section: section.section,
    totalSections: sections.length,
    questions,
  };
}

/** The deployed Cloud Function — thin wrapper, see `startOrResumeBaselineForUser` for the logic. */
export const startOrResumeBaseline = onCall((request) =>
  startOrResumeBaselineForUser(getDb(), request.auth)
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:functions`
Expected: PASS.

- [ ] **Step 5: Register the export and document it**

In `functions/src/index.ts`, add:
```ts
export { startOrResumeBaseline } from './startOrResumeBaseline';
```

In `functions/README.md`, add a `## startOrResumeBaseline (callable)` section: no input, output
shape (`testId`, `version`, `section`, `totalSections`, `questions`), that it's the same 45
questions for every user (3 sections × 15, handbook order), that progress lives at
`users/{uid}/baseline/progress` and only `scoreTest` advances `currentSection`, and that
`already-exists` means the baseline (and free test) is already used.

- [ ] **Step 6: Commit**

```bash
git add functions/src/startOrResumeBaseline.ts functions/src/startOrResumeBaseline.test.ts functions/src/index.ts functions/README.md
git commit -m "feat: add startOrResumeBaseline callable for the sectioned baseline diagnostic"
```

---

### Task 9: `getFlashcards` Cloud Function (ph-1-us-10)

**Files:**
- Create: `functions/src/getFlashcards.ts`
- Create: `functions/src/getFlashcards.test.ts`
- Modify: `functions/src/index.ts`
- Modify: `functions/README.md`

**Interfaces:**
- Consumes: `shuffle` (Task 1).
- Produces: `getFlashcardsForUser(db, auth, chunkId, options?): Promise<{ chunkId: string; cards:
  Flashcard[] }>` — standalone, nothing downstream consumes its output.

- [ ] **Step 1: Write the failing tests**

Create `functions/src/getFlashcards.test.ts`:
```ts
import { getDb } from './adminApp';
import { getFlashcardsForUser, RATE_LIMIT_MAX_CALLS } from './getFlashcards';

describe('getFlashcardsForUser', () => {
  const db = getDb();

  beforeEach(async () => {
    const snap = await db.collection('questions').get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
    const usersSnap = await db.collection('users').get();
    for (const userDoc of usersSnap.docs) {
      const rateLimits = await userDoc.ref.collection('rateLimits').get();
      await Promise.all(rateLimits.docs.map((d) => d.ref.delete()));
    }
  });

  async function seedQuestion(id: string, overrides: Record<string, unknown> = {}) {
    await db
      .collection('questions')
      .doc(id)
      .set({
        conceptId: 'concept-1',
        chunkId: 'right-of-way',
        sourceRef: 'p.1',
        type: 'fact',
        text: `Question ${id}`,
        choices: ['a', 'b', 'c'],
        correctAnswer: 'a',
        status: 'approved',
        selfCheck: { passed: true },
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
        ...overrides,
      });
  }

  test('rejects a call with no authenticated user', async () => {
    await expect(getFlashcardsForUser(db, undefined, 'right-of-way')).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  test('rejects a missing chunkId', async () => {
    await expect(getFlashcardsForUser(db, { uid: 'alice-uid' }, '')).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  test('returns not-found for a topic with no approved questions', async () => {
    await seedQuestion('q1', { status: 'pending_review' });

    await expect(
      getFlashcardsForUser(db, { uid: 'alice-uid' }, 'right-of-way')
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  test('returns cards with answers, excluding sourceRef/selfCheck/review metadata', async () => {
    await seedQuestion('q1');

    const result = await getFlashcardsForUser(db, { uid: 'alice-uid' }, 'right-of-way');

    expect(result.chunkId).toBe('right-of-way');
    expect(result.cards).toEqual([
      {
        id: 'q1',
        text: 'Question q1',
        choices: ['a', 'b', 'c'],
        correctAnswer: 'a',
        type: 'fact',
        chunkId: 'right-of-way',
        conceptId: 'concept-1',
      },
    ]);
  });

  test('nothing is written to testAttempts or testAssignments', async () => {
    await seedQuestion('q1');

    await getFlashcardsForUser(db, { uid: 'alice-uid' }, 'right-of-way');

    const assignments = await db
      .collection('users')
      .doc('alice-uid')
      .collection('testAssignments')
      .get();
    expect(assignments.empty).toBe(true);
  });

  test('rejects once the per-user rate limit is exceeded', async () => {
    await seedQuestion('q1');
    const now = () => 1000;

    for (let i = 0; i < RATE_LIMIT_MAX_CALLS; i++) {
      await getFlashcardsForUser(db, { uid: 'alice-uid' }, 'right-of-way', { now });
    }

    await expect(
      getFlashcardsForUser(db, { uid: 'alice-uid' }, 'right-of-way', { now })
    ).rejects.toMatchObject({ code: 'resource-exhausted' });
  });

  test('rate limit resets after the window elapses', async () => {
    await seedQuestion('q1');
    let now = 0;
    for (let i = 0; i < RATE_LIMIT_MAX_CALLS; i++) {
      await getFlashcardsForUser(db, { uid: 'alice-uid' }, 'right-of-way', { now: () => now });
    }

    now = 11 * 60 * 1000; // past the 10-minute window
    await expect(
      getFlashcardsForUser(db, { uid: 'alice-uid' }, 'right-of-way', { now: () => now })
    ).resolves.toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:functions`
Expected: FAIL with "Cannot find module './getFlashcards'".

- [ ] **Step 3: Implement**

Create `functions/src/getFlashcards.ts`:
```ts
import type { Firestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getDb } from './adminApp';
import { shuffle } from './shuffle';

// ph-1-us-10: per-user limit slowing (not stopping) bulk extraction via repeated calls, since
// this path — unlike assembleTest/assembleMiniQuiz — includes correctAnswer. Values are a
// starting proposal, not a validated product decision (see the story's Questions section).
export const RATE_LIMIT_MAX_CALLS = 30;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export interface Flashcard {
  id: string;
  text: string;
  choices: string[];
  correctAnswer: string;
  type: string;
  chunkId: string;
  conceptId: string;
}

export interface GetFlashcardsResult {
  chunkId: string;
  cards: Flashcard[];
}

interface GetFlashcardsOptions {
  random?: () => number;
  now?: () => number;
}

interface RateLimitState {
  windowStart: number;
  count: number;
}

async function checkAndConsumeRateLimit(db: Firestore, uid: string, now: number): Promise<void> {
  const ref = db.collection('users').doc(uid).collection('rateLimits').doc('flashcards');

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() as RateLimitState) : null;
    const windowActive = data !== null && now - data.windowStart < RATE_LIMIT_WINDOW_MS;

    if (windowActive && data!.count >= RATE_LIMIT_MAX_CALLS) {
      throw new HttpsError('resource-exhausted', 'Too many flashcard requests — try again later.');
    }

    tx.set(ref, windowActive ? { windowStart: data!.windowStart, count: data!.count + 1 } : { windowStart: now, count: 1 });
  });
}

/**
 * Returns one topic's approved questions with their answers, for flashcard study.
 *
 * Implements ph-1-us-10. Trigger: `getFlashcards` onCall wrapper below.
 * Auth:     requires a signed-in caller; otherwise `unauthenticated`
 * Inputs:   chunkId — required topic
 * Returns:  { chunkId, cards[] } — cards include correctAnswer (deliberate exception; see
 *           the module-level comment on RATE_LIMIT_MAX_CALLS)
 * Reads:    `questions` where chunkId == input and status == 'approved'; a per-user rate-limit
 *           counter at `users/{uid}/rateLimits/flashcards`
 * Writes:   the rate-limit counter only — no testAssignments/testAttempts, nothing is scored
 * Errors:   HttpsError('unauthenticated'), ('invalid-argument'), ('not-found') for an empty
 *           topic, ('resource-exhausted') over the rate limit
 */
export async function getFlashcardsForUser(
  db: Firestore,
  auth: { uid: string } | undefined,
  chunkId: unknown,
  options: GetFlashcardsOptions = {}
): Promise<GetFlashcardsResult> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'getFlashcards requires a signed-in caller.');
  }
  if (typeof chunkId !== 'string' || chunkId.length === 0) {
    throw new HttpsError('invalid-argument', 'chunkId must be a non-empty string.');
  }

  const now = options.now ? options.now() : Date.now();
  await checkAndConsumeRateLimit(db, auth.uid, now);

  const snapshot = await db
    .collection('questions')
    .where('chunkId', '==', chunkId)
    .where('status', '==', 'approved')
    .get();

  if (snapshot.empty) {
    throw new HttpsError('not-found', `No approved questions exist for chunkId "${chunkId}".`);
  }

  const random = options.random ?? Math.random;
  const shuffled = shuffle(snapshot.docs, random);

  const cards: Flashcard[] = shuffled.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      text: data.text,
      choices: data.choices,
      correctAnswer: data.correctAnswer,
      type: data.type,
      chunkId: data.chunkId,
      conceptId: data.conceptId,
    };
  });

  return { chunkId, cards };
}

/** The deployed Cloud Function — thin wrapper, see `getFlashcardsForUser` for the logic. */
export const getFlashcards = onCall((request) =>
  getFlashcardsForUser(getDb(), request.auth, request.data?.chunkId)
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:functions`
Expected: PASS.

- [ ] **Step 5: Register the export and document it**

In `functions/src/index.ts`, add:
```ts
export { getFlashcards } from './getFlashcards';
```

In `functions/README.md`, add a `## getFlashcards (callable)` section: input
`{ chunkId: string }`, output shape (cards include `correctAnswer`), the rate limit (30 calls /
10 minutes per user, flagged as a starting value not a validated product decision), and that
nothing is scored or recorded.

- [ ] **Step 6: Commit**

```bash
git add functions/src/getFlashcards.ts functions/src/getFlashcards.test.ts functions/src/index.ts functions/README.md
git commit -m "feat: add getFlashcards callable for answer-bearing topic study"
```

---

### Task 10: `scoreTest` Cloud Function (ph-1-us-11)

The largest task — grades all three session kinds. Depends on Task 2 (`testAssignments` from
`assembleTest`), Task 4 (`testAssignments` from `assembleMiniQuiz`), Task 3 (rules), Task 8
(`baselineTests`/`users/{uid}/baseline/progress`).

**Files:**
- Create: `functions/src/scoreTest.ts`
- Create: `functions/src/scoreTest.test.ts`
- Modify: `functions/src/index.ts`
- Modify: `functions/README.md`

**Interfaces:**
- Consumes: `testAssignments/{testId}` shape from Task 2/4 (`{ type, chunkId?, questionIds,
  createdAt, scored }`); `baseline-{version}-{section}` `testId` format and `users/{uid}/
  baseline/progress` shape from Task 8.
- Produces: `users/{uid}/testAttempts/{testId}` — `{ type: 'practice'|'mini-quiz'|'baseline',
  chunkId: string | null, score: number, correctCount: number, totalCount: number, perTopic:
  { chunkId: string, correct: number, total: number }[], recommendation: 'move-on'|
  'review-again'|null, createdAt }` — this is the shape Phase 2/3/4 will read (not built yet;
  out of scope here).

- [ ] **Step 1: Write the failing tests**

Create `functions/src/scoreTest.test.ts`:
```ts
import { getDb } from './adminApp';
import { assembleTestForUser } from './assembleTest';
import { assembleMiniQuizForUser } from './assembleMiniQuiz';
import { startOrResumeBaselineForUser, CURRENT_BASELINE_VERSION } from './startOrResumeBaseline';
import { scoreTestForUser } from './scoreTest';

describe('scoreTestForUser', () => {
  const db = getDb();
  const uid = 'alice-uid';

  beforeEach(async () => {
    for (const collection of ['questions', 'baselineTests']) {
      const snap = await db.collection(collection).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
    }
    const userRef = db.collection('users').doc(uid);
    for (const sub of ['testAssignments', 'testAttempts', 'baseline']) {
      const snap = await userRef.collection(sub).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
    }
  });

  async function seedQuestion(id: string, chunkId: string, correctAnswer: string) {
    await db
      .collection('questions')
      .doc(id)
      .set({
        conceptId: 'c1',
        chunkId,
        sourceRef: 'p.1',
        type: 'fact',
        text: `Question ${id}`,
        choices: ['a', 'b'],
        correctAnswer,
        status: 'approved',
        selfCheck: { passed: true },
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
      });
  }

  test('rejects a call with no authenticated user', async () => {
    await expect(
      scoreTestForUser(db, undefined, { testId: 't1', answers: [] })
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  test('rejects a testId with no assignment for this uid', async () => {
    await expect(
      scoreTestForUser(db, { uid }, { testId: 'nonexistent', answers: [] })
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  test('grades a practice test: correct/incorrect mix, per-topic results, marks assignment scored', async () => {
    await seedQuestion('q1', 'row', 'a');
    await seedQuestion('q2', 'signs', 'b');
    const assembled = await assembleTestForUser(db, { uid }, { count: 2 });

    const result = await scoreTestForUser(db, { uid }, {
      testId: assembled.testId,
      answers: [
        { questionId: 'q1', choice: 'a' },
        { questionId: 'q2', choice: 'a' },
      ],
    });

    expect(result.type).toBe('practice');
    expect(result.correctCount).toBe(1);
    expect(result.totalCount).toBe(2);
    expect(result.score).toBeCloseTo(0.5);
    expect(result.perTopic.sort((a, b) => a.chunkId.localeCompare(b.chunkId))).toEqual([
      { chunkId: 'row', correct: 1, total: 1 },
      { chunkId: 'signs', correct: 0, total: 1 },
    ]);

    const assignmentSnap = await db
      .collection('users')
      .doc(uid)
      .collection('testAssignments')
      .doc(assembled.testId)
      .get();
    expect(assignmentSnap.data()?.scored).toBe(true);

    const attemptSnap = await db
      .collection('users')
      .doc(uid)
      .collection('testAttempts')
      .doc(assembled.testId)
      .get();
    expect(attemptSnap.exists).toBe(true);
    expect(attemptSnap.data()?.type).toBe('practice');
  });

  test('treats an unanswered question as incorrect, not an error', async () => {
    await seedQuestion('q1', 'row', 'a');
    const assembled = await assembleTestForUser(db, { uid }, { count: 1 });

    const result = await scoreTestForUser(db, { uid }, { testId: assembled.testId, answers: [] });

    expect(result.correctCount).toBe(0);
    expect(result.totalCount).toBe(1);
  });

  test('rejects scoring the same assignment twice', async () => {
    await seedQuestion('q1', 'row', 'a');
    const assembled = await assembleTestForUser(db, { uid }, { count: 1 });
    const answers = [{ questionId: 'q1', choice: 'a' }];

    await scoreTestForUser(db, { uid }, { testId: assembled.testId, answers });

    await expect(
      scoreTestForUser(db, { uid }, { testId: assembled.testId, answers })
    ).rejects.toMatchObject({ code: 'already-exists' });
  });

  test('a mini-quiz scoring 80%+ recommends move-on, below recommends review-again', async () => {
    await seedQuestion('q1', 'row', 'a');
    await seedQuestion('q2', 'row', 'a');
    await seedQuestion('q3', 'row', 'a');
    await seedQuestion('q4', 'row', 'a');
    await seedQuestion('q5', 'row', 'a');
    const assembled = await assembleMiniQuizForUser(db, { uid }, { chunkId: 'row', count: 5 });

    const allCorrect = assembled.questions.map((q) => ({ questionId: q.id, choice: 'a' }));
    const result = await scoreTestForUser(db, { uid }, { testId: assembled.testId, answers: allCorrect });

    expect(result.type).toBe('mini-quiz');
    expect(result.recommendation).toBe('move-on');
  });

  test('a low-scoring mini-quiz recommends review-again', async () => {
    await seedQuestion('q1', 'row', 'a');
    const assembled = await assembleMiniQuizForUser(db, { uid }, { chunkId: 'row', count: 1 });

    const result = await scoreTestForUser(db, { uid }, {
      testId: assembled.testId,
      answers: [{ questionId: assembled.questions[0].id, choice: 'wrong' }],
    });

    expect(result.recommendation).toBe('review-again');
  });

  test('scores a baseline section, advances currentSection, and does not mark freeTestUsedAt yet', async () => {
    await seedQuestion('q1', 'row', 'a');
    await db
      .collection('baselineTests')
      .doc(CURRENT_BASELINE_VERSION)
      .set({
        sections: [
          { section: 1, questionIds: ['q1'] },
          { section: 2, questionIds: [] },
          { section: 3, questionIds: [] },
        ],
        createdAt: new Date(),
      });
    const started = await startOrResumeBaselineForUser(db, { uid });

    const result = await scoreTestForUser(db, { uid }, {
      testId: started.testId,
      answers: [{ questionId: 'q1', choice: 'a' }],
    });

    expect(result.type).toBe('baseline');

    const progressSnap = await db.collection('users').doc(uid).collection('baseline').doc('progress').get();
    expect(progressSnap.data()?.currentSection).toBe(2);
    expect(progressSnap.data()?.completedAt).toBeNull();
    expect(progressSnap.data()?.freeTestUsedAt).toBeNull();
  });

  test('finishing the last baseline section marks completedAt and freeTestUsedAt', async () => {
    await seedQuestion('q1', 'row', 'a');
    await db
      .collection('baselineTests')
      .doc(CURRENT_BASELINE_VERSION)
      .set({ sections: [{ section: 1, questionIds: ['q1'] }], createdAt: new Date() });
    const started = await startOrResumeBaselineForUser(db, { uid });

    await scoreTestForUser(db, { uid }, {
      testId: started.testId,
      answers: [{ questionId: 'q1', choice: 'a' }],
    });

    const progressSnap = await db.collection('users').doc(uid).collection('baseline').doc('progress').get();
    expect(progressSnap.data()?.completedAt).not.toBeNull();
    expect(progressSnap.data()?.freeTestUsedAt).not.toBeNull();
  });

  test('rejects a baseline testId for a section that is not the caller\'s current section', async () => {
    await seedQuestion('q1', 'row', 'a');
    await db
      .collection('baselineTests')
      .doc(CURRENT_BASELINE_VERSION)
      .set({
        sections: [
          { section: 1, questionIds: ['q1'] },
          { section: 2, questionIds: [] },
        ],
        createdAt: new Date(),
      });
    await startOrResumeBaselineForUser(db, { uid }); // currentSection stays 1, not scored yet

    await expect(
      scoreTestForUser(db, { uid }, {
        testId: `baseline-${CURRENT_BASELINE_VERSION}-2`,
        answers: [],
      })
    ).rejects.toMatchObject({ code: 'already-exists' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:functions`
Expected: FAIL with "Cannot find module './scoreTest'".

- [ ] **Step 3: Implement**

Create `functions/src/scoreTest.ts`:
```ts
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getDb } from './adminApp';

// ph-1-us-11: proposed default from prd.md Section 9 — not yet a validated product decision.
const MINI_QUIZ_PASS_THRESHOLD = 0.8;

type AttemptType = 'practice' | 'mini-quiz' | 'baseline';

interface AnswerInput {
  questionId: string;
  choice: string;
}

export interface PerTopicResult {
  chunkId: string;
  correct: number;
  total: number;
}

export interface ScoreTestResult {
  testId: string;
  type: AttemptType;
  score: number;
  correctCount: number;
  totalCount: number;
  perTopic: PerTopicResult[];
  recommendation: 'move-on' | 'review-again' | null;
}

interface ScoreTestInput {
  testId: unknown;
  answers: unknown;
}

function validateInput(input: ScoreTestInput): { testId: string; answers: AnswerInput[] } {
  if (typeof input.testId !== 'string' || input.testId.length === 0) {
    throw new HttpsError('invalid-argument', 'testId must be a non-empty string.');
  }
  if (!Array.isArray(input.answers)) {
    throw new HttpsError('invalid-argument', 'answers must be an array.');
  }
  const answers = input.answers.filter(
    (a): a is AnswerInput =>
      typeof a === 'object' && a !== null && typeof a.questionId === 'string' && typeof a.choice === 'string'
  );
  return { testId: input.testId, answers };
}

/** Grades a set of question docs against the caller's submitted answers. */
async function gradeQuestions(
  db: Firestore,
  questionIds: string[],
  answers: AnswerInput[]
): Promise<{
  correctCount: number;
  perTopic: PerTopicResult[];
  attemptChunkId: string | null;
}> {
  const answerByQuestionId = new Map(answers.map((a) => [a.questionId, a.choice]));
  const questionDocs = await Promise.all(questionIds.map((id) => db.collection('questions').doc(id).get()));

  const perTopicMap = new Map<string, PerTopicResult>();
  let correctCount = 0;
  let singleChunkId: string | null = null;

  for (const doc of questionDocs) {
    const data = doc.data()!;
    const chunkId: string = data.chunkId;
    singleChunkId = singleChunkId === null ? chunkId : singleChunkId === chunkId ? chunkId : 'mixed';

    const submitted = answerByQuestionId.get(doc.id) ?? null;
    const correct = submitted !== null && submitted === data.correctAnswer;
    if (correct) correctCount += 1;

    const topic = perTopicMap.get(chunkId) ?? { chunkId, correct: 0, total: 0 };
    topic.total += 1;
    if (correct) topic.correct += 1;
    perTopicMap.set(chunkId, topic);
  }

  return {
    correctCount,
    perTopic: [...perTopicMap.values()],
    attemptChunkId: singleChunkId === 'mixed' ? null : singleChunkId,
  };
}

async function scoreAssignedTest(
  db: Firestore,
  uid: string,
  testId: string,
  answers: AnswerInput[]
): Promise<ScoreTestResult> {
  const assignmentRef = db.collection('users').doc(uid).collection('testAssignments').doc(testId);
  const attemptRef = db.collection('users').doc(uid).collection('testAttempts').doc(testId);

  return db.runTransaction(async (tx) => {
    const assignmentSnap = await tx.get(assignmentRef);
    if (!assignmentSnap.exists) {
      throw new HttpsError('not-found', 'No assignment found for this testId.');
    }
    const assignment = assignmentSnap.data()!;
    if (assignment.scored) {
      throw new HttpsError('already-exists', 'This test has already been scored.');
    }

    const questionIds: string[] = assignment.questionIds;
    const { correctCount, perTopic, attemptChunkId } = await gradeQuestions(db, questionIds, answers);
    const totalCount = questionIds.length;
    const score = totalCount === 0 ? 0 : correctCount / totalCount;
    const type: AttemptType = assignment.type;

    const recommendation =
      type === 'mini-quiz' ? (score >= MINI_QUIZ_PASS_THRESHOLD ? 'move-on' : 'review-again') : null;

    tx.set(attemptRef, {
      type,
      chunkId: assignment.chunkId ?? attemptChunkId,
      score,
      correctCount,
      totalCount,
      perTopic,
      recommendation,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(assignmentRef, { scored: true });

    return { testId, type, score, correctCount, totalCount, perTopic, recommendation };
  });
}

async function scoreBaselineSection(
  db: Firestore,
  uid: string,
  testId: string,
  answers: AnswerInput[]
): Promise<ScoreTestResult> {
  // testId format: `baseline-{version}-{section}` — version may itself contain no dashes
  // (e.g. "v1"), so split from the right for the section number.
  const lastDash = testId.lastIndexOf('-');
  const version = testId.slice('baseline-'.length, lastDash);
  const section = Number(testId.slice(lastDash + 1));
  if (!version || Number.isNaN(section)) {
    throw new HttpsError('invalid-argument', `Malformed baseline testId "${testId}".`);
  }

  const progressRef = db.collection('users').doc(uid).collection('baseline').doc('progress');
  const attemptRef = db.collection('users').doc(uid).collection('testAttempts').doc(testId);
  const baselineRef = db.collection('baselineTests').doc(version);

  return db.runTransaction(async (tx) => {
    const [progressSnap, baselineSnap] = await Promise.all([tx.get(progressRef), tx.get(baselineRef)]);
    if (!progressSnap.exists || !baselineSnap.exists) {
      throw new HttpsError('not-found', 'No baseline in progress for this testId.');
    }
    const progress = progressSnap.data()!;
    if (progress.currentSection !== section || progress.completedAt) {
      throw new HttpsError('already-exists', 'This baseline section has already been scored.');
    }

    const sections: { section: number; questionIds: string[] }[] = baselineSnap.data()!.sections;
    const sectionDef = sections.find((s) => s.section === section)!;
    const { correctCount, perTopic } = await gradeQuestions(db, sectionDef.questionIds, answers);
    const totalCount = sectionDef.questionIds.length;
    const score = totalCount === 0 ? 0 : correctCount / totalCount;

    tx.set(attemptRef, {
      type: 'baseline' as AttemptType,
      chunkId: null,
      score,
      correctCount,
      totalCount,
      perTopic,
      recommendation: null,
      createdAt: FieldValue.serverTimestamp(),
    });

    const isLastSection = section >= sections.length;
    tx.update(progressRef, {
      currentSection: isLastSection ? section : section + 1,
      completedAt: isLastSection ? FieldValue.serverTimestamp() : null,
      freeTestUsedAt: isLastSection ? FieldValue.serverTimestamp() : null,
    });

    return {
      testId,
      type: 'baseline' as AttemptType,
      score,
      correctCount,
      totalCount,
      perTopic,
      recommendation: null,
    };
  });
}

/**
 * Grades a submitted set of answers for a practice test, mini-quiz, or baseline section.
 *
 * Implements ph-1-us-11 — the only place correct answers are compared against a user's
 * submission. Trigger: `scoreTest` onCall wrapper below.
 * Auth:     requires a signed-in caller; otherwise `unauthenticated`
 * Inputs:   testId — from assembleTest/assembleMiniQuiz/startOrResumeBaseline
 *           answers — [{ questionId, choice }], unanswered/unknown questions count as incorrect
 * Returns:  score, per-question-derived per-topic breakdown, and (mini-quiz only) a
 *           move-on/review-again recommendation from MINI_QUIZ_PASS_THRESHOLD
 * Writes:   `users/{uid}/testAttempts/{testId}`; marks the assignment `scored: true`
 *           (practice/mini-quiz) or advances `users/{uid}/baseline/progress` (baseline),
 *           setting `completedAt`/`freeTestUsedAt` on the final section
 * Errors:   HttpsError('unauthenticated'), ('invalid-argument'), ('not-found') for an unknown
 *           testId, ('already-exists') for a double submit
 */
export async function scoreTestForUser(
  db: Firestore,
  auth: { uid: string } | undefined,
  rawInput: ScoreTestInput
): Promise<ScoreTestResult> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'scoreTest requires a signed-in caller.');
  }
  const { testId, answers } = validateInput(rawInput);

  if (testId.startsWith('baseline-')) {
    return scoreBaselineSection(db, auth.uid, testId, answers);
  }
  return scoreAssignedTest(db, auth.uid, testId, answers);
}

/** The deployed Cloud Function — thin wrapper, see `scoreTestForUser` for the logic. */
export const scoreTest = onCall((request) =>
  scoreTestForUser(getDb(), request.auth, request.data ?? {})
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:functions`
Expected: PASS.

- [ ] **Step 5: Register the export and document it**

In `functions/src/index.ts`, add:
```ts
export { scoreTest } from './scoreTest';
```

In `functions/README.md`, add a `## scoreTest (callable)` section: input
`{ testId: string, answers: [{ questionId, choice }] }`, output shape, the three `type`s and
where each reads its assignment from, the mini-quiz recommendation threshold constant, and the
baseline `testId` format (`baseline-{version}-{section}`) with a note that it's how this
function tells a baseline submission apart from a practice/mini-quiz one.

- [ ] **Step 6: Commit**

```bash
git add functions/src/scoreTest.ts functions/src/scoreTest.test.ts functions/src/index.ts functions/README.md
git commit -m "feat: add scoreTest callable to grade practice/mini-quiz/baseline submissions"
```

---

### Task 11: `src/study/testCache.ts` frontend module (ph-1-us-5)

Independent of every backend task above — only needs `AsyncStorage` and a plain question-set
shape, so it can land any time. Placed last here only because it's the one frontend task in an
otherwise backend-heavy plan.

**Files:**
- Modify: `package.json` (add `@react-native-async-storage/async-storage`)
- Create: `src/study/testCache.ts`
- Create: `src/study/testCache.test.ts`

**Interfaces:**
- Produces: `saveTestCache(testId, questions): Promise<void>`,
  `getTestCache(testId): Promise<unknown[] | null>`, `clearTestCache(testId): Promise<void>` —
  Phase 3's test-taking UI imports these; not consumed by anything else in this plan.

- [ ] **Step 1: Add the dependency**

```bash
npx expo install @react-native-async-storage/async-storage
```

- [ ] **Step 2: Write the failing tests**

Create `src/study/testCache.test.ts`:
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveTestCache, getTestCache, clearTestCache } from './testCache';

describe('testCache', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  const sampleQuestions = [
    { id: 'q1', text: 'What does a red light mean?', choices: ['Stop', 'Go'], type: 'fact', chunkId: 'signs', conceptId: 'c1' },
  ];

  it('round-trips a saved question set', async () => {
    await saveTestCache('test-1', sampleQuestions);

    const result = await getTestCache('test-1');

    expect(result).toEqual(sampleQuestions);
  });

  it('returns null for a testId that was never saved', async () => {
    const result = await getTestCache('never-saved');

    expect(result).toBeNull();
  });

  it('removes the entry on clear', async () => {
    await saveTestCache('test-1', sampleQuestions);

    await clearTestCache('test-1');

    expect(await getTestCache('test-1')).toBeNull();
  });

  it('keeps a stale cached test intact when a different testId is saved', async () => {
    await saveTestCache('stale-test', sampleQuestions);

    await saveTestCache('new-test', [{ ...sampleQuestions[0], id: 'q2' }]);

    expect(await getTestCache('stale-test')).toEqual(sampleQuestions);
    expect(await getTestCache('new-test')).toEqual([{ ...sampleQuestions[0], id: 'q2' }]);
  });

  it('propagates a write failure to the caller instead of failing silently', async () => {
    const setItemSpy = jest
      .spyOn(AsyncStorage, 'setItem')
      .mockRejectedValueOnce(new Error('storage full'));

    await expect(saveTestCache('test-1', sampleQuestions)).rejects.toThrow('storage full');

    setItemSpy.mockRestore();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest src/study/testCache.test.ts` (adjust to this repo's app-level Jest invocation if
one is already configured for `src/`; if no app-level Jest config exists yet, add one now
mirroring `jest.rules.config.js`'s `roots`/`testMatch` pattern, pointed at `src/`, using
`jest-expo` or `react-native` preset so `AsyncStorage`'s native module mock resolves).
Expected: FAIL with "Cannot find module './testCache'".

- [ ] **Step 4: Implement**

Create `src/study/testCache.ts`:
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY_PREFIX = 'dmv-app:test-cache:';

function cacheKey(testId: string): string {
  return `${CACHE_KEY_PREFIX}${testId}`;
}

/**
 * Caches one test/mini-quiz/baseline-section's question set on-device, keyed by `testId`.
 *
 * Implements ph-1-us-5 (frontend half of ph-1-us-3's "cache only what one session needs").
 * `questions` is whatever shape the assembling Cloud Function returned (assembleTest /
 * assembleMiniQuiz / startOrResumeBaseline) — stored as-is, this module doesn't interpret it.
 */
export async function saveTestCache(testId: string, questions: unknown[]): Promise<void> {
  await AsyncStorage.setItem(cacheKey(testId), JSON.stringify(questions));
}

/** Returns the cached question set for `testId`, or `null` if nothing was cached for it. */
export async function getTestCache(testId: string): Promise<unknown[] | null> {
  const raw = await AsyncStorage.getItem(cacheKey(testId));
  return raw === null ? null : JSON.parse(raw);
}

/** Removes `testId`'s cached question set — call on completion or abandonment. */
export async function clearTestCache(testId: string): Promise<void> {
  await AsyncStorage.removeItem(cacheKey(testId));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/study/testCache.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/study/testCache.ts src/study/testCache.test.ts
git commit -m "feat: add on-device test-set cache for ph-1-us-5"
```

---

### Task 12: Close out phase docs

**Files:**
- Modify: `docs/phases/phase-1-question-bank-and-content-model/phase-1-summary.md`
- Modify: each of the 7 story files (flip `**Status:**` to `Complete`, check off Acceptance
  Criteria and Tasks boxes that are now genuinely satisfied)

- [ ] **Step 1: Update `phase-1-summary.md`**

Flip the status table's remaining rows (ph-1-us-3, -5, -7, -8, -9, -10, -11) to `Complete`, and
update the header line (`## Status: ...`) to reflect all 11 stories done.

- [ ] **Step 2: Check off boxes in each story file**

For each of `ph-1-us-3-scoped-offline-test-cache.md`, `ph-1-us-5-local-test-cache.md`,
`ph-1-us-7-topic-scoped-question-set.md`, `ph-1-us-8-baseline-diagnostic-assembly.md`,
`ph-1-us-9-topic-catalog.md`, `ph-1-us-10-flashcard-delivery.md`,
`ph-1-us-11-score-test.md`: change `**Status:** Not Started` to `**Status:** Complete`, and
check off (`- [x]`) every Acceptance Criteria and Tasks checkbox this plan actually delivered.
Leave any AC unchecked if a task above genuinely didn't cover it (there shouldn't be any, per
this plan's Self-Review below) rather than checking it off without verifying.

- [ ] **Step 3: Commit**

```bash
git add docs/phases/phase-1-question-bank-and-content-model/
git commit -m "docs: mark remaining phase 1 user stories complete"
```
