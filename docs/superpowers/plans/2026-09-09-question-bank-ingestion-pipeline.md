# Question Bank Ingestion Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `scripts/question-bank/` CLI tooling (Firestore write scripts + validation) that the ingestion pipeline's Phase A/B subagents will call via `Bash`, so they can persist chunk plans, question docs, and chunk progress to Firestore without any subagent needing direct Firestore access.

**Architecture:** A small `lib/` of pure, independently-testable modules (Admin SDK connection, schema validation, and one function per write operation) sits behind three thin CLI entry points. Each CLI script reads a JSON file path from argv, validates the payload, writes to Firestore via the Admin SDK (authenticated with Application Default Credentials — no service-account key file), and prints a short result to stdout. Tests run against the already-configured Firestore emulator so nothing here touches real project data.

**Tech Stack:** TypeScript, `firebase-admin` (modular API), `tsx` (script execution), Jest + `ts-jest` (already used for `firestore-tests/`), Firebase Local Emulator Suite (already configured in `firebase.json`).

**Spec:** `docs/superpowers/specs/2026-09-08-question-bank-ingestion-design.md`

## Global Constraints

- Firestore access uses the **Admin SDK authenticated via Application Default Credentials** — never a downloaded service-account key file (spec's "Execution mechanics" section; ADC is already set up on this machine via `gcloud auth application-default login`).
- Default Firestore project id is **`dmv-app-dev`** (matches `.firebaserc`'s default) — never point at `dmv-app-prod` without an explicit override.
- Client-side `firestore.rules` stay deny-all for `questions`/`ingestionRuns` — this plan does not touch `firestore.rules`; the Admin SDK bypasses rules entirely by design.
- Variation questions are **separate `questions/{id}` documents sharing a `conceptId`** field — never an array of variants inside one document.
- A question's `status` only ever starts as `'pending_review'` or `'flagged'` (derived from `selfCheck.passed`) — nothing this pipeline writes is ever `'approved'`; only human review in the Firebase console sets that.
- This plan builds tooling only (`scripts/question-bank/`) — it does not modify app runtime code (`src/`), `firestore.rules`, or run an actual ingestion pass against the real handbook.

---

### Task 1: Firestore Admin connection + emulator test harness

**Files:**
- Create: `scripts/question-bank/lib/adminApp.ts`
- Create: `scripts/question-bank/lib/adminApp.test.ts`
- Create: `scripts/question-bank/tsconfig.json`
- Create: `jest.scripts.config.js`
- Modify: `package.json` (add devDependencies + `test:question-bank` script)

**Interfaces:**
- Produces: `getDb(): Firestore` — a firebase-admin Firestore instance, connected to the emulator when `FIRESTORE_EMULATOR_HOST` is set (as `firebase emulators:exec` does automatically) and to real Firestore via ADC otherwise. Every later task's Firestore access goes through this function.

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install --save-dev firebase-admin tsx @types/node
```

- [ ] **Step 2: Add the scripts-test tsconfig**

Create `scripts/question-bank/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "types": ["jest", "node"]
  },
  "include": ["**/*.ts"]
}
```

- [ ] **Step 3: Add the Jest config for this test suite**

Create `jest.scripts.config.js`:

```js
/** Jest config for scripts/question-bank/ — separate from jest.rules.config.js and whatever
 * the app itself eventually uses (e.g. jest-expo), which need different presets. */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/scripts/question-bank/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/scripts/question-bank/tsconfig.json' }],
  },
};
```

- [ ] **Step 4: Add the `test:question-bank` npm script**

In `package.json`, under `"scripts"`, add (alongside the existing `test:rules` line):

```json
"test:question-bank": "firebase emulators:exec --only firestore \"jest --config jest.scripts.config.js\""
```

- [ ] **Step 5: Write the failing test**

Create `scripts/question-bank/lib/adminApp.test.ts`:

```ts
import { getDb } from './adminApp';

