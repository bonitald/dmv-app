# assembleTest Cloud Function Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `functions/` Firebase Cloud Function (`assembleTest`) that server-side selects a bounded, randomized set of `approved` questions and returns them to an authenticated caller — the only sanctioned way for a client to ever read question content, closing the bulk-extraction risk of a direct Firestore query.

**Architecture:** Standard Firebase CLI-managed `functions/` directory (its own `package.json`/`tsconfig.json`, no IaC/Terraform/CloudFormation — deploys via `firebase deploy --only functions`). Three small, independently testable modules (`lib/db.ts`, `lib/selectQuestions.ts`, `lib/fetchApprovedQuestions.ts`) sit behind one `onCall` handler (`assembleTest.ts`). Business logic lives in a plain exported `assembleTestHandler` function so tests call it directly — no functions-testing framework needed, matching this repo's existing "small pure `lib/` modules behind a thin entry point" pattern from `scripts/question-bank/`.

**Tech Stack:** TypeScript, `firebase-functions` v2 (`onCall` from `firebase-functions/v2/https`), `firebase-admin`, Jest + `ts-jest`, Firebase Local Emulator Suite (Firestore emulator — already configured in `firebase.json`).

**Spec:** `docs/phases/phase-1-question-bank-and-content-model/ph-1-us-4-assemble-test-cloud-function.md` (and its parent, `ph-1-us-3-scoped-offline-test-cache.md`)

## Global Constraints

- No IaC — this is a Firebase-CLI-managed `functions/` directory, deployed via `firebase deploy --only functions`, not Terraform/CloudFormation/Deployment Manager.
- Cloud Functions v2 (2nd gen), Node 20 runtime.
- The client-safe question shape returned to callers is exactly `{ id, text, choices, type, conceptId }` — never `sourceRef`, `correctAnswer`, `selfCheck`, `status`, or review metadata.
- Only questions with `status === 'approved'` are ever selectable — `pending_review`, `flagged`, and `rejected` must never reach the client.
- An unauthenticated caller (`request.auth` missing) is rejected outright with an `unauthenticated` `HttpsError` — no question data returned.
- `firestore.rules` stays deny-all for `questions`/`ingestionRuns` (per `ph-1-us-1`) — this plan does not touch `firestore.rules`. The function reads via the Admin SDK, which bypasses rules by design; that's legitimate here because the function itself enforces the approved-only, bounded-count constraint before returning anything.
- Question count per assembled test is a named constant (`QUESTIONS_PER_TEST`), not hardcoded inline in multiple places — exact target size is still undefined per `prd.md` Section 9, so it must be easy to change later.
- This plan does not wire the client (app-side) to call this function — that's `2026-09-11-local-test-cache.md` (mocked against this function's contract) and, fully, Phase 3.

---

### Task 1: Scaffold `functions/` project

**Files:**
- Create: `functions/package.json`
- Create: `functions/tsconfig.json`
- Create: `functions/.gitignore`
- Create: `functions/src/constants.ts`
- Create: `functions/src/constants.test.ts`
- Create: `jest.functions.config.js`
- Modify: `firebase.json` (add `functions` config + emulator)
- Modify: `package.json` (add `test:functions` script)

**Interfaces:**
- Produces: `QUESTIONS_PER_TEST: number` (from `functions/src/constants.ts`) — consumed by Task 5.

- [ ] **Step 1: Create the functions package**

Create `functions/package.json`:

```json
{
  "name": "functions",
  "private": true,
  "main": "lib/index.js",
  "engines": {
    "node": "20"
  },
  "scripts": {
    "build": "tsc",
    "test": "jest"
  },
  "dependencies": {
    "firebase-admin": "^13.10.0",
    "firebase-functions": "^6.4.0"
  },
  "devDependencies": {
    "@types/jest": "^30.0.0",
    "@types/node": "^26.5.0",
    "jest": "^30.5.1",
    "ts-jest": "^29.4.12",
    "typescript": "~6.0.3"
  }
}
```

- [ ] **Step 2: Install functions' dependencies**

Run:
```bash
cd functions && npm install && cd ..
```

- [ ] **Step 3: Add the functions tsconfig**

