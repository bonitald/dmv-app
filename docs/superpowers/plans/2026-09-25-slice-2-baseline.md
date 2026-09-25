# Slice 2 — Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new user can start the 45-question baseline from Home or onboarding, answer it one
section at a time, take a break between sections, survive a force-quit or lost connection
mid-section without losing answers, and land on a placeholder results screen after section 3.

**Architecture:** The app gets its first Cloud Function client (`@react-native-firebase/functions`)
behind typed wrappers in `src/api/` that turn Firebase errors into a small set of UI-facing kinds.
A generic quiz runner (`src/quiz/`) renders questions and collects answers; it knows nothing
about the baseline. A small session store (`src/quiz/quizSession.ts`) persists the active test's
questions (via the existing `src/study/testCache.ts`) and answers to AsyncStorage on every change.
The baseline flow (`src/baseline/`) owns fetching, submitting, the intro and check-in screens,
and resume, and reads `users/{uid}/baseline/progress` for Home's card.
`@react-native-community/netinfo` tells the runner when the phone is offline, so answers are held
and submitted automatically once the connection is back.

**Tech Stack:** Expo SDK 57 dev client, React Navigation 7 (native stack + bottom tabs),
`@react-native-firebase/*` v26 (modular API), AsyncStorage, NetInfo, Jest (`test:app` = Node
ts-jest, `test:components` = jest-expo + @testing-library/react-native).

**Spec:** `docs/build-order.md` (Slice 2) and the stories it lists:
`docs/phases/phase-3-practice-test-generator-and-test-taking-ui/ph-3-us-4-test-taking-screen.md`,
`ph-3-us-13-baseline-flow-ui.md`, `ph-3-us-1-offline-test-cache-in-test-flow.md`, parent
`ph-3-us-12-baseline-diagnostic.md`. Backend contracts: `functions/README.md`.

## Decisions made with the user (2026-09-25)

- **Entry points:** Home's existing test card (three states) and onboarding's "Test what I know".
  **The Practice tab stays a placeholder** until Slice 5. ph-3-us-4's Practice-tab criteria
  (practice-test start, `assembleTest` flow) are out of scope here.
- **No score at the section check-in.**
- **No resume/discard prompt at launch.** Reopening the baseline restores saved answers
  automatically. The launch prompt waits for practice tests (Slice 5).
- **Cached answers don't expire.** They're kept until the section is submitted, or until the
  server serves a different section (e.g. the user finished it on another device).
- **Use NetInfo** so the user can keep answering offline and have answers held and submitted when
  they're back online.

## Global Constraints

- Copy says "Colorado Driver Handbook" where it names a source; no state selector (ph-3-us-11).
- Colors, spacing, radius and type come only from `src/theme/tokens.ts`. No new hex values.
- Reuse `src/components/Button.tsx` and `src/components/Card.tsx`.
- No right/wrong or correct answer is shown while taking a section, or at the check-in.
- Tap targets ≥ 48pt (the `Button` min height).
- Native Firebase modules are never imported by pure-data modules (the `profileData.ts` vs
  `profile.ts` split): pure logic stays Node-testable under `npm run test:app`.
- Every AsyncStorage key starts with `dmv-app:` and is scoped by uid where it holds user data.
- Component tests mock app modules that wrap native Firebase, not Firebase itself
  (`jest.components.config.js` header).

## Review Focus

1. **Force-quit between answering and the AsyncStorage write** — the user expects the answer they
   just tapped to be there after relaunch. Answers are written on every change (Task 3 test:
   `saveAnswers` persists immediately; Task 6 test: reopen restores answers).
2. **Server moved on while a stale local session exists** (section finished on another device) —
   the user expects the server's section with empty answers, not old answers on new questions.
   (Task 6 test: "a stale session for another section is discarded".)
3. **Offline at submit, then back online** — the user expects answers submitted once, without
   tapping again. (Task 7 test: "submits automatically when the connection returns", asserting
   exactly one `scoreTest` call.)
4. **Double-tap on Submit / "Submit anyway"** — one `scoreTest` call. (Task 4 test + Task 6's
   ref guard.)
5. **`scoreTest` returns `already-exists`** (answers were graded but the response was lost) — the
   user expects to move on, not see an error. (Task 6 test.)

## Prerequisites (outside the code)

These block **device testing**, not coding. Status as of 2026-09-25:

- [x] `dmv-app-dev` on Blaze; Firestore rules deployed.
- [ ] Functions deployed to dev. The last attempt failed on the Cloud Build service account
  permission; the user has granted it. Deploy with:
  `FUNCTIONS_DISCOVERY_TIMEOUT=90 npx firebase deploy --only functions --project dev --force`
  (`--force` sets the Artifact Registry cleanup policy).
- [ ] **Topic catalog is empty on dev** (`topics`: 0 docs). Run `npm run qb:publish-topics -- <runId>`.
- [ ] **Baseline `v1` isn't published.** It needs a `baseline-selection.json` with one approved
  question for each of 45 topics. **Only 21 topics currently have an approved question**
  (628 approved, 784 pending review, 3 flagged). The user must decide how to unblock this.
  See "Open question" at the end.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/api/types.ts` (create) | Client copies of the callable request/response shapes |
| `src/api/callableErrors.ts` (create) | Pure: Firebase error → `CallableError` with a UI `kind` |
| `src/api/callableErrors.test.ts` (create) | Node tests for the mapping |
| `src/api/callables.ts` (create) | Typed wrappers for the four callables |
| `src/network/useIsOnline.ts` (create) | NetInfo hook: `true` / `false` (unknown counts as online) |
| `src/quiz/answers.ts` (create) | Pure: `Answers` type, `toAnswerList`, `countUnanswered` |
| `src/quiz/answers.test.ts` (create) | Node tests |
| `src/quiz/quizSession.ts` (create) | Active session + answers persistence (AsyncStorage + testCache) |
| `src/quiz/quizSession.test.ts` (create) | Node tests |
| `src/quiz/QuizCard.tsx` (create) | One question + choices, selected state, scenario badge |
| `src/quiz/QuizRunner.tsx` (create) | Navigation, question strip, unanswered warning, submit, banners |
| `src/quiz/QuizRunner.test.tsx` (create) | Component tests |
| `src/baseline/baselineProgressData.ts` (create) | Pure: progress doc → `BaselineProgress` |
| `src/baseline/baselineProgressData.test.ts` (create) | Node tests |
| `src/baseline/useBaselineProgress.ts` (create) | Live listener on `users/{uid}/baseline/progress` |
| `src/baseline/BaselineScreen.tsx` (create) | The flow: intro → section → check-in → complete |
| `src/baseline/BaselineIntro.tsx`, `BaselineCheckIn.tsx`, `BaselineComplete.tsx`, `BaselineUnavailable.tsx` (create) | Presentational pieces of the flow |
| `src/baseline/baselineFlow.test.tsx` (create) | Component tests for the flow |
| `src/components/NoConnection.tsx` (create) | Reusable no-connection state (from `App.tsx`'s pattern) |
| `src/home/HomeScreen.tsx` (modify) | Test card shows Start / Resume / Done |
| `src/navigation/RootNavigator.tsx` (modify) | `Baseline` route renders `BaselineScreen` |
| `src/onboarding/onboardingFlow.test.tsx` (modify) | Mock the new baseline modules |
| `jest.components.config.js` (modify) | Map NetInfo to its Jest mock |
| `package.json`, `package-lock.json` (modify) | New native deps |

---

### Task 1: Native deps, callable wrappers and error mapping

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `src/api/types.ts`, `src/api/callableErrors.ts`, `src/api/callableErrors.test.ts`, `src/api/callables.ts`

**Interfaces:**
- Produces:
  - `QuizQuestion`, `BaselineSection`, `AnswerSubmission`, `PerQuestionResult`, `ScoreTestResult`, `AssembledTest` (types.ts)
  - `type CallableErrorKind = 'offline' | 'already-exists' | 'failed-precondition' | 'not-found' | 'unauthenticated' | 'invalid-argument' | 'resource-exhausted' | 'unknown'`
  - `class CallableError extends Error { kind: CallableErrorKind; code: string }`
  - `toCallableError(error: unknown): CallableError`
  - `startOrResumeBaseline(): Promise<BaselineSection>`
  - `scoreTest(input: { testId: string; answers: AnswerSubmission[] }): Promise<ScoreTestResult>`
  - `assembleTest(): Promise<AssembledTest>`
  - `assembleMiniQuiz(input: { chunkId: string; count?: number; excludeIds?: string[] }): Promise<AssembledTest>`
  - All wrappers reject only with `CallableError`.

- [ ] **Step 1: Install the native modules**

Run: `npx expo install @react-native-firebase/functions @react-native-community/netinfo`
Expected: both added to `dependencies`; `@react-native-firebase/functions` at the same major (26)
as the other `@react-native-firebase/*` packages. If `expo install` picks a different major, pin
it to `^26.4.0` to match. Neither needs an `app.config.ts` plugin entry.

Then check how this version reports error codes:
Run: `grep -rn "functions/" node_modules/@react-native-firebase/functions/lib/*.js | head`
Note whether codes are prefixed (`functions/unavailable`) or bare (`unavailable`). The mapping
below accepts both.

- [ ] **Step 2: Write the failing test**

`src/api/callableErrors.test.ts`:
```ts
import { CallableError, toCallableError } from './callableErrors';

describe('toCallableError', () => {
  test.each([
    ['unavailable', 'offline'],
    ['functions/unavailable', 'offline'],
    ['deadline-exceeded', 'offline'],
    ['already-exists', 'already-exists'],
    ['functions/already-exists', 'already-exists'],
    ['failed-precondition', 'failed-precondition'],
    ['not-found', 'not-found'],
    ['unauthenticated', 'unauthenticated'],
    ['invalid-argument', 'invalid-argument'],
    ['resource-exhausted', 'resource-exhausted'],
    ['internal', 'unknown'],
  ])('code %s maps to %s', (code, kind) => {
    const mapped = toCallableError(Object.assign(new Error('boom'), { code }));
    expect(mapped).toBeInstanceOf(CallableError);
    expect(mapped.kind).toBe(kind);
    expect(mapped.message).toBe('boom');
  });

  test('a network failure with no code is offline', () => {
    expect(toCallableError(new Error('Network request failed')).kind).toBe('offline');
  });

  test('a non-Error value is unknown', () => {
    expect(toCallableError('nope').kind).toBe('unknown');
  });

  test('an existing CallableError is returned as is', () => {
    const original = new CallableError('offline', 'unavailable', 'x');
    expect(toCallableError(original)).toBe(original);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx jest --config jest.app.config.js src/api`
Expected: FAIL, cannot find module `./callableErrors`.

- [ ] **Step 4: Write the types and the mapping**

`src/api/types.ts`:
```ts
// Client-side copies of the Cloud Function contracts in functions/README.md. The functions
// package is built separately, so these are kept in sync by hand. Change both sides together.

export type QuestionType = 'fact' | 'scenario';

/** A question as the assemble functions hand it out: no correct answer. */
export interface QuizQuestion {
  id: string;
  text: string;
  choices: string[];
  type: QuestionType;
  chunkId: string;
  conceptId: string;
}