describe('getDb', () => {
  it('connects to the Firestore emulator and can write/read a document', async () => {
    const db = getDb();
    const ref = db.collection('_adminAppTest').doc('ping');

    await ref.set({ ok: true });
    const snap = await ref.get();

    expect(snap.data()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm run test:question-bank`
Expected: FAIL — `Cannot find module './adminApp'` (the module doesn't exist yet).

- [ ] **Step 7: Implement `getDb()`**

Create `scripts/question-bank/lib/adminApp.ts`:

```ts
import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

const DEFAULT_PROJECT_ID = 'dmv-app-dev';

export function getDb(): Firestore {
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || DEFAULT_PROJECT_ID;

  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }

  return getFirestore();
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm run test:question-bank`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json jest.scripts.config.js scripts/question-bank/tsconfig.json scripts/question-bank/lib/adminApp.ts scripts/question-bank/lib/adminApp.test.ts
git commit -m "Add Firestore Admin connection for question-bank scripts"
```

---

### Task 2: Schema types + input validation

**Files:**
- Create: `scripts/question-bank/lib/types.ts`
- Create: `scripts/question-bank/lib/validate.ts`
- Create: `scripts/question-bank/lib/validate.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - Types: `ChunkStatus`, `ChunkPlanChunkInput`, `ChunkPlanInput`, `ChunkRecord`, `IngestionRunStatus`, `IngestionRunRecord`, `QuestionType`, `QuestionStatus`, `QuestionInput`, `QuestionRecord` — used by Tasks 3-5.
  - Functions: `validateChunkPlan(data: unknown): ChunkPlanInput`, `validateQuestions(data: unknown): QuestionInput[]` — both throw a descriptive `Error` on invalid input, used by Tasks 3 and 5.

- [ ] **Step 1: Write the types module**

Create `scripts/question-bank/lib/types.ts`:

```ts
import type { FieldValue } from 'firebase-admin/firestore';

export type ChunkStatus = 'pending' | 'done' | 'error';

export interface ChunkPlanChunkInput {
  chunkId: string;
  title: string;
  description: string;
  pageStart: number;
  pageEnd: number;
}

export interface ChunkPlanInput {
  sourceDoc: string;
  chunks: ChunkPlanChunkInput[];
}

export interface ChunkRecord {
  chunkId: string;
  title: string;
  description: string;
  pageStart: number;
  pageEnd: number;
  status: ChunkStatus;
  questionsGenerated: number;
  error: string | null;
}

export type IngestionRunStatus = 'processing' | 'complete';

export interface IngestionRunRecord {
  sourceDoc: string;
  createdAt: FieldValue;
  status: IngestionRunStatus;
  chunks: ChunkRecord[];
}

export type QuestionType = 'fact' | 'scenario';
export type QuestionStatus = 'pending_review' | 'flagged' | 'approved' | 'rejected';

export interface QuestionSelfCheck {
  passed: boolean;
  notes: string;
}

export interface QuestionInput {
  conceptId: string;
  chunkId: string;
  sourceRef: string;
  type: QuestionType;
  text: string;
  choices: string[];
  correctAnswer: string;
  selfCheck: QuestionSelfCheck;
}

export interface QuestionRecord extends QuestionInput {
  status: QuestionStatus;
  reviewedBy: null;
  reviewedAt: null;
  reviewNotes: null;
  createdAt: FieldValue;
}
```

Note: `IngestionRunRecord.status` intentionally omits the spec's `'planning'` value — this plan's `write-chunk-plan` script only ever writes a fully-formed plan in one shot, so a persisted `'planning'` (mid-plan) state never occurs. The type stays available if a future change needs it.

- [ ] **Step 2: Write the failing validation tests**

Create `scripts/question-bank/lib/validate.test.ts`:

```ts
import { validateChunkPlan, validateQuestions } from './validate';

describe('validateChunkPlan', () => {
  const validPlan = {
    sourceDoc: 'DR_2337_Jan2025.pdf',
    chunks: [
      {
        chunkId: 'c1',
        title: 'Right of Way',
        description: 'Right-of-way rules at intersections',
        pageStart: 5,
        pageEnd: 6,
      },
    ],
  };

  it('accepts a valid plan', () => {
    expect(validateChunkPlan(validPlan)).toEqual(validPlan);
  });

  it('rejects a non-object payload', () => {
    expect(() => validateChunkPlan('not an object')).toThrow('must be a JSON object');
  });

  it('rejects an empty chunks array', () => {
    expect(() => validateChunkPlan({ sourceDoc: 'x.pdf', chunks: [] })).toThrow('non-empty array');
  });

  it('rejects a duplicate chunkId', () => {
    const dup = {
      sourceDoc: 'x.pdf',
      chunks: [
        { chunkId: 'c1', title: 'A', description: 'a', pageStart: 1, pageEnd: 2 },
        { chunkId: 'c1', title: 'B', description: 'b', pageStart: 3, pageEnd: 4 },
      ],
    };
    expect(() => validateChunkPlan(dup)).toThrow('Duplicate chunkId "c1"');
  });

  it('rejects an invalid page range', () => {
    const bad = {
      sourceDoc: 'x.pdf',
      chunks: [{ chunkId: 'c1', title: 'A', description: 'a', pageStart: 5, pageEnd: 3 }],
    };
    expect(() => validateChunkPlan(bad)).toThrow('invalid page range');
  });
});

describe('validateQuestions', () => {
  const validQuestion = {
    conceptId: 'concept-1',
    chunkId: 'c1',
    sourceRef: 'p.5',
    type: 'fact',
    text: 'What color is a stop sign?',
    choices: ['Red', 'Yellow', 'Blue'],
    correctAnswer: 'Red',
    selfCheck: { passed: true, notes: '' },
  };

  it('accepts a valid question list', () => {
    expect(validateQuestions([validQuestion])).toEqual([validQuestion]);
  });

  it('rejects an empty array', () => {
    expect(() => validateQuestions([])).toThrow('non-empty array');
  });

  it('rejects an invalid type', () => {
    expect(() => validateQuestions([{ ...validQuestion, type: 'bogus' }])).toThrow('invalid "type"');
  });

  it('rejects a correctAnswer not present in choices', () => {
    expect(() => validateQuestions([{ ...validQuestion, correctAnswer: 'Green' }])).toThrow(
      'not present in its "choices"'
    );
  });

  it('rejects a flagged question with no selfCheck notes', () => {
    expect(() =>
      validateQuestions([{ ...validQuestion, selfCheck: { passed: false, notes: '' } }])
    ).toThrow('no "selfCheck.notes"');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest --config jest.scripts.config.js scripts/question-bank/lib/validate.test.ts`
Expected: FAIL — `Cannot find module './validate'`.

- [ ] **Step 4: Implement validation**

Create `scripts/question-bank/lib/validate.ts`:

```ts
import type { ChunkPlanInput, QuestionInput } from './types';

export function validateChunkPlan(data: unknown): ChunkPlanInput {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Chunk plan must be a JSON object');
  }
  const { sourceDoc, chunks } = data as Record<string, unknown>;

  if (typeof sourceDoc !== 'string' || sourceDoc.trim() === '') {
    throw new Error('Chunk plan "sourceDoc" must be a non-empty string');
  }
  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error('Chunk plan "chunks" must be a non-empty array');
  }

  const seenIds = new Set<string>();
  chunks.forEach((chunk, index) => {
    if (typeof chunk !== 'object' || chunk === null) {
      throw new Error(`Chunk at index ${index} must be an object`);
    }
    const { chunkId, title, description, pageStart, pageEnd } = chunk as Record<string, unknown>;

    if (typeof chunkId !== 'string' || chunkId.trim() === '') {
      throw new Error(`Chunk at index ${index} is missing a valid "chunkId"`);
    }
    if (seenIds.has(chunkId)) {
      throw new Error(`Duplicate chunkId "${chunkId}" in chunk plan`);
    }
    seenIds.add(chunkId);

    if (typeof title !== 'string' || title.trim() === '') {
      throw new Error(`Chunk "${chunkId}" is missing a valid "title"`);
    }
    if (typeof description !== 'string' || description.trim() === '') {
      throw new Error(`Chunk "${chunkId}" is missing a valid "description"`);
    }
    if (
      typeof pageStart !== 'number' ||
      typeof pageEnd !== 'number' ||
      pageStart < 1 ||
      pageEnd < pageStart
    ) {
      throw new Error(`Chunk "${chunkId}" has an invalid page range (${pageStart}-${pageEnd})`);
    }
  });

  return data as ChunkPlanInput;
}

export function validateQuestions(data: unknown): QuestionInput[] {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Questions payload must be a non-empty array');
  }

  const validTypes = new Set(['fact', 'scenario']);

  data.forEach((question, index) => {
    if (typeof question !== 'object' || question === null) {
      throw new Error(`Question at index ${index} must be an object`);
    }
    const q = question as Record<string, unknown>;

    for (const field of ['conceptId', 'chunkId', 'sourceRef', 'text', 'correctAnswer']) {
      if (typeof q[field] !== 'string' || (q[field] as string).trim() === '') {
        throw new Error(`Question at index ${index} is missing a valid "${field}"`);
      }
    }

    if (!validTypes.has(q.type as string)) {
      throw new Error(`Question at index ${index} has invalid "type": ${String(q.type)}`);
    }

    if (
      !Array.isArray(q.choices) ||
      q.choices.length < 2 ||
      !q.choices.every((c) => typeof c === 'string')
    ) {
      throw new Error(`Question at index ${index} must have at least 2 string "choices"`);
    }

    if (!(q.choices as string[]).includes(q.correctAnswer as string)) {
      throw new Error(`Question at index ${index}'s "correctAnswer" is not present in its "choices"`);
    }

    const selfCheck = q.selfCheck as Record<string, unknown> | undefined;
    if (typeof selfCheck !== 'object' || selfCheck === null || typeof selfCheck.passed !== 'boolean') {
      throw new Error(`Question at index ${index} is missing a valid "selfCheck.passed" boolean`);
    }
    if (
      selfCheck.passed === false &&
      (typeof selfCheck.notes !== 'string' || selfCheck.notes.trim() === '')
    ) {
      throw new Error(`Question at index ${index} failed selfCheck but has no "selfCheck.notes"`);
    }
  });

  return data as QuestionInput[];
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest --config jest.scripts.config.js scripts/question-bank/lib/validate.test.ts`
Expected: PASS (all 10 tests)

- [ ] **Step 6: Commit**

```bash
git add scripts/question-bank/lib/types.ts scripts/question-bank/lib/validate.ts scripts/question-bank/lib/validate.test.ts
git commit -m "Add question-bank schema types and input validation"
```

---

### Task 3: Chunk plan writer (Phase A)

**Files:**
- Create: `scripts/question-bank/lib/writeChunkPlan.ts`
- Create: `scripts/question-bank/lib/writeChunkPlan.test.ts`

**Interfaces:**
- Consumes: `getDb()` (Task 1), `validateChunkPlan()`, `ChunkPlanInput`, `ChunkRecord`, `IngestionRunRecord` (Task 2).
- Produces: `writeChunkPlan(jsonPath: string): Promise<string>` — writes one `ingestionRuns/{runId}` doc and returns the generated `runId`. Used by Task 6's CLI entry point.

- [ ] **Step 1: Write the failing test**

Create `scripts/question-bank/lib/writeChunkPlan.test.ts`:

```ts
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDb } from './adminApp';
import { writeChunkPlan } from './writeChunkPlan';

function writeTempJson(data: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'question-bank-test-'));
  const filePath = join(dir, 'plan.json');
  writeFileSync(filePath, JSON.stringify(data));
  return filePath;
}

describe('writeChunkPlan', () => {
  it('writes an ingestionRuns doc with all chunks pending', async () => {
    const filePath = writeTempJson({
      sourceDoc: 'DR_2337_Jan2025.pdf',
      chunks: [
        { chunkId: 'c1', title: 'Right of Way', description: 'desc', pageStart: 5, pageEnd: 6 },
        { chunkId: 'c2', title: 'Speed Limits', description: 'desc 2', pageStart: 7, pageEnd: 7 },
      ],
    });

    const runId = await writeChunkPlan(filePath);

    const snap = await getDb().collection('ingestionRuns').doc(runId).get();
    const data = snap.data();

    expect(data?.sourceDoc).toBe('DR_2337_Jan2025.pdf');
    expect(data?.status).toBe('processing');
    expect(data?.chunks).toEqual([
      {
        chunkId: 'c1',
        title: 'Right of Way',
        description: 'desc',
        pageStart: 5,
        pageEnd: 6,
        status: 'pending',
        questionsGenerated: 0,
        error: null,
      },
      {
        chunkId: 'c2',
        title: 'Speed Limits',
        description: 'desc 2',
        pageStart: 7,
        pageEnd: 7,
        status: 'pending',
        questionsGenerated: 0,
        error: null,
      },
    ]);
  });

  it('rejects an invalid plan file without writing anything', async () => {
    const filePath = writeTempJson({ sourceDoc: 'x.pdf', chunks: [] });

    await expect(writeChunkPlan(filePath)).rejects.toThrow('non-empty array');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --config jest.scripts.config.js scripts/question-bank/lib/writeChunkPlan.test.ts`
Expected: FAIL — `Cannot find module './writeChunkPlan'`. (This test needs the emulator — run the full suite with `npm run test:question-bank` if running standalone `npx jest` reports connection errors instead.)

- [ ] **Step 3: Implement `writeChunkPlan`**

Create `scripts/question-bank/lib/writeChunkPlan.ts`:

```ts
import { readFileSync } from 'node:fs';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from './adminApp';
import { validateChunkPlan } from './validate';
import type { ChunkRecord, IngestionRunRecord } from './types';

export async function writeChunkPlan(jsonPath: string): Promise<string> {
  const raw = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  const plan = validateChunkPlan(raw);

  const chunks: ChunkRecord[] = plan.chunks.map((chunk) => ({
    chunkId: chunk.chunkId,
    title: chunk.title,
    description: chunk.description,
    pageStart: chunk.pageStart,
    pageEnd: chunk.pageEnd,
    status: 'pending',
    questionsGenerated: 0,
    error: null,
  }));

  const record: IngestionRunRecord = {
    sourceDoc: plan.sourceDoc,
    createdAt: FieldValue.serverTimestamp(),
    status: 'processing',
    chunks,
  };

  const ref = getDb().collection('ingestionRuns').doc();
  await ref.set(record);

  return ref.id;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:question-bank`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/question-bank/lib/writeChunkPlan.ts scripts/question-bank/lib/writeChunkPlan.test.ts
git commit -m "Add chunk plan writer for question-bank ingestion Phase A"
```

---

### Task 4: Chunk status updater (Phase B progress tracking)

**Files:**
- Create: `scripts/question-bank/lib/updateChunkStatus.ts`
- Create: `scripts/question-bank/lib/updateChunkStatus.test.ts`

**Interfaces:**
- Consumes: `getDb()` (Task 1), `ChunkStatus` (Task 2).
- Produces: `updateChunkStatus(runId: string, chunkId: string, status: ChunkStatus, options?: { questionsGenerated?: number; error?: string }): Promise<void>`. Used by Task 6's CLI entry point. Automatically flips the parent `ingestionRuns` doc's `status` to `'complete'` once every chunk is `'done'` or `'error'`.

- [ ] **Step 1: Write the failing tests**

Create `scripts/question-bank/lib/updateChunkStatus.test.ts`:

```ts
import { getDb } from './adminApp';
import { updateChunkStatus } from './updateChunkStatus';
import type { IngestionRunRecord } from './types';

async function seedRun(chunks: IngestionRunRecord['chunks']): Promise<string> {
  const ref = getDb().collection('ingestionRuns').doc();
  await ref.set({
    sourceDoc: 'x.pdf',
    createdAt: new Date(),
    status: 'processing',
    chunks,
  });
  return ref.id;
}

describe('updateChunkStatus', () => {
  const baseChunk = {
    chunkId: 'c1',
    title: 'T',
    description: 'd',
    pageStart: 1,
    pageEnd: 2,
    status: 'pending' as const,
    questionsGenerated: 0,
    error: null,
  };

  it('marks a chunk done and records questionsGenerated', async () => {
    const runId = await seedRun([baseChunk, { ...baseChunk, chunkId: 'c2' }]);

    await updateChunkStatus(runId, 'c1', 'done', { questionsGenerated: 4 });

    const snap = await getDb().collection('ingestionRuns').doc(runId).get();
    const chunk = snap.data()?.chunks.find((c: { chunkId: string }) => c.chunkId === 'c1');
    expect(chunk).toMatchObject({ status: 'done', questionsGenerated: 4, error: null });
    expect(snap.data()?.status).toBe('processing');
  });

  it('marks a chunk errored with a message', async () => {
    const runId = await seedRun([baseChunk]);

    await updateChunkStatus(runId, 'c1', 'error', { error: 'PDF page unreadable' });

    const snap = await getDb().collection('ingestionRuns').doc(runId).get();
    const chunk = snap.data()?.chunks.find((c: { chunkId: string }) => c.chunkId === 'c1');
    expect(chunk).toMatchObject({ status: 'error', error: 'PDF page unreadable' });
  });

  it('flips the run to complete once every chunk is done or error', async () => {
    const runId = await seedRun([baseChunk, { ...baseChunk, chunkId: 'c2' }]);

    await updateChunkStatus(runId, 'c1', 'done', { questionsGenerated: 2 });
    await updateChunkStatus(runId, 'c2', 'error', { error: 'oops' });

    const snap = await getDb().collection('ingestionRuns').doc(runId).get();
    expect(snap.data()?.status).toBe('complete');
  });

  it('rejects an unknown chunkId', async () => {
    const runId = await seedRun([baseChunk]);

    await expect(updateChunkStatus(runId, 'nope', 'done', {})).rejects.toThrow(
      'Chunk "nope" not found'
    );
  });

  it('rejects an unknown runId', async () => {
    await expect(updateChunkStatus('nonexistent-run', 'c1', 'done', {})).rejects.toThrow(
      'does not exist'
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:question-bank`
Expected: FAIL — `Cannot find module './updateChunkStatus'`.

- [ ] **Step 3: Implement `updateChunkStatus`**

Create `scripts/question-bank/lib/updateChunkStatus.ts`:

```ts
import { getDb } from './adminApp';
import type { ChunkStatus, IngestionRunRecord } from './types';

export interface UpdateChunkStatusOptions {
  questionsGenerated?: number;
  error?: string;
}

export async function updateChunkStatus(
  runId: string,
  chunkId: string,
  status: ChunkStatus,
  options: UpdateChunkStatusOptions = {}
): Promise<void> {
  const ref = getDb().collection('ingestionRuns').doc(runId);

  await getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new Error(`ingestionRuns/${runId} does not exist`);
    }

    const data = snap.data() as IngestionRunRecord;
    const index = data.chunks.findIndex((c) => c.chunkId === chunkId);
    if (index === -1) {
      throw new Error(`Chunk "${chunkId}" not found in ingestionRuns/${runId}`);
    }

    const updatedChunks = [...data.chunks];
    updatedChunks[index] = {
      ...updatedChunks[index],
      status,
      questionsGenerated: options.questionsGenerated ?? updatedChunks[index].questionsGenerated,
      error: status === 'error' ? options.error ?? 'Unknown error' : null,
    };

    const allSettled = updatedChunks.every((c) => c.status === 'done' || c.status === 'error');

    tx.update(ref, {
      chunks: updatedChunks,
      status: allSettled ? 'complete' : data.status,
    });
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:question-bank`
Expected: PASS (all 5 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/question-bank/lib/updateChunkStatus.ts scripts/question-bank/lib/updateChunkStatus.test.ts
git commit -m "Add chunk status updater with run completion rollup"
```

---

### Task 5: Question writer (Phase B question generation output)

**Files:**
- Create: `scripts/question-bank/lib/writeQuestions.ts`
- Create: `scripts/question-bank/lib/writeQuestions.test.ts`

**Interfaces:**
- Consumes: `getDb()` (Task 1), `validateQuestions()`, `QuestionInput` (Task 2).
- Produces: `writeQuestions(jsonPath: string): Promise<{ written: number }>`. Used by Task 6's CLI entry point.

- [ ] **Step 1: Write the failing tests**

Create `scripts/question-bank/lib/writeQuestions.test.ts`:

```ts
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDb } from './adminApp';
import { writeQuestions } from './writeQuestions';

function writeTempJson(data: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'question-bank-test-'));
  const filePath = join(dir, 'questions.json');
  writeFileSync(filePath, JSON.stringify(data));
  return filePath;
}

describe('writeQuestions', () => {
  it('writes questions with status derived from selfCheck.passed', async () => {
    const filePath = writeTempJson([
      {
        conceptId: 'concept-1',
        chunkId: 'c1',
        sourceRef: 'p.5',
        type: 'fact',
        text: 'What color is a stop sign?',
        choices: ['Red', 'Yellow', 'Blue'],
        correctAnswer: 'Red',
        selfCheck: { passed: true, notes: '' },
      },
      {
        conceptId: 'concept-1',
        chunkId: 'c1',
        sourceRef: 'p.5',
        type: 'scenario',
        text: "You're at an intersection with a red octagonal sign — what do you do?",
        choices: ['Stop completely', 'Slow down only', 'Proceed if clear'],
        correctAnswer: 'Stop completely',
        selfCheck: { passed: false, notes: 'distractor "Proceed if clear" is ambiguous' },
      },
    ]);

    const result = await writeQuestions(filePath);
    expect(result.written).toBe(2);

    const snap = await getDb().collection('questions').where('conceptId', '==', 'concept-1').get();
    const statuses = snap.docs.map((d) => d.data().status).sort();
    expect(statuses).toEqual(['flagged', 'pending_review']);

    const flagged = snap.docs.find((d) => d.data().status === 'flagged')?.data();
    expect(flagged?.reviewedBy).toBeNull();
    expect(flagged?.reviewedAt).toBeNull();
    expect(flagged?.reviewNotes).toBeNull();
    expect(flagged?.createdAt).toBeDefined();
  });

  it('rejects an invalid questions file without writing anything', async () => {
    const filePath = writeTempJson([{ conceptId: 'x' }]);

    await expect(writeQuestions(filePath)).rejects.toThrow();

    const snap = await getDb().collection('questions').where('conceptId', '==', 'x').get();
    expect(snap.empty).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:question-bank`
Expected: FAIL — `Cannot find module './writeQuestions'`.

- [ ] **Step 3: Implement `writeQuestions`**

Create `scripts/question-bank/lib/writeQuestions.ts`:

```ts
import { readFileSync } from 'node:fs';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from './adminApp';
import { validateQuestions } from './validate';

export async function writeQuestions(jsonPath: string): Promise<{ written: number }> {
  const raw = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  const questions = validateQuestions(raw);

  const db = getDb();
  const batch = db.batch();
  const collection = db.collection('questions');

  for (const question of questions) {
    const ref = collection.doc();
    batch.set(ref, {
      ...question,
      status: question.selfCheck.passed ? 'pending_review' : 'flagged',
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  return { written: questions.length };
}
```

Note: a single chunk's question set is expected to be small (well under Firestore's 500-write batch limit), so this uses one batch with no chunking of writes.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:question-bank`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/question-bank/lib/writeQuestions.ts scripts/question-bank/lib/writeQuestions.test.ts
git commit -m "Add question writer for question-bank ingestion Phase B"
```

---

### Task 6: CLI entry points + subagent-facing docs

**Files:**
- Create: `scripts/question-bank/write-chunk-plan.ts`
- Create: `scripts/question-bank/update-chunk-status.ts`
- Create: `scripts/question-bank/write-questions.ts`
- Create: `scripts/question-bank/README.md`
- Modify: `package.json` (add `qb:*` scripts)

**Interfaces:**
- Consumes: `writeChunkPlan()` (Task 3), `updateChunkStatus()` (Task 4), `writeQuestions()` (Task 5).
- Produces: three runnable commands (`npm run qb:write-chunk-plan -- <path>`, `npm run qb:update-chunk-status -- <runId> <chunkId> <status> [...]`, `npm run qb:write-questions -- <path>`) — this is what the spec's Phase A/B subagent prompts invoke via `Bash`.

- [ ] **Step 1: Create the chunk-plan CLI entry point**

Create `scripts/question-bank/write-chunk-plan.ts`:

```ts
import { writeChunkPlan } from './lib/writeChunkPlan';

async function main() {
  const [, , jsonPath] = process.argv;
  if (!jsonPath) {
    console.error('Usage: write-chunk-plan <path-to-chunk-plan.json>');
    process.exit(1);
  }

  const runId = await writeChunkPlan(jsonPath);
  console.log(runId);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
```

- [ ] **Step 2: Create the chunk-status CLI entry point**

Create `scripts/question-bank/update-chunk-status.ts`:

```ts
import { updateChunkStatus } from './lib/updateChunkStatus';
import type { ChunkStatus } from './lib/types';

async function main() {
  const [, , runId, chunkId, status, ...rest] = process.argv;
  if (!runId || !chunkId || !status) {
    console.error(
      'Usage: update-chunk-status <runId> <chunkId> <pending|done|error> [--questionsGenerated N] [--error "message"]'
    );
    process.exit(1);
  }

  const options: { questionsGenerated?: number; error?: string } = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (rest[i] === '--questionsGenerated') options.questionsGenerated = Number(rest[i + 1]);
    if (rest[i] === '--error') options.error = rest[i + 1];
  }

  await updateChunkStatus(runId, chunkId, status as ChunkStatus, options);
  console.log(`Updated ${chunkId} in ${runId} to ${status}`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
```

- [ ] **Step 3: Create the write-questions CLI entry point**

Create `scripts/question-bank/write-questions.ts`:

```ts
import { writeQuestions } from './lib/writeQuestions';

async function main() {
  const [, , jsonPath] = process.argv;
  if (!jsonPath) {
    console.error('Usage: write-questions <path-to-questions.json>');
    process.exit(1);
  }

  const { written } = await writeQuestions(jsonPath);
  console.log(`Wrote ${written} question(s)`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
```

- [ ] **Step 4: Wire up npm scripts**

In `package.json`, under `"scripts"`, add:

```json
"qb:write-chunk-plan": "tsx scripts/question-bank/write-chunk-plan.ts",
"qb:update-chunk-status": "tsx scripts/question-bank/update-chunk-status.ts",
"qb:write-questions": "tsx scripts/question-bank/write-questions.ts"
```

- [ ] **Step 5: Write the subagent-facing README**

Create `scripts/question-bank/README.md`:

```markdown
# Question Bank Ingestion Scripts

CLI tools used by the question-bank ingestion pipeline
(`docs/superpowers/specs/2026-09-08-question-bank-ingestion-design.md`) to write Firestore
content. Subagents invoke these via `Bash` — they do not have direct Firestore access.

All three commands authenticate via Application Default Credentials
(`gcloud auth application-default login`) against the `dmv-app-dev` Firestore project by
default. Override the project with `GOOGLE_CLOUD_PROJECT=<project-id>`.

## `qb:write-chunk-plan` (Phase A, run once)

```bash
npm run qb:write-chunk-plan -- /path/to/chunk-plan.json
```

Input JSON shape:

```json
{
  "sourceDoc": "DR_2337_Jan2025.pdf",
  "chunks": [
    {
      "chunkId": "right-of-way",
      "title": "Right-of-Way at Intersections",
      "description": "Rules for who yields at 4-way stops, uncontrolled intersections, and roundabouts",
      "pageStart": 12,
      "pageEnd": 13
    }
  ]
}
```

Prints the generated `runId` to stdout — record it, every later command needs it.

## `qb:update-chunk-status` (Phase B, once per chunk)

```bash
npm run qb:update-chunk-status -- <runId> <chunkId> done --questionsGenerated 6
npm run qb:update-chunk-status -- <runId> <chunkId> error --error "page 13 unreadable"
```

Marking the last remaining chunk `done` or `error` automatically flips the run's own `status`
to `complete`.

## `qb:write-questions` (Phase B, once per chunk, before marking it done)

```bash
npm run qb:write-questions -- /path/to/questions.json
```

Input JSON shape (array of questions — write all of one chunk's questions in a single call):

```json
[
  {
    "conceptId": "row-4way-stop",
    "chunkId": "right-of-way",
    "sourceRef": "p.12",
    "type": "scenario",
    "text": "You arrive at a 4-way stop at the same time as another car to your right. Who goes first?",
    "choices": ["The car to your right", "You, because you arrived first", "Whoever is faster"],
    "correctAnswer": "The car to your right",
    "selfCheck": { "passed": true, "notes": "" }
  }
]
```

`status` is set automatically: `pending_review` if `selfCheck.passed` is `true`, `flagged`
otherwise. Nothing written by this script is ever `approved` — that only happens via human
review in the Firebase console.
```

- [ ] **Step 6: Manually smoke-test the wired-up commands against the emulator**

Run:
```bash
firebase emulators:start --only firestore
```

In a second terminal:
```bash
echo '{"sourceDoc":"test.pdf","chunks":[{"chunkId":"c1","title":"T","description":"d","pageStart":1,"pageEnd":1}]}' > /tmp/plan.json
npm run qb:write-chunk-plan -- /tmp/plan.json
# copy the printed runId, then:
echo '[{"conceptId":"k1","chunkId":"c1","sourceRef":"p.1","type":"fact","text":"Sample?","choices":["A","B"],"correctAnswer":"A","selfCheck":{"passed":true,"notes":""}}]' > /tmp/questions.json
npm run qb:write-questions -- /tmp/questions.json
npm run qb:update-chunk-status -- <runId> c1 done --questionsGenerated 1
```

Expected: each command prints a success line with no errors; the Firebase Emulator UI
(`http://localhost:4200`) shows the `ingestionRuns` doc with `status: "complete"` and one
`questions` doc with `status: "pending_review"`. Stop the emulator (Ctrl+C) when done.

- [ ] **Step 7: Commit**

```bash
git add package.json scripts/question-bank/write-chunk-plan.ts scripts/question-bank/update-chunk-status.ts scripts/question-bank/write-questions.ts scripts/question-bank/README.md
git commit -m "Add question-bank CLI entry points and usage docs"
```

---

## After this plan

This plan delivers the **tooling** only. Running an actual ingestion pass over
`docs/dmv-reference/DR_2337_Jan2025.pdf` — dispatching the Phase A chunk-plan subagent, then
looping Phase B subagent dispatches per chunk using the prompts in the design spec, calling
these scripts along the way — is a separate, manual/orchestrated session, not a coded task.