Create `functions/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "lib",
    "rootDir": "src",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "types": ["jest", "node"]
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 4: Ignore build output and deps**

Create `functions/.gitignore`:

```
node_modules/
lib/
```

- [ ] **Step 5: Add the root Jest config for functions tests**

Create `jest.functions.config.js`:

```js
const path = require('path');

/** Jest config for functions/src/ — separate from jest.rules.config.js and
 * jest.scripts.config.js (different tsconfig, different test subjects). Uses `roots` and
 * native `path.join` instead of the `<rootDir>` token in `testMatch`/`transform`: this repo
 * has already hit a Jest bug where `<rootDir>` token substitution corrupts paths on Windows
 * when checked out under a dot-prefixed segment (e.g. a worktree). Computing paths natively
 * avoids that. */
module.exports = {
  testEnvironment: 'node',
  rootDir: __dirname,
  roots: [path.join(__dirname, 'functions', 'src')],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: path.join(__dirname, 'functions', 'tsconfig.json') }],
  },
};
```

- [ ] **Step 6: Add the `test:functions` npm script**

In the root `package.json`, under `"scripts"`, add (alongside the existing `test:rules`/`test:question-bank` lines):

```json
"test:functions": "firebase emulators:exec --only firestore \"jest --config jest.functions.config.js\""
```

- [ ] **Step 7: Wire `functions/` into `firebase.json`**

Modify `firebase.json` to add a `functions` config block and a `functions` emulator (needed later for any manual smoke-testing, even though this plan's own tests drive Firestore directly rather than invoking through the functions emulator):

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": ["node_modules", ".git", "lib", "**/*.test.ts"],
      "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
    }
  ],
  "emulators": {
    "firestore": {
      "port": 8180
    },
    "functions": {
      "port": 5001
    },
    "ui": {
      "enabled": true,
      "port": 4200
    },
    "singleProjectMode": true
  }
}
```

- [ ] **Step 8: Write the failing test proving the toolchain works**

Create `functions/src/constants.test.ts`:

```ts
import { QUESTIONS_PER_TEST } from './constants';

describe('QUESTIONS_PER_TEST', () => {
  it('is a positive integer', () => {
    expect(Number.isInteger(QUESTIONS_PER_TEST)).toBe(true);
    expect(QUESTIONS_PER_TEST).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 9: Run the test to verify it fails**

Run: `npm run test:functions`
Expected: FAIL — `Cannot find module './constants'`.

- [ ] **Step 10: Implement the constant**

Create `functions/src/constants.ts`:

```ts
// Exact target question-bank/test size is still undefined (prd.md Section 9) — keep this a
// single named constant so it's trivial to retune once that's decided.
export const QUESTIONS_PER_TEST = 25;
```

- [ ] **Step 11: Run the test to verify it passes**

Run: `npm run test:functions`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add functions/package.json functions/tsconfig.json functions/.gitignore functions/src/constants.ts functions/src/constants.test.ts jest.functions.config.js firebase.json package.json
git commit -m "Scaffold functions/ project for the assembleTest Cloud Function"
```

Note: do not `git add functions/package-lock.json` in this step if `npm install` created one with absolute local paths embedded — check its contents first; if it's a normal lockfile, include it.

---

### Task 2: Firestore Admin connection

**Files:**
- Create: `functions/src/lib/db.ts`
- Create: `functions/src/lib/db.test.ts`

**Interfaces:**
- Produces: `getDb(): Firestore` — every later task's Firestore access goes through this. Consumed by Tasks 4 and 5.

- [ ] **Step 1: Write the failing test**

Create `functions/src/lib/db.test.ts`:

```ts
import { getDb } from './db';

describe('getDb', () => {
  it('connects to the Firestore emulator and can write/read a document', async () => {
    const db = getDb();
    const ref = db.collection('_dbTest').doc('ping');

    await ref.set({ ok: true });
    const snap = await ref.get();

    expect(snap.data()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:functions`
Expected: FAIL — `Cannot find module './db'`.

- [ ] **Step 3: Implement `getDb()`**

Create `functions/src/lib/db.ts`:

```ts
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export function getDb(): Firestore {
  if (getApps().length === 0) {
    initializeApp();
  }
  return getFirestore();
}
```