/** `assembleTest` / `assembleMiniQuiz` response. */
export interface AssembledTest {
  testId: string;
  questions: QuizQuestion[];
}

/** `startOrResumeBaseline` response. `testId` is `baseline-{version}-{section}`. */
export interface BaselineSection extends AssembledTest {
  version: string;
  section: number;
  totalSections: number;
}

export interface AnswerSubmission {
  questionId: string;
  choice: string;
}

export interface PerTopicResult {
  chunkId: string;
  correct: number;
  total: number;
}

/** `correctAnswer` / `correct` are null for baseline sections before the last. */
export interface PerQuestionResult {
  questionId: string;
  chunkId: string | null;
  choice: string | null;
  correctAnswer: string | null;
  correct: boolean | null;
  unavailable?: true;
}

export interface ScoreTestResult {
  testId: string;
  type: 'practice' | 'mini-quiz' | 'baseline';
  score: number;
  correctCount: number;
  totalCount: number;
  perTopic: PerTopicResult[];
  perQuestion: PerQuestionResult[];
  /** Final baseline section only: all 45 questions with answers revealed. */
  baselineReview?: PerQuestionResult[];
  recommendation: 'move-on' | 'review-again' | null;
}
```

`src/api/callableErrors.ts`:
```ts
// ph-3-us-4: turns whatever a callable throws into one of a few kinds the UI branches on.
// Kept free of Firebase imports so it runs under plain-Node Jest.

export type CallableErrorKind =
  | 'offline'
  | 'already-exists'
  | 'failed-precondition'
  | 'not-found'
  | 'unauthenticated'
  | 'invalid-argument'
  | 'resource-exhausted'
  | 'unknown';

export class CallableError extends Error {
  constructor(
    readonly kind: CallableErrorKind,
    /** The raw code without any `functions/` prefix, for logging. */
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'CallableError';
  }
}

const KIND_BY_CODE: Record<string, CallableErrorKind> = {
  unavailable: 'offline',
  'deadline-exceeded': 'offline',
  'already-exists': 'already-exists',
  'failed-precondition': 'failed-precondition',
  'not-found': 'not-found',
  unauthenticated: 'unauthenticated',
  'invalid-argument': 'invalid-argument',
  'resource-exhausted': 'resource-exhausted',
};

