# Local Test Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a small `src/study/` module that persists the question set for one in-progress practice test to on-device storage (AsyncStorage), so a teen user can keep taking that test if their device goes offline mid-test — scoped to exactly one active test at a time, never the full question bank.

**Architecture:** A single-slot cache (`saveActiveTestCache` / `getActiveTestCache` / `clearActiveTestCache`) backed by one fixed AsyncStorage key. Single-slot rather than per-`testId` keys because only one test can ever be in progress at a time for this app — simpler than a multi-key design and still satisfies every acceptance criterion in `ph-1-us-5`. This is the first test infrastructure for `src/`, so this plan also adds a lightweight Jest config for it (plain `ts-jest`, no React Native component rendering needed — `@react-native-async-storage/async-storage` ships an official in-memory Jest mock that doesn't require the full `react-native` preset).

**Tech Stack:** TypeScript, `@react-native-async-storage/async-storage`, Jest + `ts-jest`.

**Spec:** `docs/phases/phase-1-question-bank-and-content-model/ph-1-us-5-local-test-cache.md` (and its parent, `ph-1-us-3-scoped-offline-test-cache.md`)

## Global Constraints

- Caches exactly **one** active test's question set at a time — never the full question bank. A new `saveActiveTestCache` call overwrites whatever was previously cached.
- The question shape stored/returned matches the `ClientQuestion` shape returned by the `assembleTest` Cloud Function (`docs/superpowers/plans/2026-09-11-assemble-test-cloud-function.md`): `{ id, text, choices, type, conceptId }`. This plan does not call `assembleTest` yet — that integration is Phase 3's — so tests use hand-built sample data matching that shape.
- Storage failures (e.g. AsyncStorage write failure) must propagate to the caller as a rejected promise, not be silently swallowed.
- No new UI/screens in this plan — this is a data-layer module only, imported later by Phase 3's test-taking flow.

---

### Task 1: Jest setup for `src/` + save/read round trip

**Files:**
- Create: `jest.app.config.js`
- Create: `jest.app.setup.js`
- Create: `src/study/types.ts`
- Create: `src/study/testCache.ts`
- Create: `src/study/testCache.test.ts`
- Modify: `package.json` (add `@react-native-async-storage/async-storage` dependency + `test:app` script)

**Interfaces:**
- Produces:
  - Type: `ClientQuestion` (`{ id, text, choices, type, conceptId }`) and `CachedTest` (`{ testId, questions, cachedAt }`) — used by Tasks 2 and 3, and by Phase 3 later.
  - Functions: `saveActiveTestCache(entry: { testId: string; questions: ClientQuestion[] }): Promise<void>`, `getActiveTestCache(): Promise<CachedTest | null>` — used by Tasks 2 and 3.

- [ ] **Step 1: Install the dependency**

Run:
```bash
npm install @react-native-async-storage/async-storage
```

- [ ] **Step 2: Add the Jest setup file that mocks AsyncStorage**

Create `jest.app.setup.js`:

```js
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
```

- [ ] **Step 3: Add the Jest config for `src/`**

Create `jest.app.config.js`:

```js
const path = require('path');

/** Jest config for src/ — plain ts-jest, no React Native component rendering needed for
 * this module (it's a data-layer cache, not a component). Uses the official AsyncStorage
 * Jest mock (an in-memory implementation) rather than pulling in the full 'react-native'
 * jest preset, which this repo doesn't need yet. */
module.exports = {
  testEnvironment: 'node',
  rootDir: __dirname,
  roots: [path.join(__dirname, 'src')],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: path.join(__dirname, 'tsconfig.json') }],
  },
  setupFiles: [path.join(__dirname, 'jest.app.setup.js')],
};
```

- [ ] **Step 4: Add the `test:app` npm script**

In the root `package.json`, under `"scripts"`, add:

```json
"test:app": "jest --config jest.app.config.js"
```

- [ ] **Step 5: Write the types module**

Create `src/study/types.ts`:

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

- [ ] **Step 6: Write the failing tests**

Create `src/study/testCache.test.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveActiveTestCache, getActiveTestCache } from './testCache';
import type { ClientQuestion } from './types';

const sampleQuestions: ClientQuestion[] = [
  {
    id: 'q1',
    text: 'What color is a stop sign?',
    choices: ['Red', 'Blue'],
    type: 'fact',
    conceptId: 'stop-sign-color',
  },
];

afterEach(async () => {
  await AsyncStorage.clear();
});

describe('saveActiveTestCache / getActiveTestCache', () => {
  it('round-trips a saved test', async () => {
    await saveActiveTestCache({ testId: 'test-1', questions: sampleQuestions });

    const cached = await getActiveTestCache();

    expect(cached?.testId).toBe('test-1');
    expect(cached?.questions).toEqual(sampleQuestions);
    expect(cached?.cachedAt).toEqual(expect.any(String));
  });

  it('returns null when nothing has been cached', async () => {
    const cached = await getActiveTestCache();

    expect(cached).toBeNull();
  });

  it('overwrites a previously cached test when a new one is saved', async () => {
    await saveActiveTestCache({ testId: 'test-1', questions: sampleQuestions });
    await saveActiveTestCache({ testId: 'test-2', questions: [] });

    const cached = await getActiveTestCache();

    expect(cached?.testId).toBe('test-2');
    expect(cached?.questions).toEqual([]);
  });
});
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `npm run test:app`
Expected: FAIL — `Cannot find module './testCache'`.

- [ ] **Step 8: Implement `saveActiveTestCache` and `getActiveTestCache`**

Create `src/study/testCache.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ClientQuestion } from './types';