(Cloud Functions' runtime provides Application Default Credentials automatically — no
explicit `credential`/`projectId` config needed here, unlike `scripts/question-bank/lib/adminApp.ts`
which runs outside that runtime. `firebase emulators:exec` sets `FIRESTORE_EMULATOR_HOST` and
`GCLOUD_PROJECT` for local runs, which the Admin SDK picks up automatically.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:functions`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/src/lib/db.ts functions/src/lib/db.test.ts
git commit -m "Add Firestore Admin connection for Cloud Functions"
```

---

### Task 3: Client-safe question type + pure selection logic

**Files:**
- Create: `functions/src/lib/types.ts`
- Create: `functions/src/lib/selectQuestions.ts`
- Create: `functions/src/lib/selectQuestions.test.ts`

**Interfaces:**
- Consumes: nothing from Tasks 1-2.
- Produces:
  - Type: `ClientQuestion` (`{ id, text, choices, type, conceptId }`) — used by Tasks 4 and 5.
  - Function: `selectRandomQuestions<T>(items: T[], count: number): T[]` — used by Task 5.

- [ ] **Step 1: Write the types module**

Create `functions/src/lib/types.ts`:

```ts
export type QuestionType = 'fact' | 'scenario';

export interface ClientQuestion {
  id: string;
  text: string;
  choices: string[];
  type: QuestionType;
  conceptId: string;
}
```

- [ ] **Step 2: Write the failing tests**

Create `functions/src/lib/selectQuestions.test.ts`:

```ts
import { selectRandomQuestions } from './selectQuestions';

describe('selectRandomQuestions', () => {
  it('returns exactly `count` items when more are available than requested', () => {
    const items = Array.from({ length: 10 }, (_, i) => i);

    const result = selectRandomQuestions(items, 5);

    expect(result).toHaveLength(5);
  });

  it('returns every item, with no duplicates, when count exceeds the available items', () => {
    const items = [1, 2, 3];

    const result = selectRandomQuestions(items, 10);

    expect([...result].sort()).toEqual([1, 2, 3]);
  });

  it('never returns duplicate items even when count equals the full set size', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);

    const result = selectRandomQuestions(items, 20);

    expect(new Set(result).size).toBe(20);
  });

  it('does not mutate the input array', () => {
    const items = [1, 2, 3, 4, 5];
    const copy = [...items];

    selectRandomQuestions(items, 3);

    expect(items).toEqual(copy);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test:functions`
Expected: FAIL — `Cannot find module './selectQuestions'`.

- [ ] **Step 4: Implement `selectRandomQuestions`**

Create `functions/src/lib/selectQuestions.ts`:

```ts
export function selectRandomQuestions<T>(items: T[], count: number): T[] {
  const pool = [...items];
  const take = Math.min(count, pool.length);
  const result: T[] = [];

  for (let i = 0; i < take; i++) {
    const index = Math.floor(Math.random() * pool.length);
    result.push(pool[index]);
    pool.splice(index, 1);
  }

  return result;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:functions`
Expected: PASS (all 4 tests)

- [ ] **Step 6: Commit**

```bash
git add functions/src/lib/types.ts functions/src/lib/selectQuestions.ts functions/src/lib/selectQuestions.test.ts
git commit -m "Add client-safe question type and random selection logic"
```

---

### Task 4: Fetch approved questions

**Files:**
- Create: `functions/src/lib/fetchApprovedQuestions.ts`
- Create: `functions/src/lib/fetchApprovedQuestions.test.ts`

**Interfaces:**
- Consumes: `getDb()` (Task 2), `ClientQuestion` (Task 3).
- Produces: `fetchApprovedQuestions(db: Firestore): Promise<ClientQuestion[]>` — used by Task 5.

- [ ] **Step 1: Write the failing tests**

Create `functions/src/lib/fetchApprovedQuestions.test.ts`:

```ts
import { getDb } from './db';
import { fetchApprovedQuestions } from './fetchApprovedQuestions';

async function seedQuestion(overrides: Record<string, unknown>) {
  const db = getDb();
  await db.collection('questions').add({
    conceptId: 'c1',
    chunkId: 'ch1',
    sourceRef: 'p.1',
    type: 'fact',
    text: 'Sample question text',
    choices: ['A', 'B'],
    correctAnswer: 'A',
    selfCheck: { passed: true, notes: '' },
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    createdAt: new Date(),
    ...overrides,
  });
}

describe('fetchApprovedQuestions', () => {
  afterEach(async () => {
    const db = getDb();
    const snapshot = await db.collection('questions').get();
    await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
  });

  it('returns only approved questions, mapped to the client-safe shape', async () => {
    await seedQuestion({ status: 'approved', text: 'Approved Q', conceptId: 'concept-a' });
    await seedQuestion({ status: 'pending_review', text: 'Pending Q', conceptId: 'concept-b' });
    await seedQuestion({ status: 'flagged', text: 'Flagged Q', conceptId: 'concept-c' });

    const result = await fetchApprovedQuestions(getDb());

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ text: 'Approved Q', type: 'fact', conceptId: 'concept-a' });
    expect(result[0]).not.toHaveProperty('sourceRef');
    expect(result[0]).not.toHaveProperty('correctAnswer');
    expect(result[0]).not.toHaveProperty('selfCheck');
    expect(result[0]).not.toHaveProperty('status');
  });

  it('returns an empty array when no approved questions exist', async () => {
    await seedQuestion({ status: 'pending_review' });

    const result = await fetchApprovedQuestions(getDb());

    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:functions`
Expected: FAIL — `Cannot find module './fetchApprovedQuestions'`.

- [ ] **Step 3: Implement `fetchApprovedQuestions`**

Create `functions/src/lib/fetchApprovedQuestions.ts`:

```ts
import type { Firestore } from 'firebase-admin/firestore';
import type { ClientQuestion } from './types';

export async function fetchApprovedQuestions(db: Firestore): Promise<ClientQuestion[]> {
  const snapshot = await db.collection('questions').where('status', '==', 'approved').get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      text: data.text as string,
      choices: data.choices as string[],
      type: data.type as ClientQuestion['type'],
      conceptId: data.conceptId as string,
    };
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:functions`
Expected: PASS (all 2 tests)

- [ ] **Step 5: Commit**

```bash
git add functions/src/lib/fetchApprovedQuestions.ts functions/src/lib/fetchApprovedQuestions.test.ts
git commit -m "Add approved-questions fetch mapped to the client-safe shape"
```

---

### Task 5: `assembleTest` handler + callable export

**Files:**
- Create: `functions/src/assembleTest.ts`
- Create: `functions/src/assembleTest.test.ts`
- Create: `functions/src/index.ts`

**Interfaces:**
- Consumes: `getDb()` (Task 2), `selectRandomQuestions()` (Task 3), `fetchApprovedQuestions()` (Task 4), `QUESTIONS_PER_TEST` (Task 1).
- Produces: `assembleTestHandler(request: { auth?: { uid: string } }): Promise<{ testId: string; questions: ClientQuestion[] }>` (the plain, directly-testable business logic) and `assembleTest` (the deployed `onCall` export wrapping it) — `assembleTest` is what Phase 3/`2026-09-11-local-test-cache.md` will eventually call from the client via `@react-native-firebase/functions`.

- [ ] **Step 1: Write the failing tests**

Create `functions/src/assembleTest.test.ts`:

```ts
import { getDb } from './lib/db';
import { assembleTestHandler } from './assembleTest';

async function seedApprovedQuestion(conceptId: string) {
  const db = getDb();
  await db.collection('questions').add({
    conceptId,
    chunkId: 'ch1',
    sourceRef: 'p.1',
    type: 'fact',
    text: `Question for ${conceptId}`,
    choices: ['A', 'B'],
    correctAnswer: 'A',
    status: 'approved',
    selfCheck: { passed: true, notes: '' },
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    createdAt: new Date(),
  });
}

describe('assembleTestHandler', () => {
  afterEach(async () => {
    const db = getDb();
    const snapshot = await db.collection('questions').get();
    await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
  });

  it('rejects a caller with no auth', async () => {
    await expect(assembleTestHandler({ auth: undefined })).rejects.toThrow(
      'You must be signed in to start a test.'
    );
  });

  it('returns a testId and a bounded set of approved questions for an authenticated caller', async () => {
    await seedApprovedQuestion('concept-1');
    await seedApprovedQuestion('concept-2');
    await seedApprovedQuestion('concept-3');

    const result = await assembleTestHandler({ auth: { uid: 'alice-uid' } });

    expect(typeof result.testId).toBe('string');
    expect(result.testId.length).toBeGreaterThan(0);
    expect(result.questions).toHaveLength(3);
  });

  it('never includes non-approved questions in the result', async () => {
    await seedApprovedQuestion('concept-1');
    const db = getDb();
    await db.collection('questions').add({
      conceptId: 'concept-flagged',
      chunkId: 'ch1',
      sourceRef: 'p.1',
      type: 'fact',
      text: 'Flagged question',
      choices: ['A', 'B'],
      correctAnswer: 'A',
      status: 'flagged',
      selfCheck: { passed: false, notes: 'ambiguous' },
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null,
      createdAt: new Date(),
    });

    const result = await assembleTestHandler({ auth: { uid: 'alice-uid' } });

    expect(result.questions.map((q) => q.conceptId)).toEqual(['concept-1']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:functions`
Expected: FAIL — `Cannot find module './assembleTest'`.

- [ ] **Step 3: Implement `assembleTestHandler` and the `assembleTest` export**

Create `functions/src/assembleTest.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDb } from './lib/db';
import { fetchApprovedQuestions } from './lib/fetchApprovedQuestions';
import { selectRandomQuestions } from './lib/selectQuestions';
import { QUESTIONS_PER_TEST } from './constants';
import type { ClientQuestion } from './lib/types';

export interface AssembleTestRequest {
  auth?: { uid: string };
}

export interface AssembleTestResult {
  testId: string;
  questions: ClientQuestion[];
}

export async function assembleTestHandler(
  request: AssembleTestRequest
): Promise<AssembleTestResult> {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to start a test.');
  }

  const approved = await fetchApprovedQuestions(getDb());
  const questions = selectRandomQuestions(approved, QUESTIONS_PER_TEST);

  return { testId: randomUUID(), questions };
}

export const assembleTest = onCall((request) => assembleTestHandler(request));
```

- [ ] **Step 4: Wire the deployable entry point**

Create `functions/src/index.ts`:

```ts
export { assembleTest } from './assembleTest';
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:functions`
Expected: PASS (all 3 tests)

- [ ] **Step 6: Verify the function builds for deployment**

Run:
```bash
cd functions && npm run build && cd ..
```
Expected: `functions/lib/` is created with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add functions/src/assembleTest.ts functions/src/assembleTest.test.ts functions/src/index.ts
git commit -m "Add assembleTest callable Cloud Function"
```

---

### Task 6: Subagent-facing docs

**Files:**
- Create: `functions/README.md`

- [ ] **Step 1: Write the README**

Create `functions/README.md`:

```markdown
# Cloud Functions

Standard Firebase CLI-managed functions (`firebase deploy --only functions`) — no Terraform/
CloudFormation/IaC. See `docs/phases/phase-1-question-bank-and-content-model/ph-1-us-4-assemble-test-cloud-function.md`
for the full story/rationale.

## `assembleTest` (callable)

The only sanctioned way for the app to read question content — `firestore.rules` denies all
direct client reads of the `questions` collection (see `ph-1-us-1`), specifically to prevent a
client from bulk-extracting the full question bank via an open query.

**Call it from the client** (once wired up — not yet done as of this function's initial build)
via `@react-native-firebase/functions`'s `httpsCallable(getFunctions(app), 'assembleTest')`, with
no arguments. Requires the caller to be signed in (anonymous auth is sufficient).

**Returns:**
```json
{
  "testId": "generated-uuid",
  "questions": [
    { "id": "...", "text": "...", "choices": ["..."], "type": "fact", "conceptId": "..." }
  ]
}
```

Only `status: 'approved'` questions are eligible for selection; the set size is
`QUESTIONS_PER_TEST` (`functions/src/constants.ts`).

## Local development

```bash
cd functions && npm install
npm run test:functions   # from repo root — runs functions/src tests against the Firestore emulator
```
```

- [ ] **Step 2: Commit**

```bash
git add functions/README.md
git commit -m "Add functions/ README"
```

---

## After this plan

`assembleTest` exists and is tested but is **not yet called from the app** — that integration
happens in `2026-09-11-local-test-cache.md` (mocked against this contract) and, for the full
test-taking flow, in Phase 3. Deploying it (`firebase deploy --only functions`) against the real
`dmv-app-dev`/`dmv-app-prod` projects is a manual step outside this plan.