export function toCallableError(error: unknown): CallableError {
  if (error instanceof CallableError) return error;
  if (!(error instanceof Error)) return new CallableError('unknown', '', String(error));

  const rawCode = (error as { code?: unknown }).code;
  const code = typeof rawCode === 'string' ? rawCode.replace(/^functions\//, '') : '';
  let kind = KIND_BY_CODE[code] ?? 'unknown';
  // Some network failures arrive without a code, only a message.
  if (kind === 'unknown' && !code && /network/i.test(error.message)) kind = 'offline';
  return new CallableError(kind, code, error.message);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest --config jest.app.config.js src/api`
Expected: PASS.

- [ ] **Step 6: Write the wrappers**

`src/api/callables.ts`:
```ts
import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { toCallableError } from './callableErrors';
import type { AnswerSubmission, AssembledTest, BaselineSection, ScoreTestResult } from './types';

// ph-3-us-4: the app's only way to call Cloud Functions. Each wrapper resolves with the typed
// response or rejects with a CallableError, so screens never see raw Firebase errors.
// Contracts: functions/README.md.

async function call<Req, Res>(name: string, data?: Req): Promise<Res> {
  try {
    const result = await httpsCallable<Req, Res>(getFunctions(getApp()), name)(data as Req);
    return result.data;
  } catch (error) {
    throw toCallableError(error);
  }
}

export function startOrResumeBaseline(): Promise<BaselineSection> {
  return call('startOrResumeBaseline');
}

export function scoreTest(input: {
  testId: string;
  answers: AnswerSubmission[];
}): Promise<ScoreTestResult> {
  return call('scoreTest', input);
}

/** Practice tests: wired to a screen in Slice 5. */
export function assembleTest(): Promise<AssembledTest> {
  return call('assembleTest');
}

/** Concept mini-quizzes: wired to a screen in Slice 4b. */
export function assembleMiniQuiz(input: {
  chunkId: string;
  count?: number;
  excludeIds?: string[];
}): Promise<AssembledTest> {
  return call('assembleMiniQuiz', input);
}
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `httpsCallable`'s generics differ in this version, adjust the `call`
helper's typing only. Keep the wrapper signatures above.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/api
git commit -m "feat(ph-3-us-4): add functions client, typed callable wrappers and error mapping"
```

---

### Task 2: Online status hook and Jest wiring

**Files:**
- Create: `src/network/useIsOnline.ts`
- Modify: `jest.components.config.js`

**Interfaces:**
- Produces: `useIsOnline(): boolean` — `false` only when NetInfo says `isConnected === false` or
  `isInternetReachable === false`; `true` otherwise, including "unknown" (`null`), so a slow first
  NetInfo read never blocks the user.

- [ ] **Step 1: Write the hook**

`src/network/useIsOnline.ts`:
```ts
import { useEffect, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

// ph-3-us-1: whether the phone can reach the internet right now. Unknown counts as online, so
// the app never blocks the user before NetInfo's first reading; a real failure still surfaces
// through the callable's own `offline` error.
export function isOnline(state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

export function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => NetInfo.addEventListener((state) => setOnline(isOnline(state))), []);
  return online;
}
```

- [ ] **Step 2: Map NetInfo to its Jest mock**

In `jest.components.config.js`, add to `moduleNameMapper`:
```js
    '^@react-native-community/netinfo$': path.join(
      __dirname,
      'node_modules',
      '@react-native-community',
      'netinfo',
      'jest',
      'netinfo-mock.js'
    ),
```
Check the file exists first: `ls node_modules/@react-native-community/netinfo/jest/`.

- [ ] **Step 3: Verify existing suites still pass and types check**

Run: `npm run test:components && npm run test:app && npx tsc --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/network jest.components.config.js
git commit -m "feat(ph-3-us-1): add useIsOnline hook backed by NetInfo"
```

---

### Task 3: Answers helpers and the quiz session store

**Files:**
- Create: `src/quiz/answers.ts`, `src/quiz/answers.test.ts`, `src/quiz/quizSession.ts`, `src/quiz/quizSession.test.ts`

**Interfaces:**
- Consumes: `saveTestCache`, `getTestCache`, `clearTestCache` from `src/study/testCache.ts`; `QuizQuestion`, `AnswerSubmission` from `src/api/types.ts`.
- Produces:
  - `type Answers = Record<string, string>` (questionId → chosen choice text)
  - `toAnswerList(questions: QuizQuestion[], answers: Answers): AnswerSubmission[]` — answered only, in question order
  - `countUnanswered(questions: QuizQuestion[], answers: Answers): number`
  - `type SessionKind = 'baseline' | 'practice' | 'mini-quiz'`
  - `interface ActiveSession { testId: string; kind: SessionKind; questions: QuizQuestion[]; answers: Answers }`
  - `startSession(uid, testId, kind, questions): Promise<void>` — rejects if the cache write fails
  - `saveAnswers(uid, testId, answers): Promise<void>` — no-op unless `testId` is the active one; never rejects
  - `getActiveSession(uid): Promise<ActiveSession | null>`
  - `endSession(uid, testId): Promise<void>` — never rejects

- [ ] **Step 1: Write the failing tests**

`src/quiz/answers.test.ts`:
```ts
import type { QuizQuestion } from '../api/types';
import { countUnanswered, toAnswerList } from './answers';

const q = (id: string): QuizQuestion => ({
  id, text: `Q ${id}`, choices: ['a', 'b'], type: 'fact', chunkId: 'c', conceptId: 'k',
});
const questions = [q('1'), q('2'), q('3')];

test('toAnswerList keeps question order and skips unanswered', () => {
  expect(toAnswerList(questions, { '3': 'b', '1': 'a' })).toEqual([
    { questionId: '1', choice: 'a' },
    { questionId: '3', choice: 'b' },
  ]);
});

test('toAnswerList ignores answers for questions not in the set', () => {
  expect(toAnswerList(questions, { '9': 'a' })).toEqual([]);
});

test('countUnanswered', () => {
  expect(countUnanswered(questions, { '2': 'a' })).toBe(2);
  expect(countUnanswered(questions, { '1': 'a', '2': 'a', '3': 'b' })).toBe(0);
});
```

`src/quiz/quizSession.test.ts`:
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QuizQuestion } from '../api/types';
import { getTestCache } from '../study/testCache';
import { endSession, getActiveSession, saveAnswers, startSession } from './quizSession';

const questions: QuizQuestion[] = [
  { id: 'q1', text: 'Q1', choices: ['a', 'b'], type: 'fact', chunkId: 'c', conceptId: 'k' },
];

beforeEach(() => AsyncStorage.clear());

test('a started session is found again with its questions and no answers', async () => {
  await startSession('u1', 'baseline-v1-1', 'baseline', questions);
  expect(await getActiveSession('u1')).toEqual({
    testId: 'baseline-v1-1', kind: 'baseline', questions, answers: {},
  });
});

test('saveAnswers persists immediately', async () => {
  await startSession('u1', 't1', 'baseline', questions);
  await saveAnswers('u1', 't1', { q1: 'b' });
  expect((await getActiveSession('u1'))?.answers).toEqual({ q1: 'b' });
});

test('saveAnswers for a test that is not active does nothing', async () => {
  await startSession('u1', 't1', 'baseline', questions);
  await saveAnswers('u1', 'other', { q1: 'b' });
  expect((await getActiveSession('u1'))?.answers).toEqual({});
});

test('sessions are per user', async () => {
  await startSession('u1', 't1', 'baseline', questions);
  expect(await getActiveSession('u2')).toBeNull();
});

test('endSession clears the session and the cached questions', async () => {
  await startSession('u1', 't1', 'baseline', questions);
  await endSession('u1', 't1');
  expect(await getActiveSession('u1')).toBeNull();
  expect(await getTestCache('t1')).toBeNull();
});

test('starting a new session replaces the old one and clears its questions', async () => {
  await startSession('u1', 't1', 'baseline', questions);
  await startSession('u1', 't2', 'baseline', questions);
  expect((await getActiveSession('u1'))?.testId).toBe('t2');
  expect(await getTestCache('t1')).toBeNull();
});

test('a session whose cached questions are gone is treated as none', async () => {
  await startSession('u1', 't1', 'baseline', questions);
  await AsyncStorage.removeItem('dmv-app:test-cache:t1');
  expect(await getActiveSession('u1')).toBeNull();
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --config jest.app.config.js src/quiz`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/quiz/answers.ts`:
```ts
import type { AnswerSubmission, QuizQuestion } from '../api/types';

/** questionId → the choice text the user picked. Unanswered questions have no entry. */
export type Answers = Record<string, string>;

/** Builds `scoreTest`'s `answers`, in question order. Unanswered questions are left out. */
export function toAnswerList(questions: QuizQuestion[], answers: Answers): AnswerSubmission[] {
  return questions
    .filter((question) => answers[question.id] !== undefined)
    .map((question) => ({ questionId: question.id, choice: answers[question.id] }));
}

export function countUnanswered(questions: QuizQuestion[], answers: Answers): number {
  return questions.filter((question) => answers[question.id] === undefined).length;
}
```

`src/quiz/quizSession.ts`:
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QuizQuestion } from '../api/types';
import { clearTestCache, getTestCache, saveTestCache } from '../study/testCache';
import type { Answers } from './answers';

// ph-3-us-1: the one in-progress test on this device, so a force-quit or lost connection
// doesn't lose it. Questions live in testCache (ph-1-us-5); this adds which test is active and
// the answers so far, written on every change. One active test per user at a time.

export type SessionKind = 'baseline' | 'practice' | 'mini-quiz';

export interface ActiveSession {
  testId: string;
  kind: SessionKind;
  questions: QuizQuestion[];
  answers: Answers;
}

interface StoredSession {
  testId: string;
  kind: SessionKind;
  answers: Answers;
}

const activeKey = (uid: string) => `dmv-app:active-test:${uid}`;

async function readStored(uid: string): Promise<StoredSession | null> {
  const raw = await AsyncStorage.getItem(activeKey(uid));
  return raw === null ? null : (JSON.parse(raw) as StoredSession);
}

/**
 * Caches the questions and marks this test active, replacing any earlier one. Rejects if the
 * write fails, so the caller can tell the user this test won't survive going offline.
 */
export async function startSession(
  uid: string,
  testId: string,
  kind: SessionKind,
  questions: QuizQuestion[]
): Promise<void> {
  const previous = await readStored(uid).catch(() => null);
  if (previous && previous.testId !== testId) await clearTestCache(previous.testId).catch(() => {});
  await saveTestCache(testId, questions);
  await AsyncStorage.setItem(activeKey(uid), JSON.stringify({ testId, kind, answers: {} }));
}

/** Saves answers for the active test. A failed write is logged, not thrown: taking the test goes on. */
export async function saveAnswers(uid: string, testId: string, answers: Answers): Promise<void> {
  try {
    const stored = await readStored(uid);
    if (stored?.testId !== testId) return;
    await AsyncStorage.setItem(activeKey(uid), JSON.stringify({ ...stored, answers }));
  } catch (error) {
    console.warn('[quizSession] saving answers failed', error);
  }
}

/** The active test with its questions, or null. A session missing its questions is dropped. */
export async function getActiveSession(uid: string): Promise<ActiveSession | null> {
  try {
    const stored = await readStored(uid);
    if (!stored) return null;
    const questions = (await getTestCache(stored.testId)) as QuizQuestion[] | null;
    if (!questions) {
      await AsyncStorage.removeItem(activeKey(uid));
      return null;
    }
    return { ...stored, questions };
  } catch (error) {
    console.warn('[quizSession] reading the active session failed', error);
    return null;
  }
}

/** Call on submit or abandon: clears the cached questions and the active marker. */
export async function endSession(uid: string, testId: string): Promise<void> {
  try {
    await clearTestCache(testId);
    const stored = await readStored(uid);
    if (stored?.testId === testId) await AsyncStorage.removeItem(activeKey(uid));
  } catch (error) {
    console.warn('[quizSession] ending the session failed', error);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest --config jest.app.config.js src/quiz`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/quiz/answers.ts src/quiz/answers.test.ts src/quiz/quizSession.ts src/quiz/quizSession.test.ts
git commit -m "feat(ph-3-us-1): persist the active test's questions and answers on the device"
```

---

### Task 4: Quiz card and quiz runner

**Files:**
- Create: `src/quiz/QuizCard.tsx`, `src/quiz/QuizRunner.tsx`, `src/quiz/QuizRunner.test.tsx`

**Interfaces:**
- Consumes: `QuizQuestion` (types.ts), `Answers`, `countUnanswered` (answers.ts), `Button`, `Card`, tokens.
- Produces:
  - `QuizCard({ question, selected, onSelect }: { question: QuizQuestion; selected: string | undefined; onSelect: (choice: string) => void })`
  - `type SubmitState = 'idle' | 'submitting' | 'waiting-for-connection' | 'error'`
  - `QuizRunner(props: QuizRunnerProps)`:
    ```ts
    interface QuizRunnerProps {
      questions: QuizQuestion[];
      /** Shown above the progress line, e.g. "Section 1 of 3". */
      title: string;
      initialAnswers?: Answers;
      onAnswersChange?: (answers: Answers) => void;
      /** Called once per submit; ignored while a submit is in flight. */
      onSubmit: (answers: Answers) => void;
      submitState: SubmitState;
      isOnline: boolean;
      /** Optional line shown at the top, e.g. a cache-write warning. */
      notice?: string;
    }
    ```
  - Visible strings tests rely on: `Question N of M`, `Next`, `Back`, `Submit`,
    `"You're offline. Keep going — your answers are saved on this phone."`,
    `"Your answers are saved. We'll submit as soon as you're back online."`,
    `"Couldn't submit. Your answers are saved."`, `Try again`, `SCENARIO`.
  - Question strip buttons have `accessibilityLabel` `Question N` (+ `, answered` when answered).
  - Unanswered warning: `Alert.alert('N unanswered', 'Unanswered questions count as wrong.', [{ text: 'Go back' }, { text: 'Submit anyway' }])`.

- [ ] **Step 1: Write the failing tests**

`src/quiz/QuizRunner.test.tsx`:
```tsx
import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { QuizQuestion } from '../api/types';
import { QuizRunner, type SubmitState } from './QuizRunner';

const questions: QuizQuestion[] = [
  { id: 'q1', text: 'First question?', choices: ['Yes', 'No'], type: 'fact', chunkId: 'c1', conceptId: 'k1' },
  { id: 'q2', text: 'At a four-way stop, who goes first?', choices: ['Left car', 'First to stop'], type: 'scenario', chunkId: 'c2', conceptId: 'k2' },
];

function setup(overrides: Partial<Parameters<typeof QuizRunner>[0]> = {}) {
  const onSubmit = jest.fn();
  const onAnswersChange = jest.fn();
  const props = {
    questions, title: 'Section 1 of 3', onSubmit, onAnswersChange,
    submitState: 'idle' as SubmitState, isOnline: true, ...overrides,
  };
  const utils = render(<QuizRunner {...props} />);
  return { ...utils, onSubmit, onAnswersChange, props };
}

beforeEach(() => jest.restoreAllMocks());

test('shows the first question with progress and no right/wrong', async () => {
  await setup();
  expect(screen.getByText('Section 1 of 3')).toBeTruthy();
  expect(screen.getByText('Question 1 of 2')).toBeTruthy();
  expect(screen.getByText('First question?')).toBeTruthy();
  expect(screen.queryByText(/correct/i)).toBeNull();
});

test('selecting, changing and keeping answers across navigation', async () => {
  const { onAnswersChange } = await setup();
  await fireEvent.press(screen.getByText('Yes'));
  await fireEvent.press(screen.getByText('No'));
  expect(onAnswersChange).toHaveBeenLastCalledWith({ q1: 'No' });

  await fireEvent.press(screen.getByText('Next'));
  expect(screen.getByText('Question 2 of 2')).toBeTruthy();
  await fireEvent.press(screen.getByText('Back'));
  expect(screen.getByRole('radio', { name: 'No', selected: true })).toBeTruthy();
});

test('the question strip jumps to any question', async () => {
  await setup();
  await fireEvent.press(screen.getByLabelText('Question 2'));
  expect(screen.getByText('At a four-way stop, who goes first?')).toBeTruthy();
});

test('scenario questions get the scenario badge', async () => {
  await setup();
  expect(screen.queryByText('SCENARIO')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Question 2'));
  expect(screen.getByText('SCENARIO')).toBeTruthy();
});

test('initialAnswers are restored', async () => {
  await setup({ initialAnswers: { q1: 'Yes' } });
  expect(screen.getByRole('radio', { name: 'Yes', selected: true })).toBeTruthy();
  expect(screen.getByLabelText('Question 1, answered')).toBeTruthy();
});

test('submitting with unanswered questions warns first; Submit anyway submits once', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const { onSubmit } = await setup({ initialAnswers: { q1: 'Yes' } });
  await fireEvent.press(screen.getByLabelText('Question 2'));
  await fireEvent.press(screen.getByText('Submit'));

  expect(alert).toHaveBeenCalledWith('1 unanswered', 'Unanswered questions count as wrong.', expect.any(Array));
  expect(onSubmit).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0][2]!;
  buttons.find((b) => b.text === 'Submit anyway')!.onPress!();
  buttons.find((b) => b.text === 'Submit anyway')!.onPress!();
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSubmit).toHaveBeenCalledWith({ q1: 'Yes' });
});

test('with everything answered, Submit submits without a warning', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const { onSubmit } = await setup({ initialAnswers: { q1: 'Yes', q2: 'Left car' } });
  await fireEvent.press(screen.getByLabelText('Question 2, answered'));
  await fireEvent.press(screen.getByText('Submit'));
  expect(alert).not.toHaveBeenCalled();
  expect(onSubmit).toHaveBeenCalledWith({ q1: 'Yes', q2: 'Left car' });
});

test('Submit is disabled while submitting', async () => {
  const { onSubmit } = await setup({
    initialAnswers: { q1: 'Yes', q2: 'Left car' }, submitState: 'submitting',
  });
  await fireEvent.press(screen.getByLabelText('Question 2, answered'));
  await fireEvent.press(screen.getByText('Submitting…'));
  expect(onSubmit).not.toHaveBeenCalled();
});