const ACTIVE_TEST_CACHE_KEY = '@dmv-app/active-test-cache';

export interface CachedTest {
  testId: string;
  questions: ClientQuestion[];
  cachedAt: string;
}

export async function saveActiveTestCache(entry: {
  testId: string;
  questions: ClientQuestion[];
}): Promise<void> {
  const record: CachedTest = { ...entry, cachedAt: new Date().toISOString() };
  await AsyncStorage.setItem(ACTIVE_TEST_CACHE_KEY, JSON.stringify(record));
}

export async function getActiveTestCache(): Promise<CachedTest | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_TEST_CACHE_KEY);
  if (raw === null) {
    return null;
  }
  return JSON.parse(raw) as CachedTest;
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npm run test:app`
Expected: PASS (all 3 tests)

- [ ] **Step 10: Commit**

```bash
git add jest.app.config.js jest.app.setup.js src/study/types.ts src/study/testCache.ts src/study/testCache.test.ts package.json package-lock.json
git commit -m "Add scoped active-test cache with save/read round trip"
```

---

### Task 2: Clear the cache

**Files:**
- Modify: `src/study/testCache.ts`
- Modify: `src/study/testCache.test.ts`

**Interfaces:**
- Consumes: `ACTIVE_TEST_CACHE_KEY` (private, Task 1).
- Produces: `clearActiveTestCache(): Promise<void>` — used by Phase 3 when a test completes or is abandoned.

- [ ] **Step 1: Write the failing tests**

Add to `src/study/testCache.test.ts`:

```ts
import { saveActiveTestCache, getActiveTestCache, clearActiveTestCache } from './testCache';
```

(update the existing import line to include `clearActiveTestCache`, then add:)

```ts
describe('clearActiveTestCache', () => {
  it('removes a cached test so a later read returns null', async () => {
    await saveActiveTestCache({ testId: 'test-1', questions: sampleQuestions });

    await clearActiveTestCache();

    expect(await getActiveTestCache()).toBeNull();
  });

  it('is a no-op when nothing was cached', async () => {
    await expect(clearActiveTestCache()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:app`
Expected: FAIL — `clearActiveTestCache is not a function` (or a TypeScript error on the import).

- [ ] **Step 3: Implement `clearActiveTestCache`**

Add to `src/study/testCache.ts`:

```ts
export async function clearActiveTestCache(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_TEST_CACHE_KEY);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:app`
Expected: PASS (all 5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/study/testCache.ts src/study/testCache.test.ts
git commit -m "Add clearActiveTestCache"
```

---

### Task 3: Lock in storage-failure propagation

**Files:**
- Modify: `src/study/testCache.test.ts`

No source change expected in this task — `saveActiveTestCache` (Task 1) already `await`s
`AsyncStorage.setItem` with no `try`/`catch`, so a rejection already propagates. This task adds
a regression test locking that behavior in, so a future change can't silently start swallowing
storage errors (per this story's "Failure modes" acceptance criterion).

**Interfaces:**
- Consumes: `saveActiveTestCache` (Task 1).

- [ ] **Step 1: Write the test**

Add to `src/study/testCache.test.ts`:

```ts
describe('storage failure propagation', () => {
  it('propagates a write failure to the caller instead of swallowing it', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('storage full'));

    await expect(
      saveActiveTestCache({ testId: 'test-1', questions: sampleQuestions })
    ).rejects.toThrow('storage full');
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npm run test:app`
Expected: PASS immediately — this is a regression guard on already-correct behavior, not a
red/green cycle (there's nothing to implement; the point is to catch a future change that adds
an error-swallowing `try`/`catch`).

- [ ] **Step 3: Commit**

```bash
git add src/study/testCache.test.ts
git commit -m "Add regression test for storage-failure propagation"
```

---

## After this plan

`src/study/testCache.ts` exists and is fully tested but nothing calls it yet — Phase 3's
test-taking flow is what will call `assembleTest` (from
`docs/superpowers/plans/2026-09-11-assemble-test-cloud-function.md`) and then
`saveActiveTestCache`/`getActiveTestCache`/`clearActiveTestCache` around a real test session,
including the resume-vs-clear-stale-cache UX flagged as an open question in `ph-1-us-5`.