test('offline banner, waiting-for-connection and error states', async () => {
  const { rerender, props, onSubmit } = await setup({ isOnline: false });
  expect(screen.getByText("You're offline. Keep going — your answers are saved on this phone.")).toBeTruthy();

  await rerender(<QuizRunner {...props} isOnline={false} submitState="waiting-for-connection" />);
  expect(screen.getByText("Your answers are saved. We'll submit as soon as you're back online.")).toBeTruthy();

  await rerender(<QuizRunner {...props} isOnline submitState="error" initialAnswers={{ q1: 'Yes' }} />);
  expect(screen.getByText("Couldn't submit. Your answers are saved.")).toBeTruthy();
  await fireEvent.press(screen.getByText('Try again'));
  expect(onSubmit).toHaveBeenCalledTimes(1);
});
```

Note: `initialAnswers` is read once on mount, so the `rerender` with new `initialAnswers` in the
last test doesn't change answers. "Try again" submits whatever the runner holds, without a
second unanswered warning, since the user already chose to submit.

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --config jest.components.config.js src/quiz`
Expected: FAIL, cannot find `./QuizRunner`.

- [ ] **Step 3: Implement the card**

`src/quiz/QuizCard.tsx`:
```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { QuizQuestion } from '../api/types';
import { Card } from '../components/Card';
import { colors, radius, spacing, typography } from '../theme/tokens';

// ph-3-us-4: one question and its choices, with no answer reveal. Shared by the baseline,
// practice tests and mini-quizzes. Scenario questions get the badge from the Scenario question
// card mockup (ph-2-us-5).
export function QuizCard({
  question,
  selected,
  onSelect,
}: {
  question: QuizQuestion;
  selected: string | undefined;
  onSelect: (choice: string) => void;
}) {
  return (
    <Card>
      {question.type === 'scenario' && (
        <View style={styles.badge}>
          <Text style={[typography.caption, styles.badgeText]}>SCENARIO</Text>
        </View>
      )}
      <Text style={[typography.h2, styles.question]}>{question.text}</Text>
      <View accessibilityRole="radiogroup" style={styles.choices}>
        {question.choices.map((choice) => {
          const isSelected = choice === selected;
          return (
            <Pressable
              key={choice}
              onPress={() => onSelect(choice)}
              accessibilityRole="radio"
              accessibilityLabel={choice}
              accessibilityState={{ selected: isSelected }}
              style={({ pressed }) => [
                styles.choice,
                isSelected && styles.choiceSelected,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.dot, isSelected && styles.dotSelected]} />
              <Text style={[typography.body, styles.choiceText]}>{choice}</Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.secondarySoft,
    borderRadius: radius.chip,
    paddingHorizontal: spacing.space2,
    paddingVertical: 2,
  },
  badgeText: { color: colors.secondary },
  question: { lineHeight: 22 },
  choices: { gap: spacing.space2, marginTop: spacing.space2 },
  choice: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space3,
    paddingHorizontal: spacing.space3,
    paddingVertical: spacing.space3,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  choiceSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  pressed: { opacity: 0.85 },
  dot: { width: 18, height: 18, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.line },
  dotSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  choiceText: { flex: 1 },
});
```

- [ ] **Step 4: Implement the runner**

`src/quiz/QuizRunner.tsx`:
```tsx
import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { QuizQuestion } from '../api/types';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { countUnanswered, type Answers } from './answers';
import { QuizCard } from './QuizCard';

// ph-3-us-4: the shared test-taking runner. It holds answers and handles moving around and
// submitting. Each flow (baseline, practice test, mini-quiz) owns fetching, grading and what
// comes after, and tells the runner how a submit is going through `submitState`.

export type SubmitState = 'idle' | 'submitting' | 'waiting-for-connection' | 'error';

export interface QuizRunnerProps {
  questions: QuizQuestion[];
  title: string;
  initialAnswers?: Answers;
  onAnswersChange?: (answers: Answers) => void;
  onSubmit: (answers: Answers) => void;
  submitState: SubmitState;
  isOnline: boolean;
  notice?: string;
}

export function QuizRunner({
  questions,
  title,
  initialAnswers,
  onAnswersChange,
  onSubmit,
  submitState,
  isOnline,
  notice,
}: QuizRunnerProps) {
  const [answers, setAnswers] = useState<Answers>(() => initialAnswers ?? {});
  const [index, setIndex] = useState(0);
  // Guards against a double tap landing before the parent re-renders with 'submitting'.
  const submittedRef = useRef(false);
  if (submitState === 'error' || submitState === 'idle') submittedRef.current = false;

  const question = questions[index];
  const isLast = index === questions.length - 1;
  const busy = submitState === 'submitting' || submitState === 'waiting-for-connection';

  function select(choice: string) {
    const next = { ...answers, [question.id]: choice };
    setAnswers(next);
    onAnswersChange?.(next);
  }

  function submitNow() {
    if (submittedRef.current || busy) return;
    submittedRef.current = true;
    onSubmit(answers);
  }

  function requestSubmit() {
    if (busy) return;
    const unanswered = countUnanswered(questions, answers);
    if (unanswered === 0) {
      submitNow();
      return;
    }
    Alert.alert(`${unanswered} unanswered`, 'Unanswered questions count as wrong.', [
      { text: 'Go back', style: 'cancel' },
      { text: 'Submit anyway', onPress: submitNow },
    ]);
  }

  return (
    <View style={styles.screen}>
      {!isOnline && submitState !== 'waiting-for-connection' && (
        <Banner text="You're offline. Keep going — your answers are saved on this phone." />
      )}
      {submitState === 'waiting-for-connection' && (
        <Banner text="Your answers are saved. We'll submit as soon as you're back online." />
      )}
      {notice && <Banner text={notice} />}

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.caption}>{title}</Text>
        <Text style={typography.small}>
          Question {index + 1} of {questions.length}
        </Text>
        <QuestionStrip questions={questions} answers={answers} current={index} onJump={setIndex} />
        <QuizCard question={question} selected={answers[question.id]} onSelect={select} />
      </ScrollView>

      <View style={styles.bar}>
        {submitState === 'error' && (
          <View style={styles.error}>
            <Text style={[typography.small, styles.errorText]}>Couldn't submit. Your answers are saved.</Text>
            <Button label="Try again" variant="text" onPress={submitNow} />
          </View>
        )}
        <View style={styles.barButtons}>
          <Button
            label="Back"
            variant="secondary"
            disabled={index === 0}
            onPress={() => setIndex(index - 1)}
            style={styles.barButton}
          />
          {isLast ? (
            <Button
              label={submitState === 'submitting' ? 'Submitting…' : 'Submit'}
              disabled={busy}
              onPress={requestSubmit}
              style={styles.barButton}
            />
          ) : (
            <Button label="Next" onPress={() => setIndex(index + 1)} style={styles.barButton} />
          )}
        </View>
      </View>
    </View>
  );
}

function QuestionStrip({
  questions,
  answers,
  current,
  onJump,
}: {
  questions: QuizQuestion[];
  answers: Answers;
  current: number;
  onJump: (index: number) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {questions.map((q, i) => {
        const answered = answers[q.id] !== undefined;
        return (
          <Pressable
            key={q.id}
            onPress={() => onJump(i)}
            accessibilityRole="button"
            accessibilityLabel={`Question ${i + 1}${answered ? ', answered' : ''}`}
            hitSlop={4}
            style={[styles.chip, answered && styles.chipAnswered, i === current && styles.chipCurrent]}
          >
            <Text style={[typography.small, answered && styles.chipAnsweredText]}>{i + 1}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Banner({ text }: { text: string }) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={[typography.small, styles.bannerText]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.space5, gap: spacing.space3 },
  strip: { gap: spacing.space2, paddingVertical: spacing.space1 },
  chip: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAnswered: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  chipAnsweredText: { color: colors.primary },
  chipCurrent: { borderColor: colors.primary, borderWidth: 2 },
  bar: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.space4,
    gap: spacing.space2,
  },
  barButtons: { flexDirection: 'row', gap: spacing.space3 },
  barButton: { flex: 1 },
  error: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  errorText: { color: colors.alert, flex: 1 },
  banner: { backgroundColor: colors.secondarySoft, paddingHorizontal: spacing.space5, paddingVertical: spacing.space2 },
  bannerText: { color: colors.ink },
});
```

The chip is 36pt with `hitSlop={4}` (44pt touch area). If device testing shows misses, raise it
to 44pt.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest --config jest.components.config.js src/quiz`
Expected: PASS. If `getByRole('radio', { name, selected })` isn't supported by the installed
testing-library version, use
`expect(screen.getByLabelText('No').props.accessibilityState.selected).toBe(true)` instead.

- [ ] **Step 6: Typecheck and commit**

Run: `npx tsc --noEmit`
```bash
git add src/quiz/QuizCard.tsx src/quiz/QuizRunner.tsx src/quiz/QuizRunner.test.tsx
git commit -m "feat(ph-3-us-4): shared quiz card and quiz runner"
```

---

### Task 5: Baseline progress and Home's test card

**Files:**
- Create: `src/baseline/baselineProgressData.ts`, `src/baseline/baselineProgressData.test.ts`, `src/baseline/useBaselineProgress.ts`
- Modify: `src/home/HomeScreen.tsx`, `src/onboarding/onboardingFlow.test.tsx`

**Interfaces:**
- Produces:
  - ```ts
    type BaselineProgress =
      | { status: 'loading' }
      | { status: 'not-started' }
      | { status: 'in-progress'; currentSection: number; totalSections: number }
      | { status: 'complete' };
    ```
  - `toBaselineProgress(data: Record<string, unknown> | undefined): BaselineProgress` (never returns `loading`)
  - `BASELINE_TOTAL_SECTIONS = 3`
  - `useBaselineProgress(): BaselineProgress` — reads uid from `useAuth()`
- Home test card copy:
  - not-started / loading: title `Start your baseline` (existing body)
  - in-progress: title `Resume your baseline`, body `Section N of 3. Pick up where you left off.`
  - complete: title `Baseline done`, body `See how you did on each part of the handbook.`
  - All three navigate to `Baseline`.

- [ ] **Step 1: Write the failing test**

`src/baseline/baselineProgressData.test.ts`:
```ts
import { toBaselineProgress } from './baselineProgressData';

test('no doc means not started', () => {
  expect(toBaselineProgress(undefined)).toEqual({ status: 'not-started' });
});

test('a doc with completedAt is complete', () => {
  expect(toBaselineProgress({ currentSection: 3, completedAt: { seconds: 1 } })).toEqual({ status: 'complete' });
});

test('otherwise it is in progress at currentSection', () => {
  expect(toBaselineProgress({ currentSection: 2, completedAt: null })).toEqual({
    status: 'in-progress', currentSection: 2, totalSections: 3,
  });
});

test('a malformed currentSection falls back to section 1', () => {
  expect(toBaselineProgress({ currentSection: 'x', completedAt: null })).toEqual({
    status: 'in-progress', currentSection: 1, totalSections: 3,
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest --config jest.app.config.js src/baseline`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the data module and hook**

`src/baseline/baselineProgressData.ts`:
```ts
// ph-3-us-13: users/{uid}/baseline/progress as the app sees it. Written only by the
// startOrResumeBaseline and scoreTest functions; the client just reads it. No Firebase
// imports, so it runs under plain-Node Jest.

export const BASELINE_TOTAL_SECTIONS = 3;

export type BaselineProgress =
  | { status: 'loading' }
  | { status: 'not-started' }
  | { status: 'in-progress'; currentSection: number; totalSections: number }
  | { status: 'complete' };

export function toBaselineProgress(data: Record<string, unknown> | undefined): BaselineProgress {
  if (!data) return { status: 'not-started' };
  if (data.completedAt) return { status: 'complete' };
  const section = data.currentSection;
  return {
    status: 'in-progress',
    currentSection:
      typeof section === 'number' && section >= 1 && section <= BASELINE_TOTAL_SECTIONS ? section : 1,
    totalSections: BASELINE_TOTAL_SECTIONS,
  };
}
```

`src/baseline/useBaselineProgress.ts`:
```ts
import { useEffect, useState } from 'react';
import { getApp } from '@react-native-firebase/app';
import { doc, getFirestore, onSnapshot } from '@react-native-firebase/firestore';
import { useAuth } from '../auth/AuthProvider';
import { toBaselineProgress, type BaselineProgress } from './baselineProgressData';

// ph-3-us-13: live baseline progress for Home's card and the baseline screen. Firestore's
// offline cache serves the last-seen copy when there's no connection. On a read error it
// stays at the last good value (or 'loading'), and the screens fall back to their defaults.
export function useBaselineProgress(): BaselineProgress {
  const { uid } = useAuth();
  const [progress, setProgress] = useState<BaselineProgress>({ status: 'loading' });

  useEffect(() => {
    if (!uid) return;
    const ref = doc(getFirestore(getApp()), 'users', uid, 'baseline', 'progress');
    return onSnapshot(
      ref,
      (snapshot) => setProgress(toBaselineProgress(snapshot.data() as Record<string, unknown> | undefined)),
      (error) => console.warn('[baseline] progress subscription failed', error)
    );
  }, [uid]);

  return progress;
}
```

- [ ] **Step 4: Run the data test to verify it passes**

Run: `npx jest --config jest.app.config.js src/baseline`
Expected: PASS.

- [ ] **Step 5: Add the failing Home tests**

In `src/onboarding/onboardingFlow.test.tsx`, add below the existing `jest.mock` calls:
```tsx
let mockBaselineProgress: import('../baseline/baselineProgressData').BaselineProgress = {
  status: 'not-started',
};
jest.mock('../baseline/useBaselineProgress', () => ({
  useBaselineProgress: () => mockBaselineProgress,
}));
jest.mock('../api/callables', () => ({
  startOrResumeBaseline: jest.fn(() => new Promise(() => {})),
  scoreTest: jest.fn(),
}));
```
Add `mockBaselineProgress = { status: 'not-started' };` to `beforeEach`. Then add to the
`Home (ph-9-us-7 / ph-9-us-5)` describe:
```tsx
  test('the test card shows Resume with the section while the baseline is in progress', async () => {
    mockProfile = { onboarding: { choice: 'baseline' }, testDate: null };
    mockBaselineProgress = { status: 'in-progress', currentSection: 2, totalSections: 3 };
    await render(<RootNavigator initialRoute="Main" />);
    expect(await screen.findByText('Resume your baseline')).toBeTruthy();
    expect(screen.getByText('Section 2 of 3. Pick up where you left off.')).toBeTruthy();
  });

  test('the test card shows Baseline done once it is complete', async () => {
    mockProfile = { onboarding: { choice: 'baseline' }, testDate: null };
    mockBaselineProgress = { status: 'complete' };
    await render(<RootNavigator initialRoute="Main" />);
    expect(await screen.findByText('Baseline done')).toBeTruthy();
  });
```

- [ ] **Step 6: Run to verify the new tests fail**

Run: `npx jest --config jest.components.config.js src/onboarding`
Expected: the two new tests FAIL (card still says "Start your baseline"); existing tests pass.

- [ ] **Step 7: Update Home's TestCard**

In `src/home/HomeScreen.tsx`, add the import
`import { useBaselineProgress } from '../baseline/useBaselineProgress';` and replace `TestCard`
(and its comment) with:
```tsx
// ph-3-us-13: Start / Resume / Done from users/{uid}/baseline/progress. Slice 5 swaps in
// practice tests once the baseline is done.
function TestCard() {
  const navigation = useNavigation();
  const progress = useBaselineProgress();
  const open = () => navigation.navigate('Baseline');

  if (progress.status === 'in-progress') {
    return (
      <RouteCard
        icon="clipboard-outline"
        eyebrow="FIND OUT WHERE YOU STAND"
        title="Resume your baseline"
        body={`Section ${progress.currentSection} of ${progress.totalSections}. Pick up where you left off.`}
        onPress={open}
      />
    );
  }
  if (progress.status === 'complete') {
    return (
      <RouteCard
        icon="checkmark-circle-outline"
        eyebrow="BASELINE"
        title="Baseline done"
        body="See how you did on each part of the handbook."
        onPress={open}
      />
    );
  }
  return (
    <RouteCard
      icon="clipboard-outline"
      eyebrow="FIND OUT WHERE YOU STAND"
      title="Start your baseline"
      body="3 sections of about 15 minutes, based on the Colorado Driver Handbook. Pause any time."
      onPress={open}
    />
  );
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx jest --config jest.components.config.js src/onboarding && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/baseline/baselineProgressData.ts src/baseline/baselineProgressData.test.ts src/baseline/useBaselineProgress.ts src/home/HomeScreen.tsx src/onboarding/onboardingFlow.test.tsx
git commit -m "feat(ph-3-us-13): baseline progress hook and Start/Resume/Done Home card"
```

---

### Task 6: Baseline flow screen

**Files:**
- Create: `src/components/NoConnection.tsx`, `src/baseline/BaselineScreen.tsx`, `src/baseline/BaselineIntro.tsx`, `src/baseline/BaselineCheckIn.tsx`, `src/baseline/BaselineComplete.tsx`, `src/baseline/BaselineUnavailable.tsx`, `src/baseline/baselineFlow.test.tsx`
- Modify: `src/navigation/RootNavigator.tsx`, `App.tsx`, `src/onboarding/onboardingFlow.test.tsx`

**Interfaces:**
- Consumes: `startOrResumeBaseline`, `scoreTest` (Task 1), `CallableError`; `useIsOnline` (Task 2);
  `startSession`, `saveAnswers`, `getActiveSession`, `endSession`, `toAnswerList` (Task 3);
  `QuizRunner`, `SubmitState` (Task 4); `useBaselineProgress` (Task 5); `useAuth`.
- Produces: `BaselineScreen` (registered as the `Baseline` route);
  `NoConnection({ message, onRetry }: { message: string; onRetry: () => void })`.
- Visible strings tests rely on:
  - Intro: `Baseline test`, `45 questions in 3 sections of 15`, `Start section 1`
  - Runner title: `Section N of 3`
  - Check-in: `Section N done`, `Keep going`, `Take a break`
  - Complete: `Baseline done`, `You got N of 45 right.` (only when counts are known), `Back to Home`
  - Unavailable: `The baseline isn't available right now — try a practice test instead.`
  - Offline: `No connection`, `Try again`
- Analytics: `logEvent(getAnalytics(getApp()), 'baseline_unavailable', { code })` on `failed-precondition`.

Flow, as a `phase` state in `BaselineScreen`:
```ts
type Phase =
  | { kind: 'loading' }
  | { kind: 'intro' }
  | { kind: 'running'; section: BaselineSection; initialAnswers: Answers; notice?: string }
  | { kind: 'check-in'; section: number; totalSections: number }
  | { kind: 'complete'; correctCount: number | null; totalCount: number | null }
  | { kind: 'unavailable' }
  | { kind: 'offline' };
```
- On mount, once `useBaselineProgress()` is no longer `loading`: `complete` → complete (no counts);
  `not-started` → intro; `in-progress` → `load()` (resuming skips the intro).
- `load()`: `startOrResumeBaseline()`, then `getActiveSession(uid)`. If the active session has the
  same `testId`, run with its answers. Otherwise `startSession(...)` (which drops any stale one)
  and run with `{}`; if `startSession` rejects, run anyway with
  `notice: "This section can't be saved on your phone. Stay connected until you submit."`.
  Errors: `already-exists` → complete; `failed-precondition` → log + unavailable;
  `offline` → if the active session is a baseline session, run it from the cache (its `testId`
  gives the section: `baseline-{version}-{n}`), else offline; anything else → offline too, since
  the no-connection screen has a retry (logged with `console.warn`).
- `submit(answers)` (runner's `onSubmit`): a ref guard ignores re-entry. `scoreTest`. On success
  or `already-exists`: `endSession`, then `check-in` if `section < totalSections`, else
  `complete` with counts from `baselineReview` (count of `correct === true`, and length). On
  `already-exists`, counts are `null`. Offline handling is Task 7; in this task treat any other
  error as `submitState = 'error'`.
- "Keep going" → `load()`. "Take a break" and "Back to Home" →
  `navigation.navigate('Main', { screen: 'Home' })`.

- [ ] **Step 1: Write the failing flow tests**

`src/baseline/baselineFlow.test.tsx`:
```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { logEvent } from '@react-native-firebase/analytics';
import { startOrResumeBaseline, scoreTest } from '../api/callables';
import { CallableError } from '../api/callableErrors';
import type { BaselineSection, QuizQuestion, ScoreTestResult } from '../api/types';
import { getActiveSession, saveAnswers, startSession } from '../quiz/quizSession';
import type { BaselineProgress } from './baselineProgressData';
import { BaselineScreen } from './BaselineScreen';
import { Text } from 'react-native';

jest.mock('@react-native-firebase/app', () => ({ getApp: jest.fn() }));
jest.mock('@react-native-firebase/analytics', () => ({ getAnalytics: jest.fn(), logEvent: jest.fn() }));
jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ status: 'ready', uid: 'u1' }) }));
jest.mock('../api/callables', () => ({ startOrResumeBaseline: jest.fn(), scoreTest: jest.fn() }));
let mockProgress: BaselineProgress = { status: 'not-started' };
jest.mock('./useBaselineProgress', () => ({ useBaselineProgress: () => mockProgress }));
let mockOnline = true;
jest.mock('../network/useIsOnline', () => ({ useIsOnline: () => mockOnline }));

const mockStart = startOrResumeBaseline as jest.Mock;
const mockScore = scoreTest as jest.Mock;

const question = (n: number): QuizQuestion => ({
  id: `q${n}`, text: `Question text ${n}`, choices: [`A${n}`, `B${n}`], type: 'fact', chunkId: `c${n}`, conceptId: `k${n}`,
});
const sectionOf = (n: number): BaselineSection => ({
  testId: `baseline-v1-${n}`, version: 'v1', section: n, totalSections: 3,
  questions: [question(n * 10 + 1), question(n * 10 + 2)],
});
const graded = (n: number, extra: Partial<ScoreTestResult> = {}): ScoreTestResult => ({
  testId: `baseline-v1-${n}`, type: 'baseline', score: 0.5, correctCount: 1, totalCount: 2,
  perTopic: [], perQuestion: [], recommendation: null, ...extra,
});

// A two-screen stack so "Take a break" and Back have somewhere to go. Main sits under
// Baseline, as it does in the app.
const Stack = createNativeStackNavigator();
const navRef = createNavigationContainerRef();
function flowTree() {
  return (
    <NavigationContainer ref={navRef}>
      <Stack.Navigator initialRouteName="Main">
        <Stack.Screen name="Main">{() => <Text>Home screen</Text>}</Stack.Screen>
        <Stack.Screen name="Baseline" component={BaselineScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
async function renderFlow() {
  const view = await render(flowTree());
  await act(() => navRef.navigate('Baseline' as never));
  return view;
}

async function answerAllAndSubmit(n: number) {
  await fireEvent.press(screen.getByText(`A${n * 10 + 1}`));
  await fireEvent.press(screen.getByText('Next'));
  await fireEvent.press(screen.getByText(`A${n * 10 + 2}`));
  await fireEvent.press(screen.getByText('Submit'));
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockProgress = { status: 'not-started' };
  mockOnline = true;
});

test('first time: intro, then section 1 in the runner', async () => {
  mockStart.mockResolvedValueOnce(sectionOf(1));
  await renderFlow();
  expect(await screen.findByText('45 questions in 3 sections of 15')).toBeTruthy();
  await fireEvent.press(screen.getByText('Start section 1'));
  expect(await screen.findByText('Section 1 of 3')).toBeTruthy();
  expect(screen.getByText('Question text 11')).toBeTruthy();
  expect((await getActiveSession('u1'))?.testId).toBe('baseline-v1-1');
});

test('section 1 submit shows the check-in with no score; Keep going loads section 2', async () => {
  mockStart.mockResolvedValueOnce(sectionOf(1)).mockResolvedValueOnce(sectionOf(2));
  mockScore.mockResolvedValueOnce(graded(1));
  await renderFlow();
  await fireEvent.press(await screen.findByText('Start section 1'));
  await screen.findByText('Section 1 of 3');
  await answerAllAndSubmit(1);

  expect(await screen.findByText('Section 1 done')).toBeTruthy();
  expect(screen.queryByText(/of 2|50%|1 of/)).toBeNull();
  expect(mockScore).toHaveBeenCalledWith({
    testId: 'baseline-v1-1',
    answers: [{ questionId: 'q11', choice: 'A11' }, { questionId: 'q12', choice: 'A12' }],
  });
  expect(await getActiveSession('u1')).toBeNull();

  await fireEvent.press(screen.getByText('Keep going'));
  expect(await screen.findByText('Section 2 of 3')).toBeTruthy();
});

test('Take a break goes back to Home', async () => {
  mockStart.mockResolvedValueOnce(sectionOf(1));
  mockScore.mockResolvedValueOnce(graded(1));
  await renderFlow();
  await fireEvent.press(await screen.findByText('Start section 1'));
  await screen.findByText('Section 1 of 3');
  await answerAllAndSubmit(1);
  await fireEvent.press(await screen.findByText('Take a break'));
  expect(await screen.findByText('Home screen')).toBeTruthy();
});

test('in progress: skips the intro and restores saved answers for the same section', async () => {
  mockProgress = { status: 'in-progress', currentSection: 2, totalSections: 3 };
  await startSession('u1', 'baseline-v1-2', 'baseline', sectionOf(2).questions);
  await saveAnswers('u1', 'baseline-v1-2', { q21: 'B21' });
  mockStart.mockResolvedValueOnce(sectionOf(2));

  await renderFlow();
  expect(await screen.findByText('Section 2 of 3')).toBeTruthy();
  expect(screen.queryByText('Start section 1')).toBeNull();
  expect(screen.getByLabelText('Question 1, answered')).toBeTruthy();
});

test('a stale session for another section is discarded', async () => {
  mockProgress = { status: 'in-progress', currentSection: 3, totalSections: 3 };
  await startSession('u1', 'baseline-v1-2', 'baseline', sectionOf(2).questions);
  await saveAnswers('u1', 'baseline-v1-2', { q21: 'B21' });
  mockStart.mockResolvedValueOnce(sectionOf(3));

  await renderFlow();
  expect(await screen.findByText('Section 3 of 3')).toBeTruthy();
  expect(screen.getByLabelText('Question 1')).toBeTruthy();
  expect((await getActiveSession('u1'))?.testId).toBe('baseline-v1-3');
});

test('section 3 submit goes to the complete screen with the total from baselineReview', async () => {
  mockProgress = { status: 'in-progress', currentSection: 3, totalSections: 3 };
  mockStart.mockResolvedValueOnce(sectionOf(3));
  const review = Array.from({ length: 45 }, (_, i) => ({
    questionId: `r${i}`, chunkId: 'c', choice: 'x', correctAnswer: 'x', correct: i < 30,
  }));
  mockScore.mockResolvedValueOnce(graded(3, { baselineReview: review }));

  await renderFlow();
  await screen.findByText('Section 3 of 3');
  await answerAllAndSubmit(3);
  expect(await screen.findByText('Baseline done')).toBeTruthy();
  expect(screen.getByText('You got 30 of 45 right.')).toBeTruthy();
});

test('complete progress opens straight to the complete screen', async () => {
  mockProgress = { status: 'complete' };
  await renderFlow();
  expect(await screen.findByText('Baseline done')).toBeTruthy();
  expect(mockStart).not.toHaveBeenCalled();
});

test('already-exists from startOrResumeBaseline shows complete, not an error', async () => {
  mockProgress = { status: 'in-progress', currentSection: 3, totalSections: 3 };
  mockStart.mockRejectedValueOnce(new CallableError('already-exists', 'already-exists', 'done'));
  await renderFlow();
  expect(await screen.findByText('Baseline done')).toBeTruthy();
});

test('already-exists from scoreTest moves on to the check-in', async () => {
  mockStart.mockResolvedValueOnce(sectionOf(1));
  mockScore.mockRejectedValueOnce(new CallableError('already-exists', 'already-exists', 'scored'));
  await renderFlow();
  await fireEvent.press(await screen.findByText('Start section 1'));
  await screen.findByText('Section 1 of 3');
  await answerAllAndSubmit(1);
  expect(await screen.findByText('Section 1 done')).toBeTruthy();
});

test('failed-precondition shows the unavailable message and logs it', async () => {
  mockStart.mockRejectedValueOnce(new CallableError('failed-precondition', 'failed-precondition', 'not published'));
  await renderFlow();
  await fireEvent.press(await screen.findByText('Start section 1'));
  expect(await screen.findByText("The baseline isn't available right now — try a practice test instead.")).toBeTruthy();
  expect(logEvent).toHaveBeenCalledWith(undefined, 'baseline_unavailable', { code: 'failed-precondition' });
});

test('offline with nothing cached shows No connection; Try again retries', async () => {
  mockStart
    .mockRejectedValueOnce(new CallableError('offline', 'unavailable', 'offline'))
    .mockResolvedValueOnce(sectionOf(1));
  await renderFlow();
  await fireEvent.press(await screen.findByText('Start section 1'));
  expect(await screen.findByText('No connection')).toBeTruthy();
  await fireEvent.press(screen.getByText('Try again'));
  expect(await screen.findByText('Section 1 of 3')).toBeTruthy();
});

test('double-tapping Submit calls scoreTest once', async () => {
  mockStart.mockResolvedValueOnce(sectionOf(1));
  let resolve!: (r: ScoreTestResult) => void;
  mockScore.mockReturnValueOnce(new Promise((r) => (resolve = r)));
  await renderFlow();
  await fireEvent.press(await screen.findByText('Start section 1'));
  await screen.findByText('Section 1 of 3');
  await answerAllAndSubmit(1);
  await fireEvent.press(screen.getByText('Submitting…'));
  resolve(graded(1));
  await screen.findByText('Section 1 done');
  expect(mockScore).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --config jest.components.config.js src/baseline`
Expected: FAIL, cannot find `./BaselineScreen`.

- [ ] **Step 3: Extract the no-connection state**

`src/components/NoConnection.tsx`:
```tsx
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';
import { Button } from './Button';

// The standard "No connection" state with a retry, shared by app start (App.tsx) and screens
// that need the network.
export function NoConnection({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={typography.h1}>No connection</Text>
      <Text style={[typography.body, styles.message]}>{message}</Text>
      <Button label="Try again" onPress={onRetry} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.space5,
    gap: spacing.space2,
  },
  message: { textAlign: 'center', color: colors.inkSoft },
  button: { marginTop: spacing.space5, paddingHorizontal: spacing.space6 },
});
```
In `App.tsx`, replace the local `NoConnectionScreen` function with
`<NoConnection message="DMV Prep needs a connection the first time you open it. Check your connection and try again." onRetry={retry} />`,
import it from `./src/components/NoConnection`, and remove `Pressable`, `radius` and the
now-unused `button` / `buttonText` styles.

- [ ] **Step 4: Write the presentational screens**

`src/baseline/BaselineIntro.tsx`:
```tsx
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { colors, spacing, typography } from '../theme/tokens';

// ph-3-us-13: shown once, before section 1. Resuming goes straight into the section.
const POINTS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'list-outline', text: '45 questions in 3 sections of 15' },
  { icon: 'book-outline', text: 'One question for each part of the Colorado Driver Handbook' },
  { icon: 'pause-circle-outline', text: 'Take a break between sections. We save your place.' },
  { icon: 'flag-outline', text: "It's a starting point, not a pass or fail" },
];

export function BaselineIntro({ onStart, starting }: { onStart: () => void; starting: boolean }) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={typography.caption}>FIND OUT WHERE YOU STAND</Text>
      <Text style={typography.h1}>Baseline test</Text>
      <View style={styles.points}>
        {POINTS.map((point) => (
          <View key={point.text} style={styles.point}>
            <Ionicons name={point.icon} size={22} color={colors.primary} />
            <Text style={[typography.body, styles.pointText]}>{point.text}</Text>
          </View>
        ))}
      </View>
      <Button label="Start section 1" onPress={onStart} disabled={starting} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.space5, gap: spacing.space4 },
  points: { gap: spacing.space3, marginVertical: spacing.space2 },
  point: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  pointText: { flex: 1 },
});
```

`src/baseline/BaselineCheckIn.tsx`:
```tsx
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../theme/tokens';

// ph-3-us-13: the break point after sections 1 and 2. No score, and the two choices get equal
// weight: it isn't a nudge to continue.
export function BaselineCheckIn({
  section,
  totalSections,
  onKeepGoing,
  onTakeBreak,
}: {
  section: number;
  totalSections: number;
  onKeepGoing: () => void;
  onTakeBreak: () => void;
}) {
  return (
    <View style={styles.container}>
      <View
        style={styles.dots}
        accessible
        accessibilityLabel={`${section} of ${totalSections} sections done`}
      >
        {Array.from({ length: totalSections }, (_, i) => (
          <View key={i} style={[styles.dot, i < section && styles.dotDone]} />
        ))}
      </View>
      <Text style={typography.h1}>Section {section} done</Text>
      <Text style={[typography.body, styles.body]}>
        Nice work. Keep going, or take a break. We've saved your place.
      </Text>
      <View style={styles.buttons}>
        <Button label="Keep going" variant="secondary" onPress={onKeepGoing} style={styles.button} />
        <Button label="Take a break" variant="secondary" onPress={onTakeBreak} style={styles.button} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.space5,
    gap: spacing.space3,
  },
  dots: { flexDirection: 'row', gap: spacing.space2, marginBottom: spacing.space2 },
  dot: { width: 14, height: 14, borderRadius: radius.pill, backgroundColor: colors.line },
  dotDone: { backgroundColor: colors.primary },
  body: { textAlign: 'center', color: colors.inkSoft },
  buttons: { flexDirection: 'row', gap: spacing.space3, marginTop: spacing.space4, alignSelf: 'stretch' },
  button: { flex: 1 },
});
```

`src/baseline/BaselineComplete.tsx`:
```tsx
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, spacing, typography } from '../theme/tokens';

// ph-3-us-13: minimal placeholder for the baseline results screen (ph-4-us-6, Slice 3).
export function BaselineComplete({
  correctCount,
  totalCount,
  onDone,
}: {
  correctCount: number | null;
  totalCount: number | null;
  onDone: () => void;
}) {
  return (
    <View style={styles.container}>
      <Text style={typography.h1}>Baseline done</Text>
      {correctCount !== null && totalCount !== null && (
        <Text style={typography.stat}>You got {correctCount} of {totalCount} right.</Text>
      )}
      <Text style={[typography.body, styles.body]}>
        Your results for each part of the handbook arrive in the next build.
      </Text>
      <Button label="Back to Home" onPress={onDone} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.space5,
    gap: spacing.space3,
  },
  body: { textAlign: 'center', color: colors.inkSoft },
  button: { marginTop: spacing.space4, alignSelf: 'stretch' },
});
```

`src/baseline/BaselineUnavailable.tsx`:
```tsx
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, spacing, typography } from '../theme/tokens';

// ph-3-us-13: the baseline isn't published, or references a deleted question. A content
// problem on our side, not the user's. Practice tests arrive in Slice 5.
export function BaselineUnavailable({ onDone }: { onDone: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={[typography.body, styles.body]}>
        The baseline isn't available right now — try a practice test instead.
      </Text>
      <Button label="Back to Home" variant="secondary" onPress={onDone} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.space5,
    gap: spacing.space3,
  },
  body: { textAlign: 'center' },
  button: { alignSelf: 'stretch' },
});
```

- [ ] **Step 5: Write the flow screen**

`src/baseline/BaselineScreen.tsx`:
```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getApp } from '@react-native-firebase/app';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import { scoreTest, startOrResumeBaseline } from '../api/callables';
import { toCallableError } from '../api/callableErrors';
import type { BaselineSection } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { NoConnection } from '../components/NoConnection';
import { useIsOnline } from '../network/useIsOnline';
import { toAnswerList, type Answers } from '../quiz/answers';
import { QuizRunner, type SubmitState } from '../quiz/QuizRunner';
import { endSession, getActiveSession, saveAnswers, startSession } from '../quiz/quizSession';
import { colors } from '../theme/tokens';
import { BaselineCheckIn } from './BaselineCheckIn';
import { BaselineComplete } from './BaselineComplete';
import { BaselineIntro } from './BaselineIntro';
import { BaselineUnavailable } from './BaselineUnavailable';
import { useBaselineProgress } from './useBaselineProgress';

// ph-3-us-13 / ph-3-us-1: the baseline, one section at a time. The server holds which section
// the user is on (users/{uid}/baseline/progress); this device holds the current section's
// questions and answers (quizSession), so a force-quit or lost connection doesn't lose them.

type Phase =
  | { kind: 'loading' }
  | { kind: 'intro' }
  | { kind: 'running'; section: BaselineSection; initialAnswers: Answers; notice?: string }
  | { kind: 'check-in'; section: number; totalSections: number }
  | { kind: 'complete'; correctCount: number | null; totalCount: number | null }
  | { kind: 'unavailable' }
  | { kind: 'offline' };

const CACHE_WARNING = "This section can't be saved on your phone. Stay connected until you submit.";

/** `baseline-v1-2` → 2. The format is set by startOrResumeBaseline (functions/README.md). */
function sectionFromTestId(testId: string): number {
  return Number(testId.split('-').pop()) || 1;
}

export function BaselineScreen() {
  const navigation = useNavigation();
  const { uid } = useAuth();
  const progress = useBaselineProgress();
  const isOnline = useIsOnline();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const decidedRef = useRef(false);
  const submittingRef = useRef(false);

  const goHome = useCallback(() => navigation.navigate('Main', { screen: 'Home' }), [navigation]);

  const load = useCallback(async () => {
    if (!uid) return;
    setPhase({ kind: 'loading' });
    setSubmitState('idle');
    try {
      const section = await startOrResumeBaseline();
      const active = await getActiveSession(uid);
      if (active?.testId === section.testId) {
        setPhase({ kind: 'running', section, initialAnswers: active.answers });
        return;
      }
      let notice: string | undefined;
      try {
        await startSession(uid, section.testId, 'baseline', section.questions);
      } catch (error) {
        console.warn('[baseline] caching the section failed', error);
        notice = CACHE_WARNING;
      }
      setPhase({ kind: 'running', section, initialAnswers: {}, notice });
    } catch (raw) {
      const error = toCallableError(raw);
      if (error.kind === 'already-exists') {
        setPhase({ kind: 'complete', correctCount: null, totalCount: null });
      } else if (error.kind === 'failed-precondition') {
        console.warn('[baseline] unavailable', error.message);
        void logEvent(getAnalytics(getApp()), 'baseline_unavailable' as never, { code: error.code });
        setPhase({ kind: 'unavailable' });
      } else {
        if (error.kind !== 'offline') console.warn('[baseline] start failed', error);
        const active = await getActiveSession(uid);
        if (active?.kind === 'baseline') {
          // Offline, but this section's questions are on the phone: keep going from the cache.
          const section: BaselineSection = {
            testId: active.testId,
            version: active.testId.split('-')[1] ?? 'v1',
            section: sectionFromTestId(active.testId),
            totalSections: 3,
            questions: active.questions,
          };
          setPhase({ kind: 'running', section, initialAnswers: active.answers });
        } else {
          setPhase({ kind: 'offline' });
        }
      }
    }
  }, [uid]);

  // Decide the first phase once progress has loaded. Later progress updates (e.g. scoreTest
  // advancing the section) don't move the user; the flow drives itself from there.
  useEffect(() => {
    if (decidedRef.current || progress.status === 'loading') return;
    decidedRef.current = true;
    if (progress.status === 'complete') setPhase({ kind: 'complete', correctCount: null, totalCount: null });
    else if (progress.status === 'not-started') setPhase({ kind: 'intro' });
    else void load();
  }, [progress, load]);

  const submit = useCallback(
    async (answers: Answers) => {
      if (phase.kind !== 'running' || !uid || submittingRef.current) return;
      submittingRef.current = true;
      const { section } = phase;
      setSubmitState('submitting');
      let counts: { correctCount: number | null; totalCount: number | null } = {
        correctCount: null,
        totalCount: null,
      };
      try {
        const result = await scoreTest({
          testId: section.testId,
          answers: toAnswerList(section.questions, answers),
        });
        if (result.baselineReview) {
          counts = {
            correctCount: result.baselineReview.filter((q) => q.correct === true).length,
            totalCount: result.baselineReview.length,
          };
        }
      } catch (raw) {
        const error = toCallableError(raw);
        if (error.kind !== 'already-exists') {
          console.warn('[baseline] submit failed', error);
          setSubmitState('error');
          submittingRef.current = false;
          return;
        }
        // Already graded (e.g. the response was lost on a retry): move on.
      }
      await endSession(uid, section.testId);
      submittingRef.current = false;
      setSubmitState('idle');
      if (section.section < section.totalSections) {
        setPhase({ kind: 'check-in', section: section.section, totalSections: section.totalSections });
      } else {
        setPhase({ kind: 'complete', ...counts });
      }
    },
    [phase, uid]
  );

  switch (phase.kind) {
    case 'loading':
      return <View style={styles.blank} />;
    case 'intro':
      return <BaselineIntro onStart={() => void load()} starting={false} />;
    case 'running':
      return (
        <QuizRunner
          key={phase.section.testId}
          questions={phase.section.questions}
          title={`Section ${phase.section.section} of ${phase.section.totalSections}`}
          initialAnswers={phase.initialAnswers}
          onAnswersChange={(answers) => uid && void saveAnswers(uid, phase.section.testId, answers)}
          onSubmit={(answers) => void submit(answers)}
          submitState={submitState}
          isOnline={isOnline}
          notice={phase.notice}
        />
      );
    case 'check-in':
      return (
        <BaselineCheckIn
          section={phase.section}
          totalSections={phase.totalSections}
          onKeepGoing={() => void load()}
          onTakeBreak={goHome}
        />
      );
    case 'complete':
      return (
        <BaselineComplete correctCount={phase.correctCount} totalCount={phase.totalCount} onDone={goHome} />
      );
    case 'unavailable':
      return <BaselineUnavailable onDone={goHome} />;
    case 'offline':
      return (
        <NoConnection
          message="The baseline needs a connection to load. Check your connection and try again."
          onRetry={() => void load()}
        />
      );
  }
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.background },
});
```

- [ ] **Step 6: Register the route and update the onboarding test**

In `src/navigation/RootNavigator.tsx`: import `BaselineScreen` from `../baseline/BaselineScreen`,
delete `BaselinePlaceholder`, and change the `Baseline` screen's `component` to `BaselineScreen`.
In `src/navigation/types.ts`, change the `Baseline` comment to
`/** The baseline flow (ph-3-us-13). */`.

In `src/onboarding/onboardingFlow.test.tsx`, the Slice 1 tests look for the placeholder's
"Baseline test" heading. The intro shows the same heading, so they keep passing once
`useBaselineProgress` is mocked as `not-started` (Task 5 did this). Also add
`jest.mock('../network/useIsOnline', () => ({ useIsOnline: () => true }));`.

- [ ] **Step 7: Run all component tests**

Run: `npm run test:components`
Expected: PASS (quiz, baseline, onboarding, CalendarPicker).

- [ ] **Step 8: Typecheck and commit**

Run: `npx tsc --noEmit`
```bash
git add src/components/NoConnection.tsx src/baseline src/navigation App.tsx src/onboarding/onboardingFlow.test.tsx
git commit -m "feat(ph-3-us-13): baseline flow with intro, sections, check-in, resume and placeholder results"
```

---

### Task 7: Hold answers offline, submit on reconnect, confirm leaving

**Files:**
- Modify: `src/baseline/BaselineScreen.tsx`, `src/baseline/baselineFlow.test.tsx`

**Interfaces:**
- Consumes: everything from Task 6.
- Behavior added:
  - Submitting while `useIsOnline()` is `false`, or `scoreTest` failing with `offline`, sets
    `submitState = 'waiting-for-connection'` and keeps the answers in a ref. When `isOnline`
    becomes `true`, the held answers are submitted once.
  - Leaving mid-section (header back, Android back) asks
    `Alert.alert('Take a break?', 'Your answers are saved on this phone. Pick up where you left off any time.', [{ text: 'Stay', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress }])`
    via `usePreventRemove` from `@react-navigation/native`. Leaving keeps the session.

- [ ] **Step 1: Write the failing tests**

Append to `src/baseline/baselineFlow.test.tsx`:
```tsx
test('offline at submit: answers are held, then submitted automatically when the connection returns', async () => {
  mockStart.mockResolvedValueOnce(sectionOf(1));
  mockScore.mockResolvedValueOnce(graded(1));
  const view = await renderFlow();
  await fireEvent.press(await screen.findByText('Start section 1'));
  await screen.findByText('Section 1 of 3');

  mockOnline = false;
  await view.rerender(flowTree());
  await answerAllAndSubmit(1);
  expect(await screen.findByText("Your answers are saved. We'll submit as soon as you're back online.")).toBeTruthy();
  expect(mockScore).not.toHaveBeenCalled();

  mockOnline = true;
  await view.rerender(flowTree());
  expect(await screen.findByText('Section 1 done')).toBeTruthy();
  expect(mockScore).toHaveBeenCalledTimes(1);
});

test('scoreTest failing as offline also holds the answers', async () => {
  mockStart.mockResolvedValueOnce(sectionOf(1));
  mockScore.mockRejectedValueOnce(new CallableError('offline', 'unavailable', 'offline'));
  await renderFlow();
  await fireEvent.press(await screen.findByText('Start section 1'));
  await screen.findByText('Section 1 of 3');
  await answerAllAndSubmit(1);
  expect(await screen.findByText("Your answers are saved. We'll submit as soon as you're back online.")).toBeTruthy();
  expect((await getActiveSession('u1'))?.answers).toEqual({ q11: 'A11', q12: 'A12' });
});

test('offline on reopen with a cached section: keeps going from the cache', async () => {
  mockProgress = { status: 'in-progress', currentSection: 2, totalSections: 3 };
  await startSession('u1', 'baseline-v1-2', 'baseline', sectionOf(2).questions);
  await saveAnswers('u1', 'baseline-v1-2', { q21: 'A21' });
  mockStart.mockRejectedValueOnce(new CallableError('offline', 'unavailable', 'offline'));
  await renderFlow();
  expect(await screen.findByText('Section 2 of 3')).toBeTruthy();
  expect(screen.getByLabelText('Question 1, answered')).toBeTruthy();
});

test('leaving mid-section asks first, and leaving keeps the session', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  mockStart.mockResolvedValueOnce(sectionOf(1));
  await renderFlow();
  await fireEvent.press(await screen.findByText('Start section 1'));
  await screen.findByText('Section 1 of 3');
  await fireEvent.press(screen.getByText('A11'));

  // Same path as the header's back button and Android back: a goBack that usePreventRemove sees.
  await act(() => navRef.goBack());
  await waitFor(() =>
    expect(alert).toHaveBeenCalledWith('Take a break?', expect.any(String), expect.any(Array))
  );
  expect(screen.getByText('Section 1 of 3')).toBeTruthy();

  await act(() => alert.mock.calls[0][2]!.find((b) => b.text === 'Leave')!.onPress!());
  expect(await screen.findByText('Home screen')).toBeTruthy();
  expect((await getActiveSession('u1'))?.answers).toEqual({ q11: 'A11' });
});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx jest --config jest.components.config.js src/baseline`
Expected: the four new tests FAIL (no waiting state, no leave prompt). The cache test may
already pass from Task 6's offline fallback. That's fine; keep it as a regression test.

- [ ] **Step 3: Implement holding and auto-submit**

In `BaselineScreen.tsx`:
- Import `usePreventRemove` from `@react-navigation/native` and `Alert` from `react-native`.
- Add `const heldAnswersRef = useRef<Answers | null>(null);`.
- At the top of `submit`, after the guard checks and before `setSubmitState('submitting')`:
  ```ts
      if (!isOnline) {
        heldAnswersRef.current = answers;
        setSubmitState('waiting-for-connection');
        return;
      }
  ```
  Add `isOnline` to `submit`'s dependency list.
- In the `catch`, before the `already-exists` check:
  ```ts
        if (error.kind === 'offline') {
          heldAnswersRef.current = answers;
          setSubmitState('waiting-for-connection');
          submittingRef.current = false;
          return;
        }
  ```
- Clear `heldAnswersRef.current = null` right after a successful or `already-exists` grading.
- Add the reconnect effect:
  ```ts
  // ph-3-us-1: answers held while offline go out once the connection is back.
  useEffect(() => {
    if (isOnline && submitState === 'waiting-for-connection' && heldAnswersRef.current) {
      const answers = heldAnswersRef.current;
      heldAnswersRef.current = null;
      void submit(answers);
    }
  }, [isOnline, submitState, submit]);
  ```
  `submit` sets `submitState` back to `'submitting'`, so the effect can't fire twice for one
  hold. The `submittingRef` guard covers the rest.

Note that the answers stay in `quizSession` the whole time (the session only ends after
grading), so a force-quit while waiting is covered by the resume path.

- [ ] **Step 4: Implement the leave confirmation**

In `BaselineScreen`, after the `useState` hooks:
```ts
  // ph-3-us-4: leaving mid-section asks first. Leaving keeps the section on the phone, so it
  // resumes next time.
  usePreventRemove(phase.kind === 'running' && submitState !== 'submitting', ({ data }) => {
    Alert.alert('Take a break?', 'Your answers are saved on this phone. Pick up where you left off any time.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });
```
The check-in's "Take a break" is not affected, because `phase.kind` is `check-in` by then.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:components`
Expected: all PASS.

- [ ] **Step 6: Typecheck and commit**

Run: `npx tsc --noEmit`
```bash
git add src/baseline
git commit -m "feat(ph-3-us-1): hold baseline answers offline, submit on reconnect, confirm leaving mid-section"
```

---

### Task 8: Rebuild, deploy, device test, and close out the docs

**Files:**
- Modify: story files for ph-3-us-4, ph-3-us-13, ph-3-us-1, ph-3-us-12; `docs/build-order.md`; `docs/phases.md` (if it tracks status); `functions/README.md` ("Local development" deploy note); `CLAUDE.md` (test commands, if missing); `docs/history/LOG.md`

- [ ] **Step 1: Full test and type pass**

Run: `npm run test:app && npm run test:components && npx tsc --noEmit`
Expected: all PASS. Paste the counts into the log entry.

- [ ] **Step 2: Rebuild the Android dev client**

Run: `npx expo run:android` (the emulator must be running; see `docs/android-emulator-setup.md`).
Expected: build succeeds and the app opens. It must be a fresh native build because
`@react-native-firebase/functions` and NetInfo are native modules. A JS reload is not enough.

- [ ] **Step 3: Confirm the prerequisites**

- Functions deployed to dev (see Prerequisites).
- `topics` published, and `baselineTests/v1` published: `npm run qb:validate-baseline -- v1` prints
  "all questions still approved".

- [ ] **Step 4: Device test (the Slice 2 script from build-order.md)**

On the emulator with a fresh install (clear app data):
1. Onboarding → "Test what I know" → Skip → intro → Start section 1.
2. Answer a few questions → force-quit (swipe away) → reopen → Home card says "Resume your
   baseline — Section 1 of 3" → open → same answers are there.
3. Turn on airplane mode → answer more → offline banner shows → finish and Submit → "we'll submit
   as soon as you're back online" → turn airplane mode off → check-in appears.
4. "Take a break" → Home card says Resume, section 2 → come back → finish sections 2 and 3 →
   "Baseline done" with N of 45.
5. Home card now says "Baseline done".
6. Back button mid-section → "Take a break?" prompt → Leave → Home.

- [ ] **Step 5: Update the docs**

- Mark ph-3-us-4, ph-3-us-13, ph-3-us-1 and parent ph-3-us-12 **Complete**, and tick their
  criteria. Note on ph-3-us-4 that the Practice-tab criteria and the `assembleTest` flow moved
  to Slice 5 (ph-4-us-1 / ph-3-us-3), with the wrappers already in `src/api/callables.ts`. Note
  on ph-3-us-1 that the launch "Resume / Discard" prompt is deferred to practice tests, and that
  cached answers don't expire (decision 2026-09-25).
- `docs/build-order.md`: Slice 2 **Status: Complete (date)** with what was device-tested.
- `functions/README.md` "Local development": replace "Deployment isn't wired up yet" with the
  deploy command, the `FUNCTIONS_DISCOVERY_TIMEOUT=90` note, and the Node 20 decommission date
  (2026-10-30).
- `docs/history/LOG.md`: one entry via the project-history skill.

- [ ] **Step 6: Commit**

```bash
git add docs functions/README.md CLAUDE.md
git commit -m "docs: close Slice 2 (baseline) stories and record deploy steps"
```

---

## Open question (for the user)

**The baseline can't be published yet: only 21 of 45 topics have an approved question on dev.**
Code tasks 1–7 don't depend on this, but step 4 of Task 8 (device testing) does. The options:
1. Review more pending questions until each of the 45 topics has at least one approved, then
   hand-pick the selection. This is the real fix and has to happen before beta anyway.
2. Publish a temporary dev-only version (e.g. `baselineTests/dev-v1`) with whatever's available,
   to test the flow now. `build-baseline` requires exactly 45 topic entries, so this needs a
   script change and a `CURRENT_BASELINE_VERSION` switch. It isn't recommended: it's throwaway
   work, and it risks shipping the wrong version.
