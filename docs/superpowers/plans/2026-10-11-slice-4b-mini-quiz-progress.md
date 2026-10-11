# Slice 4b — Mini-quiz, Recommendation and Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A teen takes a topic-sized mini-quiz from the flashcards, sees what they missed and a
recommendation, picks Review Again / Come Back Later / Mark Reviewed, gets a missed-only deck
when they come back to the topic, and sees every topic as strong / shaky / likely gap on the
Progress tab.

**Architecture:** Two small backend changes (`assembleMiniQuiz` sizes the quiz from the topic's
pool; `scoreTest` also saves correct/total on Concept Progress). On the app, pure Node-tested
modules (card performance, deck passes, mini-quiz helpers, concept strength) are wrapped by thin
AsyncStorage/Firebase layers and three screens: a reworked `FlashcardScreen`, a new
`MiniQuizScreen` (loading → running → results, on the shared `QuizRunner`) and a new
`ConceptReportScreen` on the Progress tab.

**Tech Stack:** Firebase Cloud Functions v2 + Admin SDK on Node 22 (Jest against the Firestore
emulator, `npm run test:functions`), Firestore rules (`npm run test:rules`), Expo SDK 57, React
Navigation 7 (`popTo`, `CommonActions.reset`), `@react-native-firebase/firestore` / `functions`
modular API, AsyncStorage, Jest (`test:app` = Node ts-jest for `*.test.ts`, `test:components` =
jest-expo for `*.test.tsx`).

**Spec:** `docs/superpowers/specs/2026-10-11-slice-4b-mini-quiz-progress-design.md`, and the
stories it points to under `docs/phases/phase-2-flashcard-study-mode/` (ph-2-us-4, 6, 8, 9; parent
ph-2-us-10 holds the status table) and `docs/phases/phase-4-scoring-and-review/ph-4-us-6-per-concept-report.md`
(strength rule). Backend contract: `functions/README.md`.

## Decisions made while planning (flag to the user at review)

- **"Move on" highlights Mark Reviewed**, not Come Back Later (Come Back Later sets *needs
  revisit*, which contradicts a passing score). `review-again` highlights Review Again.
- **Component tests pin `Math.random` to 0.999**, which makes Fisher–Yates and the weighted
  shuffle keep input order (weak cards still sort first). No random-source prop on screens.
- **The cache-only empty snapshot** (4a carry-forward) is handled with
  `includeMetadataChanges: true` and a `cachedEmpty` flag on `useConceptProgress`'s ready state.
  Screens don't call `markOpened` while it's true, but still render (an offline new user isn't
  stuck loading).
- **`recordQuizResults` runs before the results show**, so Review Again's missed-only pass reads
  fresh history. It never throws.
- **Already-graded recovery records card performance too** (the earlier response was lost before
  anything was recorded).
- **Choice buttons are guarded against a double tap** (one status write, one navigation).
- **The Progress tab's empty state** shows only when there is no baseline result and no quiz
  score for any topic.

## Global Constraints

- Colors, spacing, radius and type come only from `src/theme/tokens.ts`. No new hex values.
- Strength chips: `success`/`successSoft` strong and Got it, `secondary`/`secondarySoft` shaky,
  `alert` text on `background` likely gap and Missed it, neutral (`inkSoft` on `background`) not
  tested. Every chip carries its text label, never color alone.
- Reuse `Button`, `Card`, `NoConnection`, `QuizRunner`, `ReviewScreen`. Tap targets ≥ 48pt.
- Screens never write `status` directly: only `markOpened` / `setStatusFromChoice` in
  `src/study/conceptProgress.ts`, never from an unknown status or while `cachedEmpty` is true.
- Mini-quiz size: `clamp(round(pool / 3), 5, 15)`, the whole pool when it has fewer than 5;
  decided on the server; the app sends no `count`.
- Strength bands: strong ≥ 80%, shaky 50–79%, likely gap < 50%; practice needs ≥ 3 answers.
- Card performance key: `dmv-app:card-perf:{uid}:{chunkId}`. Deck pass key stays
  `dmv-app:study:deck-position:{uid}:{chunkId}` (value becomes JSON).
- Copy (exact): "You've got this one — ready to move on." / "Worth another look before moving
  on." / "You can restart any concept from the concept list." / "Reviewing the {n} you missed" /
  "Show all cards" / "Skip to quiz" / "See all cards" / "A rough guide from your quizzes and
  baseline." / "{c} of {t} right in your latest quiz" / "{p}% in your latest quiz" / "From 1
  baseline question" / "Not tested yet".
- New and changed Cloud Functions follow the `cloud-function-documentation` skill.
- Commit after each task; messages `feat(ph-…): …` / `fix(…)` / `docs: …`, ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Double tap on a next-step choice** → exactly one status write and one navigation (Task 8).
2. **A saved pass whose cards are no longer in the deck** (bank edited) → missing ids dropped;
   if none remain, a fresh pass (Task 4).
3. **Corrupt JSON in card-perf or deck-pass storage** → treated as no history / no saved pass,
   no crash (Tasks 3, 4).
4. **`already-exists` on submit while the attempt can't be read** (offline) → "No connection"
   with Try again, not an endless spinner (Task 8).
5. **Review Again after a perfect score** → full deck, no "Reviewing the 0 you missed" banner
   (Tasks 4, 6).

---

## File Structure

| File | Responsibility |
|---|---|
| `functions/src/assembleMiniQuiz.ts` (modify) | `miniQuizSize(pool)`; default count from the pool; cap 15 |
| `functions/src/scoreTest.ts` (modify) | merge `latestMiniQuizCorrect` / `latestMiniQuizTotal` |
| `functions/README.md` (modify) | contract updates |
| `firestore-tests/rules.test.ts` (modify) | clients can't write the new fields |
| `src/study/conceptProgressData.ts` (modify) | read the new fields |
| `src/study/conceptProgress.ts`, `useConceptProgress.ts` (modify) | metadata changes, `cachedEmpty` |
| `src/study/cardPerformanceData.ts` (create) | pure per-question history |
| `src/study/cardPerformance.ts` (create) | AsyncStorage: `recordQuizResults`, `readTopicHistory` |
| `src/study/deckOrder.ts` (create) | weighted shuffle, `buildPass`, saved-pass parse/restore |
| `src/profile/localFlags.ts` (modify) | `getDeckPass` / `setDeckPass` replace deck position |
| `src/study/FlashcardScreen.tsx` (modify) | passes, banner, Skip to quiz, `pass` param |
| `src/navigation/types.ts` (modify) | `Flashcards.pass` param |
| `src/quiz/miniQuizData.ts` (create) | outcome parsing, copy, last-quiz ids, next topic, route rewrite |
| `src/quiz/MiniQuizResults.tsx` (create) | results UI |
| `src/quiz/MiniQuizScreen.tsx` (create) | loading → running → results, choices |
| `src/progress/conceptStrength.ts` (create) | strength rule, rows, sort, basis line |
| `src/progress/useConceptEvidence.ts` (create) | topics + progress + baseline attempt |
| `src/progress/ConceptReportScreen.tsx` (create) | Progress tab |
| `src/navigation/RootNavigator.tsx` (modify) | MiniQuiz and Progress screens |

---

### Task 1: `assembleMiniQuiz` sizes the quiz from the topic (ph-2-us-8)

**Files:**
- Modify: `functions/src/assembleMiniQuiz.ts`
- Test: `functions/src/assembleMiniQuiz.test.ts`
- Modify: `functions/README.md` (the `assembleMiniQuiz` section)

**Interfaces:**
- Produces: `export function miniQuizSize(poolSize: number): number`; `assembleMiniQuizForUser`
  unchanged signature; default count = `miniQuizSize(snapshot.size)`; explicit `count` capped at
  `MAX_MINI_QUIZ_COUNT = 15`.

- [ ] **Step 1: Write the failing tests** (append inside the `describe`, reusing `seedQuestion`)

```ts
  test.each([
    [1, 1],
    [3, 3],
    [4, 4],
    [9, 5],
    [16, 5],
    [17, 6],
    [31, 10],
    [45, 15],
    [60, 15],
  ])('miniQuizSize(%i) is %i', (pool, expected) => {
    expect(miniQuizSize(pool)).toBe(expected);
  });

  test('with no count, the quiz is sized from the topic (31 approved → 10)', async () => {
    for (let i = 1; i <= 31; i++) await seedQuestion(`q${i}`);
    const result = await assembleMiniQuizForUser(db, { uid: 'alice-uid' }, { chunkId: 'right-of-way' });
    expect(result.questions).toHaveLength(10);
  });

  test('a big topic gets up to 15 questions', async () => {
    for (let i = 1; i <= 50; i++) await seedQuestion(`q${i}`);
    const result = await assembleMiniQuizForUser(db, { uid: 'alice-uid' }, { chunkId: 'right-of-way' });
    expect(result.questions).toHaveLength(15);
  });

  test('an explicit count is still honoured and capped at 15', async () => {
    for (let i = 1; i <= 20; i++) await seedQuestion(`q${i}`);
    const three = await assembleMiniQuizForUser(db, { uid: 'alice-uid' }, { chunkId: 'right-of-way', count: 3 });
    expect(three.questions).toHaveLength(3);
    const capped = await assembleMiniQuizForUser(db, { uid: 'alice-uid' }, { chunkId: 'right-of-way', count: 40 });
    expect(capped.questions).toHaveLength(15);
  });
```

Add `miniQuizSize` to the import: `import { assembleMiniQuizForUser, miniQuizSize } from './assembleMiniQuiz';`.
Check the existing tests for any that assume a default of 10 from a pool larger than 10 (e.g. a
"caps at 10" test) and update their expectation to `miniQuizSize(pool)`.

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test:functions -- -t "assembleMiniQuizForUser"` (from the repo root; needs the
Firebase CLI logged in, which it is)
Expected: FAIL — `miniQuizSize is not a function`.

- [ ] **Step 3: Implement**

Replace the two constants and the count block in `functions/src/assembleMiniQuiz.ts`:

```ts
// ph-1-us-7 / ph-2-us-8: a mini-quiz is about a third of its topic, at least 5 and at most 15
// questions (the whole topic if it has fewer than 5). Decided here, not by the app, so the cap
// is enforced in one place.
const MAX_MINI_QUIZ_COUNT = 15;
const MIN_MINI_QUIZ_COUNT = 5;

/** How many questions a mini-quiz on a topic with `poolSize` approved questions gets. */
export function miniQuizSize(poolSize: number): number {
  if (poolSize < MIN_MINI_QUIZ_COUNT) return poolSize;
  return Math.min(MAX_MINI_QUIZ_COUNT, Math.max(MIN_MINI_QUIZ_COUNT, Math.round(poolSize / 3)));
}
```

In `assembleMiniQuizForUser`, validate an explicit count before the read, and size after it:

```ts
  // An explicit count is still accepted (and capped) so the contract stays backwards
  // compatible; the app no longer sends one.
  if (
    input.count !== undefined &&
    (typeof input.count !== 'number' || !Number.isInteger(input.count) || input.count <= 0)
  ) {
    throw new HttpsError('invalid-argument', 'count must be a positive integer.');
  }
```

…and after the `snapshot.empty` check:

```ts
  const count =
    typeof input.count === 'number'
      ? Math.min(input.count, MAX_MINI_QUIZ_COUNT)
      : miniQuizSize(snapshot.size);
```

Delete the old `requestedCount` / `count` lines. Update the doc comment's `Inputs` line to:
`input.count — optional; defaults to miniQuizSize(topic's approved questions), capped at 15`.

- [ ] **Step 4: Run to verify they pass**

Run: `npm run test:functions`
Expected: all functions tests PASS (71 + new).

- [ ] **Step 5: Update `functions/README.md`**: in the `assembleMiniQuiz` section, replace "defaults
to 10, capped at 10" (or equivalent wording) with "defaults to about a third of the topic's
approved questions (min 5, max 15; all of them if fewer than 5); an explicit `count` is capped at
15".

- [ ] **Step 6: Commit**

```bash
git add functions/src/assembleMiniQuiz.ts functions/src/assembleMiniQuiz.test.ts functions/README.md
git commit -m "feat(ph-2-us-8): assembleMiniQuiz sizes the quiz from the topic"
```

---

### Task 2: Correct/total on Concept Progress, and the cache-only empty snapshot (ph-2-us-11, ph-2-us-12)

**Files:**
- Modify: `functions/src/scoreTest.ts` (the conceptProgress merge, ~line 303)
- Test: `functions/src/scoreTest.test.ts` (the conceptProgress `describe`, ~line 228)
- Test: `firestore-tests/rules.test.ts` (the conceptProgress `describe`, ~line 281)
- Modify: `src/study/conceptProgressData.ts`, `src/study/conceptProgress.ts`, `src/study/useConceptProgress.ts`
- Test: `src/study/conceptProgressData.test.ts`, `src/study/useConceptProgress.test.tsx`
- Modify: `functions/README.md` (scoreTest persistence)

**Interfaces:**
- Produces: `ConceptProgress.latestMiniQuizCorrect?: number`, `latestMiniQuizTotal?: number`.
  `ConceptProgressState` ready variant becomes `{ status: 'ready'; byChunk: ProgressMap; cachedEmpty: boolean }`.
  `subscribeConceptProgress(uid, onChange: (map: ProgressMap, cachedEmpty: boolean) => void, onError)`.

- [ ] **Step 1: Failing functions test** (add to the existing mini-quiz test `'a mini-quiz merges its score…'`)

```ts
      expect(progress.latestMiniQuizCorrect).toBe(1);
      expect(progress.latestMiniQuizTotal).toBe(2);
```

- [ ] **Step 2: Failing rules test** (inside the conceptProgress `describe`)

```ts
  test.each(['latestMiniQuizCorrect', 'latestMiniQuizTotal'])(
    'a client write of %s is denied',
    async (field) => {
      await assertFails(
        setDoc(doc(alice(), path), {
          status: 'reviewed',
          statusUpdatedAt: serverTimestamp(),
          [field]: 10,
        })
      );
    }
  );
```

- [ ] **Step 3: Failing app test** (in `src/study/conceptProgressData.test.ts`)

```ts
test('reads correct and total when present', () => {
  expect(
    toProgress({ status: 'reviewed', latestMiniQuizScore: 0.7, latestMiniQuizCorrect: 7, latestMiniQuizTotal: 10 })
  ).toEqual({ status: 'reviewed', latestMiniQuizScore: 0.7, latestMiniQuizCorrect: 7, latestMiniQuizTotal: 10 });
});

test('ignores non-numeric correct and total', () => {
  expect(toProgress({ latestMiniQuizScore: 0.5, latestMiniQuizCorrect: '5' })).toEqual({
    status: 'in-progress',
    latestMiniQuizScore: 0.5,
  });
});
```

- [ ] **Step 4: Run the three suites to verify they fail**

Run: `npm run test:functions -- -t "Concept Progress"`, `npm run test:rules`, `npm run test:app -- conceptProgressData`
Expected: functions FAIL on `latestMiniQuizCorrect` undefined; rules: the new tests already PASS
(the existing `hasOnly` rule denies unknown keys; that's the point — they pin it); app FAIL.

- [ ] **Step 5: Implement**

`functions/src/scoreTest.ts`, in the merge:

```ts
        {
          latestMiniQuizScore: score,
          // ph-2-us-11 / Slice 4b: the counts behind the score, so the Progress tab can say
          // "7 of 10 right" without reading the attempt.
          latestMiniQuizCorrect: correctCount,
          latestMiniQuizTotal: totalCount,
          latestMiniQuizAt: FieldValue.serverTimestamp(),
          latestTestId: testId,
        },
```

Update the doc comment's `Writes` line to mention the counts.

`src/study/conceptProgressData.ts`:

```ts
export interface ConceptProgress {
  status: ConceptStatus;
  /** 0–1, written only by scoreTest (ph-2-us-11). */
  latestMiniQuizScore?: number;
  /** Right answers and questions in that quiz (Slice 4b). Missing on older records. */
  latestMiniQuizCorrect?: number;
  latestMiniQuizTotal?: number;
  latestMiniQuizAt?: Date;
}
```

In `toProgress`, after `const at = …`:

```ts
  const correct = typeof data.latestMiniQuizCorrect === 'number' ? data.latestMiniQuizCorrect : undefined;
  const total = typeof data.latestMiniQuizTotal === 'number' ? data.latestMiniQuizTotal : undefined;
```

and in the returned object, after the score spread:

```ts
    ...(correct !== undefined ? { latestMiniQuizCorrect: correct } : {}),
    ...(total !== undefined ? { latestMiniQuizTotal: total } : {}),
```

`src/study/conceptProgress.ts` — subscribe with metadata changes and report a cache-only empty
snapshot:

```ts
export function subscribeConceptProgress(
  uid: string,
  onChange: (map: ProgressMap, cachedEmpty: boolean) => void,
  onError: (error: unknown) => void
): () => void {
  // Metadata changes too, so a cache-only empty first snapshot is followed by the server's
  // answer even when the data is the same (Slice 4a carry-forward).
  return onSnapshot(
    progressCollection(uid),
    { includeMetadataChanges: true },
    (snapshot) => {
      const map: ProgressMap = {};
      snapshot.docs.forEach((d) => {
        map[d.id] = toProgress(d.data() as Record<string, unknown>);
      });
      onChange(map, snapshot.empty && snapshot.metadata.fromCache);
    },
    onError
  );
}
```

`src/study/useConceptProgress.ts`:

```ts
export type ConceptProgressState =
  | { status: 'loading' }
  /**
   * `cachedEmpty`: nothing in the local cache and the server hasn't answered yet. Lists can
   * show it, but nothing may write a status from it: a stale empty cache must not make a
   * reviewed topic look not started (Slice 4a carry-forward).
   */
  | { status: 'ready'; byChunk: ProgressMap; cachedEmpty: boolean }
  | { status: 'error' };
```

…and the two `setState` ready calls become `setState({ status: 'ready', byChunk: {}, cachedEmpty: false })`
(signed out) and `(byChunk, cachedEmpty) => setState({ status: 'ready', byChunk, cachedEmpty })`.
Extend the header comment with one sentence on `cachedEmpty`.

`src/study/FlashcardScreen.tsx`: the `markOpened` effect's guard adds `|| progress.cachedEmpty`
(inside the `progress.status === 'ready'` branch):

```ts
    if (marked.current || !uid || deck.status !== 'ready' || progress.status !== 'ready' || progress.cachedEmpty) return;
```

Fix every other construction of a ready state in tests (`{ status: 'ready', byChunk: {} }` →
add `cachedEmpty: false`): grep `byChunk:` under `src/`.

- [ ] **Step 6: Tests for `cachedEmpty`** — in `src/study/useConceptProgress.test.tsx`, follow the
file's existing mock of `subscribeConceptProgress` and add:

```tsx
test('passes cachedEmpty through from the subscription', async () => {
  // Use the file's existing captured onChange helper (the mock stores the callback).
  // Emit an empty, cache-only snapshot, then the server's empty answer.
  emit({}, true);
  expect(result()).toEqual({ status: 'ready', byChunk: {}, cachedEmpty: true });
  emit({}, false);
  expect(result()).toEqual({ status: 'ready', byChunk: {}, cachedEmpty: false });
});
```

(Adapt `emit` / `result` to the helper names that file already uses; if it calls `onChange(map)`
directly, pass the second argument.) In `src/study/FlashcardScreen.test.tsx` add:

```tsx
test('a cache-only empty progress snapshot never writes a status', async () => {
  mockProgress = { status: 'ready', byChunk: {}, cachedEmpty: true };
  mockGet.mockResolvedValue(deckOf(card(1)));
  await render(tree());
  await screen.findByLabelText('Question: Question 1');
  await waitFor(async () =>
    expect(await AsyncStorage.getItem('dmv-app:study:last-opened:u1')).toBe('row')
  );
  expect(markOpened).not.toHaveBeenCalled();
});
```

- [ ] **Step 7: Run all suites**

Run: `npm run test:functions`, `npm run test:rules`, `npm run test:app`, `npm run test:components`, `npx tsc --noEmit`
Expected: all PASS, tsc clean.

- [ ] **Step 8: README** — in `functions/README.md` under `scoreTest` persistence, add
`latestMiniQuizCorrect` and `latestMiniQuizTotal` to the conceptProgress merge fields.

- [ ] **Step 9: Commit**

```bash
git add functions/src/scoreTest.ts functions/src/scoreTest.test.ts functions/README.md firestore-tests/rules.test.ts src/study
git commit -m "feat(ph-2-us-11): save quiz counts on Concept Progress; ignore a cache-only empty snapshot"
```

---

### Task 3: Card performance store (ph-2-us-6)

**Files:**
- Create: `src/study/cardPerformanceData.ts`, `src/study/cardPerformance.ts`
- Test: `src/study/cardPerformanceData.test.ts`, `src/study/cardPerformance.test.ts`
- Modify: `src/profile/localFlags.ts` (only the import target used in Task 4; see note)

**Interfaces:**
- Consumes: `PerQuestionResult` from `src/api/types.ts`.
- Produces (`cardPerformanceData.ts`):
  ```ts
  export interface CardHistory { graded: number; missed: number; correctStreak: number; lastCorrect: boolean }
  export interface TopicHistory { cards: Record<string, CardHistory>; lastQuizMissedIds: string[] }
  export const NO_HISTORY: TopicHistory
  export function gradedByTopic(perQuestion: PerQuestionResult[]): Map<string, PerQuestionResult[]>
  export function applyQuizResults(history: TopicHistory, results: PerQuestionResult[]): TopicHistory
  export function parseTopicHistory(raw: string | null): TopicHistory
  export function cardHistory(history: TopicHistory, questionId: string): CardHistory | null
  ```
- Produces (`cardPerformance.ts`):
  ```ts
  export async function recordQuizResults(uid: string, perQuestion: PerQuestionResult[]): Promise<void>
  export async function readTopicHistory(uid: string, chunkId: string): Promise<TopicHistory>
  ```
  `recordQuizResults` also calls `setDeckPass(uid, chunkId, null)` (Task 4) for each topic it
  records. Task 3 lands before Task 4, so in this task call the existing
  `setDeckPosition(uid, chunkId, null)`; Task 4 renames it.

- [ ] **Step 1: Failing pure tests** — `src/study/cardPerformanceData.test.ts`

```ts
import type { PerQuestionResult } from '../api/types';
import {
  applyQuizResults,
  cardHistory,
  gradedByTopic,
  NO_HISTORY,
  parseTopicHistory,
} from './cardPerformanceData';

const r = (questionId: string, correct: boolean | null, over: Partial<PerQuestionResult> = {}): PerQuestionResult => ({
  questionId,
  chunkId: 'row',
  choice: correct === null ? null : 'x',
  correctAnswer: 'y',
  correct,
  ...over,
});

test('wrong, wrong, right accumulates to 3 graded, 2 missed, last correct', () => {
  let h = NO_HISTORY;
  h = applyQuizResults(h, [r('q1', false)]);
  h = applyQuizResults(h, [r('q1', false)]);
  h = applyQuizResults(h, [r('q1', true)]);
  expect(cardHistory(h, 'q1')).toEqual({ graded: 3, missed: 2, correctStreak: 1, lastCorrect: true });
});

test('a miss resets the correct streak', () => {
  let h = applyQuizResults(NO_HISTORY, [r('q1', true)]);
  h = applyQuizResults(h, [r('q1', true)]);
  h = applyQuizResults(h, [r('q1', false)]);
  expect(cardHistory(h, 'q1')).toMatchObject({ correctStreak: 0, missed: 1 });
});

test('a skipped question (choice null, correct false) counts as missed', () => {
  const h = applyQuizResults(NO_HISTORY, [r('q1', false, { choice: null })]);
  expect(cardHistory(h, 'q1')).toMatchObject({ missed: 1 });
  expect(h.lastQuizMissedIds).toEqual(['q1']);
});

test('lastQuizMissedIds is replaced by each quiz, not merged', () => {
  let h = applyQuizResults(NO_HISTORY, [r('q1', false), r('q2', true)]);
  h = applyQuizResults(h, [r('q2', false), r('q3', true)]);
  expect(h.lastQuizMissedIds).toEqual(['q2']);
});

test('unavailable and correct:null entries are skipped by gradedByTopic', () => {
  const grouped = gradedByTopic([
    r('q1', false),
    r('q2', null),
    r('q3', false, { unavailable: true }),
    r('q4', true, { chunkId: 'signs' }),
    r('q5', true, { chunkId: null }),
  ]);
  expect([...grouped.keys()].sort()).toEqual(['row', 'signs']);
  expect(grouped.get('row')!.map((x) => x.questionId)).toEqual(['q1']);
});

test('a never-graded question reads as null, not zeros', () => {
  expect(cardHistory(NO_HISTORY, 'q1')).toBeNull();
});

test.each([null, '', 'not json', '{"cards":5}', '[]', '{"cards":{"q1":{"graded":"x"}},"lastQuizMissedIds":[1]}'])(
  'parseTopicHistory(%p) degrades safely',
  (raw) => {
    const h = parseTopicHistory(raw);
    expect(h.lastQuizMissedIds.every((id) => typeof id === 'string')).toBe(true);
    expect(cardHistory(h, 'q1')).toBeNull();
  }
);

test('parseTopicHistory round-trips', () => {
  const h = applyQuizResults(NO_HISTORY, [r('q1', false)]);
  expect(parseTopicHistory(JSON.stringify(h))).toEqual(h);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:app -- cardPerformanceData`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement** `src/study/cardPerformanceData.ts`

```ts
import type { PerQuestionResult } from '../api/types';

// ph-2-us-6: what this phone remembers about each question from graded quizzes, so the
// flashcards can put missed cards first (ph-2-us-4) or show only them (Slice 4b). Local only.
// No Firebase or storage imports, so it runs under plain-Node Jest.

export interface CardHistory {
  graded: number;
  missed: number;
  /** Correct answers in a row, most recent last; a miss resets it. */
  correctStreak: number;
  lastCorrect: boolean;
}

export interface TopicHistory {
  cards: Record<string, CardHistory>;
  /** Questions missed (wrong or skipped) in this topic's most recent quiz. */
  lastQuizMissedIds: string[];
}

export const NO_HISTORY: TopicHistory = { cards: {}, lastQuizMissedIds: [] };

/** Graded results by topic. Removed questions and ungraded entries are left out, not misses. */
export function gradedByTopic(perQuestion: PerQuestionResult[]): Map<string, PerQuestionResult[]> {
  const out = new Map<string, PerQuestionResult[]>();
  for (const q of perQuestion) {
    if (q.unavailable || q.correct === null || !q.chunkId) continue;
    out.set(q.chunkId, [...(out.get(q.chunkId) ?? []), q]);
  }
  return out;
}

/** One quiz's graded results for one topic, added to that topic's history. */
export function applyQuizResults(history: TopicHistory, results: PerQuestionResult[]): TopicHistory {
  const cards = { ...history.cards };
  const missedIds: string[] = [];
  for (const q of results) {
    const correct = q.correct === true;
    const prev = cards[q.questionId] ?? { graded: 0, missed: 0, correctStreak: 0, lastCorrect: false };
    cards[q.questionId] = {
      graded: prev.graded + 1,
      missed: prev.missed + (correct ? 0 : 1),
      correctStreak: correct ? prev.correctStreak + 1 : 0,
      lastCorrect: correct,
    };
    if (!correct) missedIds.push(q.questionId);
  }
  return { cards, lastQuizMissedIds: missedIds };
}

function isCardHistory(value: unknown): value is CardHistory {
  const v = value as Record<string, unknown> | null;
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.graded === 'number' &&
    typeof v.missed === 'number' &&
    typeof v.correctStreak === 'number' &&
    typeof v.lastCorrect === 'boolean'
  );
}

/** Stored JSON back to history. Anything unreadable is dropped, never thrown. */
export function parseTopicHistory(raw: string | null): TopicHistory {
  if (!raw) return NO_HISTORY;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return NO_HISTORY;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return NO_HISTORY;
  const d = data as Record<string, unknown>;
  const cards: Record<string, CardHistory> = {};
  if (typeof d.cards === 'object' && d.cards !== null && !Array.isArray(d.cards)) {
    for (const [id, value] of Object.entries(d.cards)) {
      if (isCardHistory(value)) cards[id] = value;
    }
  }
  const missed = Array.isArray(d.lastQuizMissedIds)
    ? d.lastQuizMissedIds.filter((id): id is string => typeof id === 'string')
    : [];
  return { cards, lastQuizMissedIds: missed };
}

/** A question's history, or null when it has never been graded on this phone. */
export function cardHistory(history: TopicHistory, questionId: string): CardHistory | null {
  return history.cards[questionId] ?? null;
}
```

- [ ] **Step 4: Run** `npm run test:app -- cardPerformanceData` — Expected: PASS.

- [ ] **Step 5: Failing storage tests** — `src/study/cardPerformance.test.ts`

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PerQuestionResult } from '../api/types';
import { readTopicHistory, recordQuizResults } from './cardPerformance';

const r = (questionId: string, chunkId: string, correct: boolean): PerQuestionResult => ({
  questionId, chunkId, choice: 'x', correctAnswer: 'y', correct,
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('records per topic and user, and survives a re-read', async () => {
  await recordQuizResults('u1', [r('q1', 'row', false), r('q2', 'row', true), r('s1', 'signs', false)]);
  const row = await readTopicHistory('u1', 'row');
  expect(row.lastQuizMissedIds).toEqual(['q1']);
  expect(row.cards.q2).toEqual({ graded: 1, missed: 0, correctStreak: 1, lastCorrect: true });
  expect((await readTopicHistory('u1', 'signs')).lastQuizMissedIds).toEqual(['s1']);
  expect((await readTopicHistory('u2', 'row')).lastQuizMissedIds).toEqual([]);
  expect(await AsyncStorage.getItem('dmv-app:card-perf:u1:row')).not.toBeNull();
});

test('recording clears the topic’s saved deck pass', async () => {
  await AsyncStorage.setItem('dmv-app:study:deck-position:u1:row', 'q2');
  await recordQuizResults('u1', [r('q1', 'row', false)]);
  expect(await AsyncStorage.getItem('dmv-app:study:deck-position:u1:row')).toBeNull();
});

test('a storage failure reads as no history and a write failure does not throw', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
  expect(await readTopicHistory('u1', 'row')).toEqual({ cards: {}, lastQuizMissedIds: [] });
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
  await expect(recordQuizResults('u1', [r('q1', 'row', false)])).resolves.toBeUndefined();
  warn.mockRestore();
});
```

- [ ] **Step 6: Implement** `src/study/cardPerformance.ts`

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PerQuestionResult } from '../api/types';
import { PREFIX, setDeckPosition } from '../profile/localFlags';
import { applyQuizResults, gradedByTopic, NO_HISTORY, parseTopicHistory, type TopicHistory } from './cardPerformanceData';

// ph-2-us-6: per-question quiz history on this phone, one AsyncStorage key per user and topic
// so a topic's history loads in one read. Failures are logged and read as "no history"; they
// never reach a screen.

const key = (uid: string, chunkId: string) => `${PREFIX}card-perf:${uid}:${chunkId}`;

export async function readTopicHistory(uid: string, chunkId: string): Promise<TopicHistory> {
  try {
    return parseTopicHistory(await AsyncStorage.getItem(key(uid, chunkId)));
  } catch (error) {
    console.warn('[cardPerformance] read failed', chunkId, error);
    return NO_HISTORY;
  }
}

/**
 * Adds a graded quiz's results. Each recorded topic's saved deck pass is cleared, so the next
 * time its flashcards open they build a fresh pass from this history.
 */
export async function recordQuizResults(uid: string, perQuestion: PerQuestionResult[]): Promise<void> {
  for (const [chunkId, results] of gradedByTopic(perQuestion)) {
    try {
      const next = applyQuizResults(await readTopicHistory(uid, chunkId), results);
      await AsyncStorage.setItem(key(uid, chunkId), JSON.stringify(next));
    } catch (error) {
      console.warn('[cardPerformance] write failed', chunkId, error);
    }
    await setDeckPosition(uid, chunkId, null);
  }
}
```

- [ ] **Step 7: Run** `npm run test:app` — Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/study/cardPerformanceData.ts src/study/cardPerformanceData.test.ts src/study/cardPerformance.ts src/study/cardPerformance.test.ts
git commit -m "feat(ph-2-us-6): local per-card quiz history"
```

---

### Task 4: Deck passes and the saved pass (ph-2-us-4)

**Files:**
- Create: `src/study/deckOrder.ts`; Test: `src/study/deckOrder.test.ts`
- Modify: `src/profile/localFlags.ts`, `src/profile/localFlags.test.ts`, `src/study/cardPerformance.ts`
- Modify: `src/study/deck.ts` (remove `shuffled` only if unused after Task 6 — leave it now)

**Interfaces:**
- Consumes: `TopicHistory`, `cardHistory` (Task 3).
- Produces (`deckOrder.ts`):
  ```ts
  export type PassMode = 'missed-only' | 'full';
  export interface SavedPass { mode: PassMode; cardIds: string[]; cardId: string }
  export const WEAK_WEIGHT = 3;
  export const LEARNED_STREAK = 2;
  export function cardWeight(history: CardHistory | null): number
  export function weightedShuffle<T>(items: readonly T[], weight: (item: T) => number, random?: () => number): T[]
  export function buildPass<T extends { id: string }>(cards: readonly T[], history: TopicHistory, mode: PassMode, random?: () => number): { mode: PassMode; cards: T[] }
  export function restorePass<T extends { id: string }>(cards: readonly T[], saved: SavedPass): { mode: PassMode; cards: T[]; index: number } | null
  export function parseSavedPass(raw: string | null): SavedPass | null
  ```
- Produces (`localFlags.ts`): `getDeckPass(uid, chunkId): Promise<SavedPass | null>`,
  `setDeckPass(uid, chunkId, pass: SavedPass | null): Promise<void>`; `getDeckPosition` /
  `setDeckPosition` are removed.

- [ ] **Step 1: Failing tests** — `src/study/deckOrder.test.ts`

```ts
import { applyQuizResults, NO_HISTORY } from './cardPerformanceData';
import { buildPass, cardWeight, parseSavedPass, restorePass, weightedShuffle } from './deckOrder';

const cards = ['q1', 'q2', 'q3', 'q4'].map((id) => ({ id }));
const miss = (id: string) => ({ questionId: id, chunkId: 'row', choice: 'x', correctAnswer: 'y', correct: false });
const hit = (id: string) => ({ ...miss(id), correct: true });
const keepOrder = () => 0.999;

test('cardWeight: never graded and learned cards are neutral; weak cards are boosted', () => {
  expect(cardWeight(null)).toBe(1);
  expect(cardWeight({ graded: 1, missed: 1, correctStreak: 0, lastCorrect: false })).toBe(3);
  expect(cardWeight({ graded: 3, missed: 1, correctStreak: 1, lastCorrect: true })).toBe(3);
  expect(cardWeight({ graded: 3, missed: 1, correctStreak: 2, lastCorrect: true })).toBe(1);
  expect(cardWeight({ graded: 2, missed: 0, correctStreak: 2, lastCorrect: true })).toBe(1);
});

test('full pass: every card exactly once', () => {
  const h = applyQuizResults(NO_HISTORY, [miss('q3')]);
  for (let i = 0; i < 50; i++) {
    const pass = buildPass(cards, h, 'full');
    expect(pass.mode).toBe('full');
    expect(pass.cards.map((c) => c.id).sort()).toEqual(['q1', 'q2', 'q3', 'q4']);
  }
});

test('full pass: a missed card lands in the first half much more often', () => {
  const h = applyQuizResults(NO_HISTORY, [miss('q4'), hit('q1')]);
  let early = 0;
  for (let i = 0; i < 2000; i++) {
    const ids = buildPass(cards, h, 'full').cards.map((c) => c.id);
    if (ids.indexOf('q4') < 2) early++;
  }
  expect(early / 2000).toBeGreaterThan(0.65);
});

test('with a fixed random source, order is deterministic and weak cards come first', () => {
  const h = applyQuizResults(NO_HISTORY, [miss('q3')]);
  expect(buildPass(cards, h, 'full', keepOrder).cards.map((c) => c.id)).toEqual(['q3', 'q1', 'q2', 'q4']);
  expect(buildPass(cards, NO_HISTORY, 'full', keepOrder).cards.map((c) => c.id)).toEqual(['q1', 'q2', 'q3', 'q4']);
});

test('missed-only pass: only the last quiz misses that are in the deck', () => {
  const h = applyQuizResults(NO_HISTORY, [miss('q2'), miss('gone'), hit('q1')]);
  const pass = buildPass(cards, h, 'missed-only', keepOrder);
  expect(pass).toEqual({ mode: 'missed-only', cards: [{ id: 'q2' }] });
});

test.each([
  ['no history', NO_HISTORY],
  ['a perfect score', applyQuizResults(NO_HISTORY, [hit('q1'), hit('q2')])],
  ['misses no longer in the deck', applyQuizResults(NO_HISTORY, [miss('gone')])],
])('missed-only falls back to full with %s', (_label, h) => {
  const pass = buildPass(cards, h, 'missed-only', keepOrder);
  expect(pass.mode).toBe('full');
  expect(pass.cards).toHaveLength(4);
});

test('weightedShuffle on one item and on none', () => {
  expect(weightedShuffle([{ id: 'a' }], () => 1)).toEqual([{ id: 'a' }]);
  expect(weightedShuffle([], () => 1)).toEqual([]);
});

test('restorePass keeps order and position, dropping cards no longer in the deck', () => {
  const restored = restorePass(cards, { mode: 'full', cardIds: ['q3', 'gone', 'q1', 'q2', 'q4'], cardId: 'q1' });
  expect(restored).toEqual({ mode: 'full', cards: [{ id: 'q3' }, { id: 'q1' }, { id: 'q2' }, { id: 'q4' }], index: 1 });
});

test('restorePass: a current card that is gone starts the pass from the top', () => {
  expect(restorePass(cards, { mode: 'missed-only', cardIds: ['q2', 'q4'], cardId: 'gone' })).toEqual({
    mode: 'missed-only', cards: [{ id: 'q2' }, { id: 'q4' }], index: 0,
  });
});

test('restorePass: nothing left means no saved pass', () => {
  expect(restorePass(cards, { mode: 'full', cardIds: ['gone'], cardId: 'gone' })).toBeNull();
});

test('a full pass restored after new cards were added appends them at the end', () => {
  const restored = restorePass(cards, { mode: 'full', cardIds: ['q2', 'q1'], cardId: 'q1' });
  expect(restored!.cards.map((c) => c.id)).toEqual(['q2', 'q1', 'q3', 'q4']);
});

test.each([null, 'q7', '{', '{"mode":"x","cardIds":[],"cardId":"q1"}', '{"mode":"full","cardIds":"q1","cardId":"q1"}'])(
  'parseSavedPass(%p) is null (old plain card id, corrupt, or malformed)',
  (raw) => {
    expect(parseSavedPass(raw)).toBeNull();
  }
);

test('parseSavedPass reads a stored pass', () => {
  const pass = { mode: 'missed-only', cardIds: ['q2'], cardId: 'q2' };
  expect(parseSavedPass(JSON.stringify(pass))).toEqual(pass);
});
```

- [ ] **Step 2: Run** `npm run test:app -- deckOrder` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement** `src/study/deckOrder.ts`

```ts
import { cardHistory, type CardHistory, type TopicHistory } from './cardPerformanceData';

// ph-2-us-4 (Slice 4b): the order a pass through a topic's flashcards takes. A `full` pass is
// every card once, with cards missed in quizzes tending to come first (a weighted shuffle, not
// a spaced-repetition schedule). A `missed-only` pass is just the cards missed in the topic's
// last quiz (Review Again, or reopening a "needs revisit" topic). Pure, so it runs under Node.

export type PassMode = 'missed-only' | 'full';

/** A pass saved on the phone so reopening the topic resumes the same sequence. */
export interface SavedPass {
  mode: PassMode;
  cardIds: string[];
  /** The card showing when it was saved. */
  cardId: string;
}

/** A card missed before and not yet right this many times in a row is boosted. */
export const LEARNED_STREAK = 2;
export const WEAK_WEIGHT = 3;

export function cardWeight(history: CardHistory | null): number {
  if (!history) return 1; // never graded: neutral, not "known well"
  return history.missed > 0 && history.correctStreak < LEARNED_STREAK ? WEAK_WEIGHT : 1;
}

/**
 * Weighted random order (Efraimidis–Spirakis): each item gets key random^(1/weight) and the
 * highest keys come first, so heavier items tend to be earlier. Ties keep input order.
 */
export function weightedShuffle<T>(
  items: readonly T[],
  weight: (item: T) => number,
  random: () => number = Math.random
): T[] {
  return items
    .map((item, i) => ({ item, i, key: random() ** (1 / weight(item)) }))
    .sort((a, b) => b.key - a.key || a.i - b.i)
    .map(({ item }) => item);
}

export function buildPass<T extends { id: string }>(
  cards: readonly T[],
  history: TopicHistory,
  mode: PassMode,
  random: () => number = Math.random
): { mode: PassMode; cards: T[] } {
  const byWeight = (c: T) => cardWeight(cardHistory(history, c.id));
  if (mode === 'missed-only') {
    const missed = new Set(history.lastQuizMissedIds);
    const only = cards.filter((c) => missed.has(c.id));
    if (only.length > 0) return { mode, cards: weightedShuffle(only, () => 1, random) };
  }
  return { mode: 'full', cards: weightedShuffle(cards, byWeight, random) };
}

export function restorePass<T extends { id: string }>(
  cards: readonly T[],
  saved: SavedPass
): { mode: PassMode; cards: T[]; index: number } | null {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const kept = saved.cardIds.map((id) => byId.get(id)).filter((c): c is T => c !== undefined);
  if (kept.length === 0) return null;
  // A full pass promises every card: cards added since it was saved go at the end.
  const keptIds = new Set(kept.map((c) => c.id));
  const ordered = saved.mode === 'full' ? [...kept, ...cards.filter((c) => !keptIds.has(c.id))] : kept;
  return { mode: saved.mode, cards: ordered, index: Math.max(0, ordered.findIndex((c) => c.id === saved.cardId)) };
}

/** Stored JSON back to a pass. A 4a plain card id, corrupt or malformed value reads as none. */
export function parseSavedPass(raw: string | null): SavedPass | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Record<string, unknown>;
    if (
      (d.mode === 'full' || d.mode === 'missed-only') &&
      Array.isArray(d.cardIds) &&
      d.cardIds.every((id) => typeof id === 'string') &&
      typeof d.cardId === 'string'
    ) {
      return { mode: d.mode, cardIds: d.cardIds as string[], cardId: d.cardId };
    }
  } catch {
    // fall through
  }
  return null;
}
```

- [ ] **Step 4: Replace deck position in `src/profile/localFlags.ts`** — replace the
`DECK_POSITION` section (comment, key, `getDeckPosition`, `setDeckPosition`) with:

```ts
// The pass a topic's flashcards were left in (its order, mode and current card), so reopening
// the topic resumes the same sequence (Slice 4b). Cleared at the end of the deck and when a quiz
// on the topic is recorded, so the next open builds a fresh pass. Same key as 4a's card id; an
// old plain id reads as "no saved pass".
const DECK_POSITION = 'study:deck-position';

function deckPositionKey(uid: string, chunkId: string): string {
  return `${PREFIX}${DECK_POSITION}:${uid}:${chunkId}`;
}

/** A storage failure or unreadable value reads as "none", which only costs starting a new pass. */
export async function getDeckPass(uid: string, chunkId: string): Promise<SavedPass | null> {
  try {
    return parseSavedPass(await AsyncStorage.getItem(deckPositionKey(uid, chunkId)));
  } catch (error) {
    console.warn('[localFlags] deck-pass read failed', error);
    return null;
  }
}

/** `null` clears it. */
export async function setDeckPass(uid: string, chunkId: string, pass: SavedPass | null): Promise<void> {
  try {
    if (pass) await AsyncStorage.setItem(deckPositionKey(uid, chunkId), JSON.stringify(pass));
    else await AsyncStorage.removeItem(deckPositionKey(uid, chunkId));
  } catch (error) {
    console.warn('[localFlags] deck-pass write failed', error);
  }
}
```

with `import { parseSavedPass, type SavedPass } from '../study/deckOrder';` at the top.
In `src/study/cardPerformance.ts`, change the import and call to `setDeckPass(uid, chunkId, null)`.

Replace the deck-position test in `src/profile/localFlags.test.ts`:

```ts
test('deck pass is stored per uid and topic, and null clears it', async () => {
  const pass = { mode: 'full' as const, cardIds: ['q7', 'q8'], cardId: 'q7' };
  expect(await getDeckPass('u1', 'row')).toBeNull();
  await setDeckPass('u1', 'row', pass);
  expect(await getDeckPass('u1', 'row')).toEqual(pass);
  expect(await getDeckPass('u1', 'signs')).toBeNull();
  expect(await getDeckPass('u2', 'row')).toBeNull();
  await setDeckPass('u1', 'row', null);
  expect(await getDeckPass('u1', 'row')).toBeNull();
});

test("a 4a plain card id reads as no saved pass", async () => {
  await AsyncStorage.setItem('dmv-app:study:deck-position:u1:row', 'q7');
  expect(await getDeckPass('u1', 'row')).toBeNull();
});
```

(update the import line accordingly). `FlashcardScreen.tsx` still imports the removed functions;
Task 6 rewrites it. To keep `tsc` and component tests green between tasks, in this task change
`FlashcardScreen.tsx` minimally: `useSavedPosition` reads `(await getDeckPass(uid, chunkId))?.cardId ?? null`,
and `onMove` writes `setDeckPass(uid, chunkId, cardId ? { mode: 'full', cardIds: deck.cards.map((c) => c.id), cardId } : null)`.
Update the three resume tests in `FlashcardScreen.test.tsx` that read/write the raw key to use
`JSON.parse(...).cardId` / a JSON value. (Task 6 replaces this with real passes.)

- [ ] **Step 5: Run** `npm run test:app`, `npm run test:components`, `npx tsc --noEmit` — Expected: PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add src/study/deckOrder.ts src/study/deckOrder.test.ts src/profile src/study/cardPerformance.ts src/study/FlashcardScreen.tsx src/study/FlashcardScreen.test.tsx
git commit -m "feat(ph-2-us-4): weighted and missed-only deck passes, saved per topic"
```

---

### Task 5: Mini-quiz helpers (ph-2-us-8, ph-2-us-9)

**Files:**
- Create: `src/quiz/miniQuizData.ts`; Test: `src/quiz/miniQuizData.test.ts`

**Interfaces:**
- Consumes: `ScoreTestResult` (`src/api/types.ts`), `toReviewItems`, `isMissed`, `ReviewItem`
  (`src/review/reviewData.ts`), `Topic` (`src/topics/topicsData.ts`), `NextStepChoice`
  (`src/study/conceptProgressData.ts`).
- Produces:
  ```ts
  export type Recommendation = 'move-on' | 'review-again';
  export interface MiniQuizOutcome { testId: string; correctCount: number; totalCount: number; score: number; recommendation: Recommendation; missed: ReviewItem[]; perQuestion: PerQuestionResult[] }
  export const MINI_QUIZ_PASS_THRESHOLD = 0.8;
  export function fromScoreResult(result: ScoreTestResult): MiniQuizOutcome
  export function fromAttempt(testId: string, data: Record<string, unknown> | undefined): MiniQuizOutcome | null
  export function scoreLine(o: MiniQuizOutcome): string
  export function recommendationLine(r: Recommendation): string
  export function recommendedChoice(r: Recommendation): NextStepChoice
  export function rememberQuiz(chunkId: string, questionIds: string[]): void
  export function lastQuizIds(chunkId: string): string[]
  export function nextTopicId(topics: Topic[], chunkId: string): string | null
  export interface RouteLike { name: string; params?: object; key?: string }
  export function routesForNextTopic<R extends RouteLike>(routes: R[], nextChunkId: string): RouteLike[]
  ```

- [ ] **Step 1: Failing tests** — `src/quiz/miniQuizData.test.ts`

```ts
import type { ScoreTestResult } from '../api/types';
import type { Topic } from '../topics/topicsData';
import {
  fromAttempt,
  fromScoreResult,
  lastQuizIds,
  nextTopicId,
  recommendationLine,
  recommendedChoice,
  rememberQuiz,
  routesForNextTopic,
  scoreLine,
} from './miniQuizData';

const pq = (id: string, correct: boolean, choice: string | null = 'x') => ({
  questionId: id, chunkId: 'row', choice, correctAnswer: 'y', correct, text: `Q ${id}`, choices: ['x', 'y'], type: 'fact' as const,
});
const result: ScoreTestResult = {
  testId: 't1', type: 'mini-quiz', score: 0.7, correctCount: 7, totalCount: 10, perTopic: [],
  perQuestion: [pq('a', false), pq('b', true), pq('c', false, null)], recommendation: 'review-again',
};

test('fromScoreResult keeps the counts and lists missed (wrong and skipped) questions', () => {
  const o = fromScoreResult(result);
  expect(o).toMatchObject({ testId: 't1', correctCount: 7, totalCount: 10, recommendation: 'review-again' });
  expect(o.missed.map((m) => [m.questionId, m.outcome])).toEqual([['a', 'wrong'], ['c', 'skipped']]);
});

test('a null recommendation falls back to the score', () => {
  expect(fromScoreResult({ ...result, recommendation: null, score: 0.8 }).recommendation).toBe('move-on');
  expect(fromScoreResult({ ...result, recommendation: null, score: 0.79 }).recommendation).toBe('review-again');
});

test('fromAttempt reads a saved attempt, and rejects one that is missing or malformed', () => {
  const data = { type: 'mini-quiz', score: 1, correctCount: 2, totalCount: 2, perQuestion: [pq('a', true)], recommendation: 'move-on' };
  expect(fromAttempt('t1', data)).toMatchObject({ testId: 't1', correctCount: 2, totalCount: 2, recommendation: 'move-on', missed: [] });
  expect(fromAttempt('t1', undefined)).toBeNull();
  expect(fromAttempt('t1', { type: 'mini-quiz', score: 'x' })).toBeNull();
});

test('copy', () => {
  expect(scoreLine(fromScoreResult(result))).toBe('7 of 10 · 70%');
  expect(recommendationLine('move-on')).toBe("You've got this one — ready to move on.");
  expect(recommendationLine('review-again')).toBe('Worth another look before moving on.');
  expect(recommendedChoice('move-on')).toBe('mark-reviewed');
  expect(recommendedChoice('review-again')).toBe('review-again');
});

test('remembers the last quiz per topic for excludeIds', () => {
  expect(lastQuizIds('row')).toEqual([]);
  rememberQuiz('row', ['a', 'b']);
  rememberQuiz('signs', ['s']);
  expect(lastQuizIds('row')).toEqual(['a', 'b']);
});

const topic = (chunkId: string, order: number, approvedQuestionCount = 5): Topic => ({
  chunkId, title: chunkId, description: '', order, approvedQuestionCount,
});

test('nextTopicId skips topics with no approved questions and returns null at the end', () => {
  const topics = [topic('a', 1), topic('b', 2, 0), topic('c', 3), topic('d', 4, 0)];
  expect(nextTopicId(topics, 'a')).toBe('c');
  expect(nextTopicId(topics, 'c')).toBeNull();
  expect(nextTopicId(topics, 'unknown')).toBeNull();
});

test('routesForNextTopic replaces the trailing Flashcards and MiniQuiz with the next topic', () => {
  const routes = [
    { name: 'Main', key: 'm' },
    { name: 'Review', key: 'r', params: { testId: 'x' } },
    { name: 'Flashcards', key: 'f', params: { chunkId: 'a' } },
    { name: 'MiniQuiz', key: 'q', params: { chunkId: 'a' } },
  ];
  expect(routesForNextTopic(routes, 'c')).toEqual([
    { name: 'Main', key: 'm' },
    { name: 'Review', key: 'r', params: { testId: 'x' } },
    { name: 'Flashcards', params: { chunkId: 'c' } },
  ]);
});
```

- [ ] **Step 2: Run** `npm run test:app -- miniQuizData` — Expected: FAIL.

- [ ] **Step 3: Implement** `src/quiz/miniQuizData.ts`

```ts
import type { PerQuestionResult, ScoreTestResult } from '../api/types';
import { isMissed, toReviewItems, type ReviewItem } from '../review/reviewData';
import type { NextStepChoice } from '../study/conceptProgressData';
import type { Topic } from '../topics/topicsData';

// ph-2-us-8 / ph-2-us-9: the mini-quiz's logic outside the screen: its graded outcome (from
// scoreTest, or from the saved attempt when it was already graded), the results copy, the
// previous quiz per topic for excludeIds, and where "Come Back Later" goes. No Firebase
// imports, so it runs under plain-Node Jest.

export type Recommendation = 'move-on' | 'review-again';

export interface MiniQuizOutcome {
  testId: string;
  correctCount: number;
  totalCount: number;
  score: number;
  recommendation: Recommendation;
  /** Wrong or skipped, in quiz order. */
  missed: ReviewItem[];
  /** Raw results, for recording card performance (ph-2-us-6). */
  perQuestion: PerQuestionResult[];
}

/** Client copy of scoreTest's MINI_QUIZ_PASS_THRESHOLD, used only if a result lacks one. */
export const MINI_QUIZ_PASS_THRESHOLD = 0.8;

function outcome(
  testId: string,
  score: number,
  correctCount: number,
  totalCount: number,
  recommendation: unknown,
  perQuestion: PerQuestionResult[]
): MiniQuizOutcome {
  const items = toReviewItems({ type: 'mini-quiz', perQuestion }) ?? [];
  return {
    testId,
    score,
    correctCount,
    totalCount,
    recommendation:
      recommendation === 'move-on' || recommendation === 'review-again'
        ? recommendation
        : score >= MINI_QUIZ_PASS_THRESHOLD
          ? 'move-on'
          : 'review-again',
    missed: items.filter(isMissed),
    perQuestion,
  };
}

export function fromScoreResult(result: ScoreTestResult): MiniQuizOutcome {
  return outcome(result.testId, result.score, result.correctCount, result.totalCount, result.recommendation, result.perQuestion);
}

/** A saved attempt (users/{uid}/testAttempts/{testId}), or null if it isn't a usable one. */
export function fromAttempt(testId: string, data: Record<string, unknown> | undefined): MiniQuizOutcome | null {
  if (
    !data ||
    typeof data.score !== 'number' ||
    typeof data.correctCount !== 'number' ||
    typeof data.totalCount !== 'number' ||
    !Array.isArray(data.perQuestion)
  ) {
    return null;
  }
  return outcome(testId, data.score, data.correctCount, data.totalCount, data.recommendation, data.perQuestion as PerQuestionResult[]);
}

export function scoreLine(o: MiniQuizOutcome): string {
  return `${o.correctCount} of ${o.totalCount} · ${Math.round(o.score * 100)}%`;
}

export function recommendationLine(r: Recommendation): string {
  return r === 'move-on' ? "You've got this one — ready to move on." : 'Worth another look before moving on.';
}

/** The choice the recommendation highlights. The others stay available (prd.md: not a gate). */
export function recommendedChoice(r: Recommendation): NextStepChoice {
  return r === 'move-on' ? 'mark-reviewed' : 'review-again';
}

// In memory only: a retake in this session avoids the previous set (ph-2-us-8).
const lastQuiz = new Map<string, string[]>();

export function rememberQuiz(chunkId: string, questionIds: string[]): void {
  lastQuiz.set(chunkId, questionIds);
}

export function lastQuizIds(chunkId: string): string[] {
  return lastQuiz.get(chunkId) ?? [];
}

/** The next topic in handbook order that has approved questions, or null after the last one. */
export function nextTopicId(topics: Topic[], chunkId: string): string | null {
  const at = topics.findIndex((t) => t.chunkId === chunkId);
  if (at === -1) return null;
  return topics.slice(at + 1).find((t) => t.approvedQuestionCount > 0)?.chunkId ?? null;
}

export interface RouteLike {
  name: string;
  key?: string;
  params?: object;
}

/**
 * The root stack after "Come Back Later": the trailing Flashcards and MiniQuiz of the finished
 * topic are replaced by the next topic's Flashcards, so Back goes where the topic was opened from.
 */
export function routesForNextTopic<R extends RouteLike>(routes: R[], nextChunkId: string): RouteLike[] {
  let end = routes.length;
  while (end > 0 && (routes[end - 1].name === 'MiniQuiz' || routes[end - 1].name === 'Flashcards')) end--;
  return [...routes.slice(0, end), { name: 'Flashcards', params: { chunkId: nextChunkId } }];
}
```

- [ ] **Step 4: Run** `npm run test:app -- miniQuizData` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/quiz/miniQuizData.ts src/quiz/miniQuizData.test.ts
git commit -m "feat(ph-2-us-8): mini-quiz outcome, copy and navigation helpers"
```

---

### Task 6: Flashcard viewer passes, banner, Skip to quiz, `pass` param (ph-2-us-3, ph-2-us-4)

**Files:**
- Modify: `src/navigation/types.ts`, `src/study/FlashcardScreen.tsx`
- Test: `src/study/FlashcardScreen.test.tsx`

**Interfaces:**
- Consumes: `buildPass`, `restorePass`, `PassMode`, `SavedPass` (Task 4); `getDeckPass`,
  `setDeckPass` (Task 4); `readTopicHistory` (Task 3); `useConceptProgress` with `cachedEmpty` (Task 2).
- Produces: route params `Flashcards: { chunkId: string; pass?: { mode: PassMode; nonce: number } }`.
  Task 8 navigates with `popTo('Flashcards', { chunkId, pass: { mode: 'missed-only', nonce: Date.now() } })`.

- [ ] **Step 1: Route type** — in `src/navigation/types.ts`:

```ts
import type { PassMode } from '../study/deckOrder';
…
  /** One topic's flip-card flashcards (ph-2-us-3). Above the tabs so Back returns to the list,
   * results or review, wherever it was opened from. A new `pass` (Review Again, Slice 4b)
   * starts that pass in the open viewer. */
  Flashcards: { chunkId: string; pass?: { mode: PassMode; nonce: number } };
  /** The topic's mini-quiz (ph-2-us-8). */
  MiniQuiz: { chunkId: string };
```

- [ ] **Step 2: Failing component tests** — in `src/study/FlashcardScreen.test.tsx`:

Add to `beforeEach`: `jest.spyOn(Math, 'random').mockReturnValue(0.999);` (keeps input order;
see "Decisions") and `afterEach(() => jest.restoreAllMocks());`. Seed history with a helper:

```tsx
async function seedHistory(missedIds: string[], cards: Record<string, unknown> = {}) {
  await AsyncStorage.setItem('dmv-app:card-perf:u1:row', JSON.stringify({ cards, lastQuizMissedIds: missedIds }));
}
const weak = { graded: 1, missed: 1, correctStreak: 0, lastCorrect: false };
```

Add a second tree helper with a pass param:

```tsx
function treeWith(params: object) {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Flashcards" component={FlashcardScreen as never} initialParams={params} />
        <Stack.Screen name="MiniQuiz">{() => <Text>Mini-quiz screen</Text>}</Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

Tests:

```tsx
test('a full pass puts weak cards first', async () => {
  await seedHistory([], { q3: weak });
  mockGet.mockResolvedValue(deckOf(card(1), card(2), card(3)));
  await render(tree());
  expect(await screen.findByLabelText('Question: Question 3')).toBeTruthy();
  expect(screen.getByText('1 of 3')).toBeTruthy();
});

test('a needs-revisit topic opens on only the cards missed in its last quiz', async () => {
  mockProgress = { status: 'ready', byChunk: { row: { status: 'needs-revisit' } }, cachedEmpty: false };
  await seedHistory(['q2', 'q3'], { q2: weak, q3: weak });
  mockGet.mockResolvedValue(deckOf(card(1), card(2), card(3)));
  await render(tree());
  expect(await screen.findByText('Reviewing the 2 you missed')).toBeTruthy();
  expect(screen.getByLabelText('Question: Question 2')).toBeTruthy();
  expect(screen.getByText('1 of 2')).toBeTruthy();

  await fireEvent.press(screen.getByText('Show all cards'));
  expect(screen.queryByText('Reviewing the 2 you missed')).toBeNull();
  expect(screen.getByText('1 of 3')).toBeTruthy();
});

test('a needs-revisit topic with no history opens the full deck without a banner', async () => {
  mockProgress = { status: 'ready', byChunk: { row: { status: 'needs-revisit' } }, cachedEmpty: false };
  mockGet.mockResolvedValue(deckOf(card(1), card(2)));
  await render(tree());
  await screen.findByLabelText('Question: Question 1');
  expect(screen.queryByText(/you missed/)).toBeNull();
  expect(screen.getByText('1 of 2')).toBeTruthy();
});

test('the end of a missed-only pass offers the quiz and all cards', async () => {
  await seedHistory(['q2']);
  mockGet.mockResolvedValue(deckOf(card(1), card(2)));
  await render(treeWith({ chunkId: 'row', pass: { mode: 'missed-only', nonce: 1 } }));
  await screen.findByLabelText('Question: Question 2');
  await fireEvent.press(screen.getByText('Next'));
  expect(screen.getByText("You've been through the 1 you missed.", { exact: false })).toBeTruthy();
  expect(screen.getByText('Take the mini-quiz')).toBeTruthy();
  await fireEvent.press(screen.getByText('See all cards'));
  expect(screen.getByText('1 of 2')).toBeTruthy();
});

test('a missed-only pass param after a perfect score opens the full deck', async () => {
  await seedHistory([]);
  mockGet.mockResolvedValue(deckOf(card(1), card(2)));
  await render(treeWith({ chunkId: 'row', pass: { mode: 'missed-only', nonce: 1 } }));
  await screen.findByLabelText('Question: Question 1');
  expect(screen.queryByText(/you missed/)).toBeNull();
  expect(screen.getByText('1 of 2')).toBeTruthy();
});

test('a new pass param restarts the open viewer', async () => {
  mockGet.mockResolvedValue(deckOf(card(1), card(2), card(3)));
  const ref = createNavigationContainerRef();
  await render(
    <NavigationContainer ref={ref}>
      <Stack.Navigator>
        <Stack.Screen name="Flashcards" component={FlashcardScreen as never} initialParams={{ chunkId: 'row' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
  await screen.findByLabelText('Question: Question 1');
  await fireEvent.press(screen.getByText('Next'));
  await seedHistory(['q3']);
  await act(() => ref.setParams({ chunkId: 'row', pass: { mode: 'missed-only', nonce: 2 } } as never));
  expect(await screen.findByText('Reviewing the 1 you missed')).toBeTruthy();
  expect(screen.getByLabelText('Question: Question 3')).toBeTruthy();
  expect(mockGet).toHaveBeenCalledTimes(1);
});

test('Skip to quiz shows on the first card only and opens the quiz', async () => {
  mockGet.mockResolvedValue(deckOf(card(1), card(2)));
  await render(tree());
  await screen.findByLabelText('Question: Question 1');
  await fireEvent.press(screen.getByText('Next'));
  expect(screen.queryByText('Skip to quiz')).toBeNull();
  await fireEvent.press(screen.getByText('Previous'));
  await fireEvent.press(screen.getByText('Skip to quiz'));
  expect(await screen.findByText('Mini-quiz screen')).toBeTruthy();
});

test('resuming restores the saved pass order and card', async () => {
  await AsyncStorage.setItem(
    'dmv-app:study:deck-position:u1:row',
    JSON.stringify({ mode: 'full', cardIds: ['q3', 'q1', 'q2'], cardId: 'q1' })
  );
  mockGet.mockResolvedValue(deckOf(card(1), card(2), card(3)));
  await render(tree());
  expect(await screen.findByLabelText('Question: Question 1')).toBeTruthy();
  expect(screen.getByText('2 of 3')).toBeTruthy();
  await fireEvent.press(screen.getByText('Next'));
  expect(screen.getByLabelText('Question: Question 2')).toBeTruthy();
});
```

Update the existing resume tests: "reopening a topic resumes…" asserts
`JSON.parse((await AsyncStorage.getItem(KEY))!).cardId === 'q3'`; "finishing the deck clears…"
seeds `JSON.stringify({ mode: 'full', cardIds: ['q1', 'q2'], cardId: 'q2' })`; "a saved card that
is no longer in the deck…" seeds `JSON.stringify({ mode: 'full', cardIds: ['gone'], cardId: 'gone' })`.
Import `act` and `createNavigationContainerRef` alongside the existing imports.

- [ ] **Step 3: Run** `npm run test:components -- FlashcardScreen` — Expected: new tests FAIL.

- [ ] **Step 4: Implement** — rewrite the top-level screen and `Deck` in `src/study/FlashcardScreen.tsx`.
Keep `DeckErrorView`, the title effect, the last-opened effect and the styles. Replace imports of
`getDeckPosition`/`setDeckPosition`/`shuffled` with:

```ts
import { getDeckPass, setDeckPass, setLastOpenedTopic } from '../profile/localFlags';
import { readTopicHistory } from './cardPerformance';
import { NO_HISTORY, type TopicHistory } from './cardPerformanceData';
import { buildPass, restorePass, type PassMode } from './deckOrder';
```

Screen body (replacing `useSavedPosition` and the JSX after the error branch):

```tsx
interface Pass {
  /** Bumped for every new pass, so the Deck remounts at its start. */
  id: number;
  mode: PassMode;
  cards: Flashcard[];
  index: number;
}

export function FlashcardScreen({ navigation, route }: RootStackScreenProps<'Flashcards'>) {
  const { chunkId, pass: passParam } = route.params;
  const { uid } = useAuth();
  const deck = useFlashcardDeck(chunkId);
  const progress = useConceptProgress();
  const topics = useTopics();
  const [pass, setPass] = useState<Pass | null>(null);
  const passCount = useRef(0);
  const handledNonce = useRef<number | undefined>(undefined);

  // … title effect, remembered effect, marked effect (with cachedEmpty guard) unchanged …

  const startPass = useCallback(
    async (mode: PassMode, history?: TopicHistory) => {
      if (deck.status !== 'ready' || !uid) return;
      const h = history ?? (await readTopicHistory(uid, chunkId));
      const built = buildPass(deck.cards, h, mode);
      passCount.current += 1;
      setPass({ id: passCount.current, mode: built.mode, cards: built.cards, index: 0 });
    },
    [deck, uid, chunkId]
  );

  // First pass, once the deck and status are known: a saved pass resumes; otherwise a
  // needs-revisit topic gets its missed cards and anything else a full pass. A status read
  // that failed counts as "not needs-revisit" (full deck), which is always safe.
  const progressKnown = progress.status !== 'loading';
  useEffect(() => {
    if (pass || deck.status !== 'ready' || !uid || !progressKnown) return;
    if (passParam) return; // the param effect below starts it
    let cancelled = false;
    (async () => {
      const saved = await getDeckPass(uid, chunkId);
      const restored = saved ? restorePass(deck.cards, saved) : null;
      if (cancelled) return;
      if (restored) {
        passCount.current += 1;
        setPass({ id: passCount.current, ...restored });
        return;
      }
      const status = progress.status === 'ready' ? progressFor(progress.byChunk, chunkId).status : 'not-started';
      await startPass(status === 'needs-revisit' ? 'missed-only' : 'full');
    })();
    return () => {
      cancelled = true;
    };
  }, [pass, deck, uid, chunkId, progressKnown, progress, passParam, startPass]);

  // Review Again (Slice 4b): a new `pass` param restarts the open viewer with that pass,
  // reading fresh history (the quiz just recorded it). No new getFlashcards call.
  useEffect(() => {
    if (!passParam || passParam.nonce === handledNonce.current || deck.status !== 'ready' || !uid) return;
    handledNonce.current = passParam.nonce;
    void startPass(passParam.mode);
  }, [passParam, deck.status, uid, startPass]);

  const savePosition = useCallback(
    (p: Pass, cardId: string | null) => {
      if (!uid) return;
      void setDeckPass(uid, chunkId, cardId ? { mode: p.mode, cardIds: p.cards.map((c) => c.id), cardId } : null);
    },
    [uid, chunkId]
  );

  if (deck.status === 'error') {
    return <DeckErrorView error={deck.error} onRetry={deck.retry} onBack={() => navigation.goBack()} />;
  }
  if (deck.status === 'loading' || !pass) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Loading cards" />
      </View>
    );
  }
  return (
    <Deck
      key={pass.id}
      pass={pass}
      onMove={(cardId) => savePosition(pass, cardId)}
      onQuiz={() => navigation.navigate('MiniQuiz', { chunkId })}
      onAllCards={() => void startPass('full')}
    />
  );
}
```

Add `useCallback` to the React import. Note: the error branch now comes first, so an error
never waits on a pass.

`Deck`:

```tsx
interface DeckProps {
  pass: Pass;
  /** The card now showing, or `null` at the end of the deck. */
  onMove: (cardId: string | null) => void;
  onQuiz: () => void;
  /** "Show all cards", "See all cards" and "Start this concept over": a new full pass. */
  onAllCards: () => void;
}

function Deck({ pass, onMove, onQuiz, onAllCards }: DeckProps) {
  const [state, dispatch] = useReducer(
    (s: DeckState<Flashcard>, a: DeckAction<Flashcard>) => deckReducer(s, a),
    { cards: pass.cards, index: pass.index }
  );
  const missedOnly = pass.mode === 'missed-only';
  // … currentId / lastSaved / onMove effect and `pan` unchanged …

  const total = state.cards.length;
  if (state.index >= total) {
    return (
      <View style={[styles.screen, styles.end]} {...pan.panHandlers}>
        <Text style={typography.h1} accessibilityRole="header">
          End of this concept
        </Text>
        <Text style={[typography.body, styles.muted]}>
          {missedOnly
            ? `You've been through the ${total} you missed.`
            : total === 1
              ? "You've been through the only card in this concept."
              : `You've been through all ${total} cards.`}{' '}
          Check what stuck with a quick quiz, or go through them again.
        </Text>
        <Button label="Take the mini-quiz" onPress={onQuiz} />
        <Button
          label={missedOnly ? 'See all cards' : 'Start this concept over'}
          variant="secondary"
          onPress={onAllCards}
        />
        <Button label="Back to the last card" variant="text" onPress={() => dispatch({ type: 'previous' })} />
      </View>
    );
  }

  const card = state.cards[state.index];
  return (
    <View style={styles.screen} {...pan.panHandlers}>
      {missedOnly && (
        <View style={styles.banner}>
          <Text style={typography.bodySemibold}>{`Reviewing the ${total} you missed`}</Text>
          <Button label="Show all cards" variant="text" onPress={onAllCards} />
        </View>
      )}
      <Text style={[typography.small, styles.progress]}>
        {state.index + 1} of {total}
      </Text>
      <FlipCard key={`${state.index}-${card.id}`} card={card} />
      <View style={styles.nav}>
        {/* Previous / Next unchanged */}
      </View>
      {state.index === 0 && <Button label="Skip to quiz" variant="text" onPress={onQuiz} />}
    </View>
  );
}
```

Add a style: `banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.primarySoft, borderRadius: radius.row, paddingHorizontal: spacing.space3 }`
(import `radius`). "Start this concept over" now builds a weighted full pass from history, which
replaces 4a's plain reshuffle (ph-2-us-4). Remove `shuffled` from the imports; leave it exported
in `deck.ts` (its tests still use it). Update the header comment to describe passes.

- [ ] **Step 5: Run** `npm run test:components`, `npm run test:app`, `npx tsc --noEmit` — Expected: PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add src/navigation/types.ts src/study/FlashcardScreen.tsx src/study/FlashcardScreen.test.tsx
git commit -m "feat(ph-2-us-4): flashcards build weighted and missed-only passes; Skip to quiz"
```

---

### Task 7: Mini-quiz results component (ph-2-us-9)

**Files:**
- Create: `src/quiz/MiniQuizResults.tsx`; Test: `src/quiz/MiniQuizResults.test.tsx`

**Interfaces:**
- Consumes: `MiniQuizOutcome`, `scoreLine`, `recommendationLine`, `recommendedChoice` (Task 5);
  `NextStepChoice`.
- Produces: `export function MiniQuizResults(props: { outcome: MiniQuizOutcome; onChoice: (c: NextStepChoice) => void; onReview: () => void }): JSX.Element`.
  Button labels (exact): "Review Again", "Come Back Later, Continue to Next Concept", "Mark Reviewed", "Review answers".

- [ ] **Step 1: Failing tests** — `src/quiz/MiniQuizResults.test.tsx`

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { fromScoreResult } from './miniQuizData';
import { MiniQuizResults } from './MiniQuizResults';

const pq = (id: string, correct: boolean, choice: string | null) => ({
  questionId: id, chunkId: 'row', choice, correctAnswer: `Right ${id}`, correct, text: `Question ${id}`, choices: [], type: 'fact' as const,
});
const outcome = (score: number, rec: 'move-on' | 'review-again', perQuestion = [pq('a', false, 'Wrong a'), pq('b', true, 'Right b'), pq('c', false, null)]) =>
  fromScoreResult({ testId: 't1', type: 'mini-quiz', score, correctCount: 1, totalCount: 3, perTopic: [], perQuestion, recommendation: rec });

test('shows the score, recommendation, missed questions with your answer and the right one', async () => {
  await render(<MiniQuizResults outcome={outcome(0.33, 'review-again')} onChoice={jest.fn()} onReview={jest.fn()} />);
  expect(screen.getByText('1 of 3 · 33%')).toBeTruthy();
  expect(screen.getByText('Worth another look before moving on.')).toBeTruthy();
  expect(screen.getByText('Question a')).toBeTruthy();
  expect(screen.getByText('Your answer: Wrong a')).toBeTruthy();
  expect(screen.getByText('Right answer: Right a')).toBeTruthy();
  expect(screen.getByText('Your answer: Skipped')).toBeTruthy();
  expect(screen.queryByText('Question b')).toBeNull();
  expect(screen.getByText('You can restart any concept from the concept list.')).toBeTruthy();
});

test('every choice is enabled and reported; review answers is reported', async () => {
  const onChoice = jest.fn();
  const onReview = jest.fn();
  await render(<MiniQuizResults outcome={outcome(0.9, 'move-on')} onChoice={onChoice} onReview={onReview} />);
  for (const [label, choice] of [
    ['Review Again', 'review-again'],
    ['Come Back Later, Continue to Next Concept', 'come-back-later'],
    ['Mark Reviewed', 'mark-reviewed'],
  ] as const) {
    expect(screen.getByRole('button', { name: label }).props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(screen.getByText(label));
    expect(onChoice).toHaveBeenLastCalledWith(choice);
  }
  await fireEvent.press(screen.getByText('Review answers'));
  expect(onReview).toHaveBeenCalled();
});

test('the recommended choice is first and announced as recommended', async () => {
  await render(<MiniQuizResults outcome={outcome(0.9, 'move-on')} onChoice={jest.fn()} onReview={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Mark Reviewed' }).props.accessibilityHint).toBe('Recommended');
  expect(screen.getByRole('button', { name: 'Review Again' }).props.accessibilityHint).toBeUndefined();
});

test('no misses says so', async () => {
  await render(<MiniQuizResults outcome={outcome(1, 'move-on', [pq('b', true, 'Right b')])} onChoice={jest.fn()} onReview={jest.fn()} />);
  expect(screen.getByText('You got every one right.')).toBeTruthy();
});
```

- [ ] **Step 2: Run** `npm run test:components -- MiniQuizResults` — Expected: FAIL.

- [ ] **Step 3: Implement** `src/quiz/MiniQuizResults.tsx`

```tsx
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import type { NextStepChoice } from '../study/conceptProgressData';
import { colors, spacing, typography } from '../theme/tokens';
import { recommendationLine, recommendedChoice, scoreLine, type MiniQuizOutcome } from './miniQuizData';

// ph-2-us-9: after a mini-quiz, the score, a recommendation (never a gate) and what was missed,
// then the three next steps. The recommended one comes first in the primary style; the others
// stay enabled. Encouraging, not graded-feeling.

const CHOICES: { choice: NextStepChoice; label: string }[] = [
  { choice: 'review-again', label: 'Review Again' },
  { choice: 'come-back-later', label: 'Come Back Later, Continue to Next Concept' },
  { choice: 'mark-reviewed', label: 'Mark Reviewed' },
];

export function MiniQuizResults({
  outcome,
  onChoice,
  onReview,
}: {
  outcome: MiniQuizOutcome;
  onChoice: (choice: NextStepChoice) => void;
  onReview: () => void;
}) {
  const recommended = recommendedChoice(outcome.recommendation);
  const ordered = [...CHOICES].sort((a, b) => Number(b.choice === recommended) - Number(a.choice === recommended));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={typography.stat} accessibilityRole="header">
        {scoreLine(outcome)}
      </Text>
      <Text style={typography.body}>{recommendationLine(outcome.recommendation)}</Text>

      <Text style={typography.h2}>What you missed</Text>
      {outcome.missed.length === 0 ? (
        <Text style={[typography.body, styles.muted]}>You got every one right.</Text>
      ) : (
        outcome.missed.map((item) => (
          <Card key={item.questionId}>
            <View style={styles.missed}>
              <Text style={typography.bodySemibold}>{item.text ?? 'This question was removed.'}</Text>
              <Text style={typography.small}>{`Your answer: ${item.choice ?? 'Skipped'}`}</Text>
              {item.correctAnswer && (
                <Text style={[typography.small, styles.right]}>{`Right answer: ${item.correctAnswer}`}</Text>
              )}
            </View>
          </Card>
        ))
      )}
      <Button label="Review answers" variant="text" onPress={onReview} />

      <View style={styles.choices}>
        {ordered.map(({ choice, label }) => (
          <Button
            key={choice}
            label={label}
            variant={choice === recommended ? 'primary' : 'secondary'}
            accessibilityHint={choice === recommended ? 'Recommended' : undefined}
            onPress={() => onChoice(choice)}
          />
        ))}
      </View>
      <Text style={[typography.small, styles.muted]}>You can restart any concept from the concept list.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.space5, gap: spacing.space3 },
  missed: { gap: spacing.space1 },
  right: { color: colors.success },
  muted: { color: colors.inkSoft },
  choices: { gap: spacing.space2, marginTop: spacing.space3 },
});
```

- [ ] **Step 4: Run** `npm run test:components -- MiniQuizResults` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/quiz/MiniQuizResults.tsx src/quiz/MiniQuizResults.test.tsx
git commit -m "feat(ph-2-us-9): mini-quiz results with recommendation and next steps"
```

---

### Task 8: Mini-quiz screen and the three choices (ph-2-us-8, ph-2-us-9)

**Files:**
- Create: `src/quiz/MiniQuizScreen.tsx`; Test: `src/quiz/miniQuizFlow.test.tsx`
- Modify: `src/navigation/RootNavigator.tsx`

**Interfaces:**
- Consumes: `assembleMiniQuiz`, `scoreTest` (`src/api/callables.ts`); `toCallableError`;
  `QuizRunner`, `SubmitState`; `toAnswerList`; `useIsOnline`; `useAuth`; `useTopics`;
  `useConceptProgress`, `progressFor`, `markOpened`, `setStatusFromChoice`; `recordQuizResults`
  (Task 3); `useTestAttempt` (`src/review/useTestAttempt.ts`); `MiniQuizResults` (Task 7);
  `fromScoreResult`, `fromAttempt`, `rememberQuiz`, `lastQuizIds`, `nextTopicId`,
  `routesForNextTopic` (Task 5).
- Produces: `export function MiniQuizScreen({ navigation, route }: RootStackScreenProps<'MiniQuiz'>)`.

- [ ] **Step 1: Failing flow tests** — `src/quiz/miniQuizFlow.test.tsx`. Mock pattern follows
`src/baseline/baselineFlow.test.tsx` (callables, auth, NetInfo via `useIsOnline`, topics,
`useTestAttempt`) plus `../study/conceptProgress` (`markOpened`, `setStatusFromChoice`) and
`../study/useConceptProgress`. Use a real stack so navigation is observable:

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Text } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { createNavigationContainerRef, NavigationContainer, useRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { assembleMiniQuiz, scoreTest } from '../api/callables';
import { CallableError } from '../api/callableErrors';
import type { QuizQuestion, ScoreTestResult } from '../api/types';
import { markOpened, setStatusFromChoice } from '../study/conceptProgress';
import { MiniQuizScreen } from './MiniQuizScreen';

jest.mock('@react-native-firebase/app', () => ({ getApp: jest.fn() }));
jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ status: 'ready', uid: 'u1' }) }));
jest.mock('../api/callables', () => ({ assembleMiniQuiz: jest.fn(), scoreTest: jest.fn() }));
jest.mock('../study/conceptProgress', () => ({ markOpened: jest.fn(), setStatusFromChoice: jest.fn() }));
jest.mock('../study/useConceptProgress', () => ({
  useConceptProgress: () => ({ status: 'ready', byChunk: {}, cachedEmpty: false }),
}));
jest.mock('../topics/useTopics', () => ({
  useTopics: () => ({
    status: 'ready',
    topics: [
      { chunkId: 'row', title: 'Right of way', description: '', order: 1, approvedQuestionCount: 3 },
      { chunkId: 'empty', title: 'Empty', description: '', order: 2, approvedQuestionCount: 0 },
      { chunkId: 'signs', title: 'Signs', description: '', order: 3, approvedQuestionCount: 3 },
    ],
    retry: jest.fn(),
  }),
}));
let mockAttempt: { status: string; data?: Record<string, unknown>; offline?: boolean } = { status: 'loading' };
jest.mock('../review/useTestAttempt', () => ({
  useTestAttempt: (testId: string | null) =>
    testId ? { ...mockAttempt, retry: jest.fn() } : { status: 'loading', retry: jest.fn() },
}));
let mockOnline = true;
jest.mock('../network/useIsOnline', () => ({ useIsOnline: () => mockOnline }));

const q = (n: number): QuizQuestion => ({ id: `q${n}`, text: `Question ${n}`, choices: [`A${n}`, `B${n}`], type: 'fact', chunkId: 'row', conceptId: 'k' });
const graded = (rec: 'move-on' | 'review-again', correct = [true, false]): ScoreTestResult => ({
  testId: 't1', type: 'mini-quiz', score: correct.filter(Boolean).length / correct.length,
  correctCount: correct.filter(Boolean).length, totalCount: correct.length, perTopic: [],
  perQuestion: correct.map((c, i) => ({ questionId: `q${i + 1}`, chunkId: 'row', choice: `A${i + 1}`, correctAnswer: c ? `A${i + 1}` : `B${i + 1}`, correct: c, text: `Question ${i + 1}` })),
  recommendation: rec,
});

function Named({ label }: { label: string }) {
  const params = useRoute().params as Record<string, unknown> | undefined;
  return <Text>{`${label} ${JSON.stringify(params ?? {})}`}</Text>;
}
const Stack = createNativeStackNavigator();
const ref = createNavigationContainerRef();
async function renderFlow() {
  await render(
    <NavigationContainer ref={ref}>
      <Stack.Navigator initialRouteName="Main">
        <Stack.Screen name="Main">{() => <Named label="Main" />}</Stack.Screen>
        <Stack.Screen name="Flashcards">{() => <Named label="Flashcards" />}</Stack.Screen>
        <Stack.Screen name="MiniQuiz" component={MiniQuizScreen as never} />
        <Stack.Screen name="Review">{() => <Named label="Review" />}</Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
  await act(() => ref.navigate('Flashcards' as never, { chunkId: 'row' } as never));
  await act(() => ref.navigate('MiniQuiz' as never, { chunkId: 'row' } as never));
}
async function answerAllAndSubmit(n: number) {
  for (let i = 1; i <= n; i++) {
    await fireEvent.press(await screen.findByText(`A${i}`));
    if (i < n) await fireEvent.press(screen.getByText('Next'));
  }
  await fireEvent.press(screen.getByText('Submit'));
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockOnline = true;
  mockAttempt = { status: 'loading' };
  (assembleMiniQuiz as jest.Mock).mockResolvedValue({ testId: 't1', questions: [q(1), q(2)] });
});
```

Tests:

```tsx
test('loads a topic-sized quiz with no count, marks the topic opened, and grades it', async () => {
  (scoreTest as jest.Mock).mockResolvedValue(graded('review-again'));
  await renderFlow();
  expect(await screen.findByText('Question 1')).toBeTruthy();
  expect(assembleMiniQuiz).toHaveBeenCalledWith({ chunkId: 'row', excludeIds: [] });
  expect(markOpened).toHaveBeenCalledWith('u1', 'row', 'not-started');
  await answerAllAndSubmit(2);
  expect(await screen.findByText('1 of 2 · 50%')).toBeTruthy();
  expect(scoreTest).toHaveBeenCalledWith({ testId: 't1', answers: [{ questionId: 'q1', choice: 'A1' }, { questionId: 'q2', choice: 'A2' }] });
  // card performance recorded before results show
  expect(JSON.parse((await AsyncStorage.getItem('dmv-app:card-perf:u1:row'))!).lastQuizMissedIds).toEqual(['q2']);
});

test('a retake passes the previous quiz as excludeIds', async () => {
  (scoreTest as jest.Mock).mockResolvedValue(graded('move-on', [true, true]));
  await renderFlow();
  await answerAllAndSubmit(2);
  await screen.findByText('2 of 2 · 100%');
  await act(() => ref.navigate('Flashcards' as never, { chunkId: 'row' } as never));
  await act(() => ref.navigate('MiniQuiz' as never, { chunkId: 'row' } as never));
  await waitFor(() => expect(assembleMiniQuiz).toHaveBeenLastCalledWith({ chunkId: 'row', excludeIds: ['q1', 'q2'] }));
});

test('Review Again pops back to the flashcards with a missed-only pass', async () => {
  (scoreTest as jest.Mock).mockResolvedValue(graded('review-again'));
  await renderFlow();
  await answerAllAndSubmit(2);
  await fireEvent.press(await screen.findByText('Review Again'));
  expect(setStatusFromChoice).toHaveBeenCalledWith('u1', 'row', 'review-again');
  expect(await screen.findByText(/^Flashcards .*"chunkId":"row".*"mode":"missed-only"/)).toBeTruthy();
  expect(ref.getRootState().routes.map((r) => r.name)).toEqual(['Main', 'Flashcards']);
});

test('Come Back Later opens the next topic with questions, replacing this topic', async () => {
  (scoreTest as jest.Mock).mockResolvedValue(graded('review-again'));
  await renderFlow();
  await answerAllAndSubmit(2);
  await fireEvent.press(await screen.findByText('Come Back Later, Continue to Next Concept'));
  expect(setStatusFromChoice).toHaveBeenCalledWith('u1', 'row', 'come-back-later');
  expect(await screen.findByText(/^Flashcards .*"chunkId":"signs"/)).toBeTruthy();
  expect(ref.getRootState().routes.map((r) => r.name)).toEqual(['Main', 'Flashcards']);
});

test('Mark Reviewed returns to the concept list', async () => {
  (scoreTest as jest.Mock).mockResolvedValue(graded('move-on', [true, true]));
  await renderFlow();
  await answerAllAndSubmit(2);
  await fireEvent.press(await screen.findByText('Mark Reviewed'));
  expect(setStatusFromChoice).toHaveBeenCalledWith('u1', 'row', 'mark-reviewed');
  expect(await screen.findByText(/^Main .*"screen":"Study"/)).toBeTruthy();
});

test('a double tap on a choice writes and navigates once', async () => {
  (scoreTest as jest.Mock).mockResolvedValue(graded('move-on', [true, true]));
  await renderFlow();
  await answerAllAndSubmit(2);
  const button = await screen.findByText('Mark Reviewed');
  // Both taps land before navigation re-renders (one act), like a real double tap.
  await act(() => {
    fireEvent.press(button);
    fireEvent.press(button);
  });
  expect(setStatusFromChoice).toHaveBeenCalledTimes(1);
});

test('Review answers opens the review for this quiz', async () => {
  (scoreTest as jest.Mock).mockResolvedValue(graded('review-again'));
  await renderFlow();
  await answerAllAndSubmit(2);
  await fireEvent.press(await screen.findByText('Review answers'));
  expect(await screen.findByText('Review {"testId":"t1"}')).toBeTruthy();
});

test('leaving the results without choosing writes no status', async () => {
  (scoreTest as jest.Mock).mockResolvedValue(graded('review-again'));
  await renderFlow();
  await answerAllAndSubmit(2);
  await screen.findByText('1 of 2 · 50%');
  await act(() => ref.goBack());
  expect(setStatusFromChoice).not.toHaveBeenCalled();
});

test('offline at submit holds the answers and sends them on reconnect', async () => {
  (scoreTest as jest.Mock).mockResolvedValue(graded('review-again'));
  await renderFlow();
  mockOnline = false;
  // force a re-render so the screen reads the new value
  await answerAllAndSubmit(2);
  expect(await screen.findByText("Your answers are saved. We'll submit as soon as you're back online.")).toBeTruthy();
  expect(scoreTest).not.toHaveBeenCalled();
});
```

For the offline test, use the subscribable `useIsOnline` mock and `setOnline` helper from
`baselineFlow.test.tsx` instead of the plain variable (copy them), then
`await setOnline(true)` and assert `await screen.findByText('1 of 2 · 50%')`.

```tsx
test('already graded: shows the saved attempt and records it', async () => {
  (scoreTest as jest.Mock).mockRejectedValue(new CallableError('already-exists', 'already-exists', 'scored'));
  mockAttempt = { status: 'ready', data: { type: 'mini-quiz', ...graded('review-again') } };
  await renderFlow();
  await answerAllAndSubmit(2);
  expect(await screen.findByText('1 of 2 · 50%')).toBeTruthy();
  await waitFor(async () => expect(await AsyncStorage.getItem('dmv-app:card-perf:u1:row')).not.toBeNull());
});

test('already graded but the attempt cannot be read offline: No connection with Try again', async () => {
  (scoreTest as jest.Mock).mockRejectedValue(new CallableError('already-exists', 'already-exists', 'scored'));
  mockAttempt = { status: 'error', offline: true };
  await renderFlow();
  await answerAllAndSubmit(2);
  expect(await screen.findByText('No connection')).toBeTruthy();
  expect(screen.getByText('Try again')).toBeTruthy();
});

test.each([
  [new CallableError('not-found', 'not-found', 'none'), 'Nothing here yet'],
  [new CallableError('offline', 'unavailable', 'net'), 'No connection'],
  [new CallableError('unknown', 'internal', 'boom'), 'Something went wrong'],
])('a %s at load shows "%s"', async (error, title) => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  (assembleMiniQuiz as jest.Mock).mockRejectedValue(error);
  await renderFlow();
  expect(await screen.findByText(title)).toBeTruthy();
});

test('a submit error keeps the answers with Try again', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  (scoreTest as jest.Mock).mockRejectedValueOnce(new CallableError('unknown', 'internal', 'boom')).mockResolvedValueOnce(graded('review-again'));
  await renderFlow();
  await answerAllAndSubmit(2);
  await fireEvent.press(await screen.findByText('Try again'));
  expect(await screen.findByText('1 of 2 · 50%')).toBeTruthy();
});

test('leaving mid-quiz asks first', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await renderFlow();
  await screen.findByText('Question 1');
  await act(() => ref.goBack());
  expect(alert).toHaveBeenCalledWith('Leave the quiz?', expect.any(String), expect.any(Array));
});
```

- [ ] **Step 2: Run** `npm run test:components -- miniQuizFlow` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement** `src/quiz/MiniQuizScreen.tsx`

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CommonActions, usePreventRemove } from '@react-navigation/native';
import { assembleMiniQuiz, scoreTest } from '../api/callables';
import { toCallableError } from '../api/callableErrors';
import type { QuizQuestion } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { NoConnection } from '../components/NoConnection';
import type { RootStackScreenProps } from '../navigation/types';
import { useIsOnline } from '../network/useIsOnline';
import { useTestAttempt } from '../review/useTestAttempt';
import { recordQuizResults } from '../study/cardPerformance';
import { markOpened, setStatusFromChoice } from '../study/conceptProgress';
import { progressFor, type NextStepChoice } from '../study/conceptProgressData';
import { useConceptProgress } from '../study/useConceptProgress';
import { colors, spacing, typography } from '../theme/tokens';
import { useTopics } from '../topics/useTopics';
import { toAnswerList, type Answers } from './answers';
import {
  fromAttempt,
  fromScoreResult,
  lastQuizIds,
  nextTopicId,
  rememberQuiz,
  routesForNextTopic,
  type MiniQuizOutcome,
} from './miniQuizData';
import { MiniQuizResults } from './MiniQuizResults';
import { QuizRunner, type SubmitState } from './QuizRunner';

// ph-2-us-8 / ph-2-us-9: one topic's mini-quiz on the shared runner, then its results and the
// three next steps. Not kept in quizSession (that holds one active test, the baseline's): a
// killed quiz is simply abandoned and the next one gets a new testId. Offline at submit, the
// answers are held on screen and sent on reconnect.

type Phase =
  | { kind: 'loading' }
  | { kind: 'running'; testId: string; questions: QuizQuestion[] }
  | { kind: 'results'; outcome: MiniQuizOutcome }
  /** scoreTest said it was already graded: read the saved attempt instead. */
  | { kind: 'recovering'; testId: string }
  | { kind: 'empty' }
  | { kind: 'offline' }
  | { kind: 'error' };

export function MiniQuizScreen({ navigation, route }: RootStackScreenProps<'MiniQuiz'>) {
  const { chunkId } = route.params;
  const { uid } = useAuth();
  const isOnline = useIsOnline();
  const progress = useConceptProgress();
  const topics = useTopics();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const submittingRef = useRef(false);
  const heldAnswersRef = useRef<Answers | null>(null);
  const choseRef = useRef(false);

  const title = topics.status === 'ready' ? topics.topics.find((t) => t.chunkId === chunkId)?.title : undefined;
  useEffect(() => {
    if (title) navigation.setOptions({ title: `Mini-quiz · ${title}` });
  }, [navigation, title]);

  // Opening the quiz counts as opening the topic, from a known status only (ph-2-us-10).
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current || !uid || progress.status !== 'ready' || progress.cachedEmpty) return;
    marked.current = true;
    markOpened(uid, chunkId, progressFor(progress.byChunk, chunkId).status);
  }, [uid, chunkId, progress]);

  const load = useCallback(async () => {
    if (!uid) return;
    setPhase({ kind: 'loading' });
    setSubmitState('idle');
    try {
      // No count: the server sizes the quiz from the topic (Slice 4b).
      const { testId, questions } = await assembleMiniQuiz({ chunkId, excludeIds: lastQuizIds(chunkId) });
      rememberQuiz(chunkId, questions.map((q) => q.id));
      setPhase({ kind: 'running', testId, questions });
    } catch (raw) {
      const error = toCallableError(raw);
      if (error.kind !== 'offline') console.warn('[miniQuiz] load failed', error);
      setPhase({ kind: error.kind === 'not-found' ? 'empty' : error.kind === 'offline' ? 'offline' : 'error' });
    }
  }, [uid, chunkId]);

  useEffect(() => {
    void load();
  }, [load]);

  const showResults = useCallback(
    async (outcome: MiniQuizOutcome) => {
      if (uid) await recordQuizResults(uid, outcome.perQuestion);
      setPhase({ kind: 'results', outcome });
    },
    [uid]
  );

  const submit = useCallback(
    async (answers: Answers) => {
      if (phase.kind !== 'running' || submittingRef.current) return;
      if (!isOnline) {
        heldAnswersRef.current = answers;
        setSubmitState('waiting-for-connection');
        return;
      }
      submittingRef.current = true;
      setSubmitState('submitting');
      try {
        const result = await scoreTest({ testId: phase.testId, answers: toAnswerList(phase.questions, answers) });
        heldAnswersRef.current = null;
        await showResults(fromScoreResult(result));
      } catch (raw) {
        const error = toCallableError(raw);
        if (error.kind === 'already-exists') {
          // Graded already (an earlier response was lost): show what was saved.
          setPhase({ kind: 'recovering', testId: phase.testId });
        } else {
          console.warn('[miniQuiz] submit failed', error);
          setSubmitState('error');
        }
      } finally {
        submittingRef.current = false;
      }
    },
    [phase, isOnline, showResults]
  );

  useEffect(() => {
    if (isOnline && submitState === 'waiting-for-connection' && heldAnswersRef.current) {
      const answers = heldAnswersRef.current;
      heldAnswersRef.current = null;
      void submit(answers);
    }
  }, [isOnline, submitState, submit]);

  usePreventRemove(phase.kind === 'running' && submitState !== 'submitting', ({ data }) => {
    Alert.alert('Leave the quiz?', "Your answers won't be saved. You can take a new quiz any time.", [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const choose = useCallback(
    (choice: NextStepChoice) => {
      if (choseRef.current || !uid) return;
      choseRef.current = true;
      setStatusFromChoice(uid, chunkId, choice); // queued by Firestore offline; never awaited
      if (choice === 'review-again') {
        navigation.popTo('Flashcards', { chunkId, pass: { mode: 'missed-only', nonce: Date.now() } });
        return;
      }
      const next =
        choice === 'come-back-later' && topics.status === 'ready' ? nextTopicId(topics.topics, chunkId) : null;
      if (next) {
        navigation.dispatch((state) => {
          const routes = routesForNextTopic(state.routes, next);
          return CommonActions.reset({ ...state, routes: routes as typeof state.routes, index: routes.length - 1 });
        });
        return;
      }
      navigation.popTo('Main', { screen: 'Study', params: { screen: 'StudyHome' } });
    },
    [uid, chunkId, navigation, topics]
  );

  switch (phase.kind) {
    case 'loading':
      return (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} accessibilityLabel="Loading the quiz" />
        </View>
      );
    case 'running':
      return (
        <QuizRunner
          key={phase.testId}
          questions={phase.questions}
          title={title ? `Mini-quiz · ${title}` : 'Mini-quiz'}
          onSubmit={(answers) => void submit(answers)}
          submitState={submitState}
          isOnline={isOnline}
        />
      );
    case 'recovering':
      return <Recovered testId={phase.testId} onReady={(o) => void showResults(o)} />;
    case 'results':
      return (
        <MiniQuizResults
          outcome={phase.outcome}
          onChoice={choose}
          onReview={() => navigation.navigate('Review', { testId: phase.outcome.testId })}
        />
      );
    case 'empty':
      return (
        <View style={styles.center}>
          <Text style={typography.h1}>Nothing here yet</Text>
          <Text style={[typography.body, styles.muted]}>Questions for this concept are still being written.</Text>
          <Button label="Back" onPress={() => navigation.goBack()} style={styles.wide} />
        </View>
      );
    case 'offline':
      return <NoConnection message="The quiz needs a connection to load. Check your connection and try again." onRetry={() => void load()} />;
    case 'error':
      return <NoConnection title="Something went wrong" message="We couldn't load the quiz. Try again in a moment." onRetry={() => void load()} />;
  }
}

/** Reads the saved attempt after `already-exists`, then hands its outcome up once. */
function Recovered({ testId, onReady }: { testId: string; onReady: (o: MiniQuizOutcome) => void }) {
  const attempt = useTestAttempt(testId);
  const outcome = attempt.status === 'ready' ? fromAttempt(testId, attempt.data) : null;
  const sent = useRef(false);
  useEffect(() => {
    if (outcome && !sent.current) {
      sent.current = true;
      onReady(outcome);
    }
  }, [outcome, onReady]);

  if (attempt.status === 'error' || (attempt.status === 'ready' && !outcome)) {
    return (
      <NoConnection
        title={attempt.status === 'error' && attempt.offline ? 'No connection' : 'Something went wrong'}
        message="Your quiz was graded, but its results couldn't load. Try again."
        onRetry={attempt.retry}
      />
    );
  }
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} accessibilityLabel="Loading your results" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.space5,
    gap: spacing.space2,
  },
  muted: { color: colors.inkSoft, textAlign: 'center' },
  wide: { marginTop: spacing.space5, paddingHorizontal: spacing.space6 },
});
```

Note: `Recovered`'s `fromAttempt` returns a new object each render; the `sent` ref keeps
`onReady` to one call. If `useTestAttempt`'s retry is used, `sent` is still false until a
usable outcome arrives.

- [ ] **Step 4: Register the screen** — in `src/navigation/RootNavigator.tsx` replace the
`MiniQuiz` placeholder block with:

```tsx
        <RootStack.Screen name="MiniQuiz" component={MiniQuizScreen} options={{ title: 'Mini-quiz' }} />
```

import `MiniQuizScreen` from `'../quiz/MiniQuizScreen'`, and update the header comment
("the mini-quiz placeholder" → "the mini-quiz").

- [ ] **Step 5: Run** `npm run test:components`, `npx tsc --noEmit` — Expected: PASS, clean. If
`popTo`'s typed params complain about the nested `Main` params, type the call as
`navigation.popTo('Main', { screen: 'Study', params: { screen: 'StudyHome' } } as never)` and
check `RootTabParamList.Study` is `NavigatorScreenParams<StudyStackParamList> | undefined`
(change it in `types.ts` if it's `undefined`).

- [ ] **Step 6: Commit**

```bash
git add src/quiz/MiniQuizScreen.tsx src/quiz/miniQuizFlow.test.tsx src/navigation
git commit -m "feat(ph-2-us-8): mini-quiz screen with results and next-step choices"
```

---

### Task 9: Concept strength rule, rows and sort (ph-4-us-6)

**Files:**
- Create: `src/progress/conceptStrength.ts`; Test: `src/progress/conceptStrength.test.ts`

**Interfaces:**
- Consumes: `Topic`, `ProgressMap`, `progressFor`, `TopicResult` (`src/results/baselineResultsData.ts`).
- Produces:
  ```ts
  export type Strength = 'strong' | 'shaky' | 'likely-gap' | 'got-it' | 'missed-it' | 'not-tested';
  export type StrengthSource = 'mini-quiz' | 'practice' | 'baseline' | 'none';
  export interface ConceptEvidence { miniQuiz?: { score: number; correct?: number; total?: number }; practice?: { correct: number; total: number }; baseline?: 'got-it' | 'missed-it' }
  export interface StrengthResult { strength: Strength; source: StrengthSource; correct?: number; total?: number; percent?: number }
  export const STRONG_AT = 0.8; export const SHAKY_AT = 0.5; export const MIN_PRACTICE_ANSWERS = 3;
  export const STRENGTH_LABEL: Record<Strength, string>;
  export function conceptStrength(e: ConceptEvidence): StrengthResult
  export function basisLine(r: StrengthResult): string
  export interface ReportRow { chunkId: string; title: string; comingSoon: boolean; result: StrengthResult }
  export type ReportSort = 'handbook' | 'needs-work';
  export function toReportRows(topics: Topic[], progress: ProgressMap, baseline: Map<string, 'got-it' | 'missed-it'>): ReportRow[]
  export function sortRows(rows: ReportRow[], sort: ReportSort): ReportRow[]
  export function hasEvidence(rows: ReportRow[]): boolean
  ```

- [ ] **Step 1: Failing tests** — `src/progress/conceptStrength.test.ts`

```ts
import type { Topic } from '../topics/topicsData';
import { basisLine, conceptStrength, hasEvidence, sortRows, toReportRows } from './conceptStrength';

test.each([
  [0.8, 'strong'], [1, 'strong'], [0.79, 'shaky'], [0.5, 'shaky'], [0.49, 'likely-gap'], [0, 'likely-gap'],
])('mini-quiz %p → %s', (score, strength) => {
  expect(conceptStrength({ miniQuiz: { score } }).strength).toBe(strength);
});

test('mini-quiz wins over practice and baseline', () => {
  expect(conceptStrength({ miniQuiz: { score: 0.6 }, practice: { correct: 3, total: 3 }, baseline: 'got-it' })).toMatchObject({
    strength: 'shaky', source: 'mini-quiz',
  });
});

test('practice needs at least 3 answers', () => {
  expect(conceptStrength({ practice: { correct: 2, total: 2 }, baseline: 'missed-it' })).toMatchObject({ strength: 'missed-it', source: 'baseline' });
  expect(conceptStrength({ practice: { correct: 2, total: 3 } })).toMatchObject({ strength: 'shaky', source: 'practice', correct: 2, total: 3 });
});

test('baseline only is got it / missed it; nothing is not tested', () => {
  expect(conceptStrength({ baseline: 'got-it' }).strength).toBe('got-it');
  expect(conceptStrength({ baseline: 'missed-it' }).strength).toBe('missed-it');
  expect(conceptStrength({})).toEqual({ strength: 'not-tested', source: 'none' });
});

test('basis lines', () => {
  expect(basisLine(conceptStrength({ miniQuiz: { score: 0.67, correct: 10, total: 15 } }))).toBe('10 of 15 right in your latest quiz');
  expect(basisLine(conceptStrength({ miniQuiz: { score: 0.7 } }))).toBe('70% in your latest quiz');
  expect(basisLine(conceptStrength({ practice: { correct: 4, total: 5 } }))).toBe('4 of 5 right in practice tests');
  expect(basisLine(conceptStrength({ baseline: 'got-it' }))).toBe('From 1 baseline question');
  expect(basisLine(conceptStrength({}))).toBe('Not tested yet');
});

const topic = (chunkId: string, order: number, approvedQuestionCount = 5): Topic => ({ chunkId, title: chunkId.toUpperCase(), description: '', order, approvedQuestionCount });
const topics = [topic('a', 1), topic('b', 2), topic('c', 3), topic('d', 4), topic('e', 5, 0)];
const progress = {
  a: { status: 'reviewed' as const, latestMiniQuizScore: 0.9, latestMiniQuizCorrect: 9, latestMiniQuizTotal: 10 },
  c: { status: 'in-progress' as const, latestMiniQuizScore: 0.6 },
};
const baseline = new Map<string, 'got-it' | 'missed-it'>([['b', 'missed-it'], ['c', 'got-it']]);

test('rows in handbook order with each topic’s best evidence', () => {
  const rows = toReportRows(topics, progress, baseline);
  expect(rows.map((r) => [r.chunkId, r.result.strength, r.comingSoon])).toEqual([
    ['a', 'strong', false], ['b', 'missed-it', false], ['c', 'shaky', false], ['d', 'not-tested', false], ['e', 'not-tested', true],
  ]);
});

test('needs work first: gap and missed, shaky, not tested, strong and got it; handbook order within', () => {
  const rows = toReportRows(
    [...topics, topic('f', 6)],
    { ...progress, f: { status: 'in-progress', latestMiniQuizScore: 0.1 } },
    baseline
  );
  expect(sortRows(rows, 'needs-work').map((r) => r.chunkId)).toEqual(['b', 'f', 'c', 'd', 'e', 'a']);
  expect(sortRows(rows, 'handbook').map((r) => r.chunkId)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
});

test('hasEvidence is false only when every topic is not tested', () => {
  expect(hasEvidence(toReportRows(topics, {}, new Map()))).toBe(false);
  expect(hasEvidence(toReportRows(topics, progress, new Map()))).toBe(true);
});
```

- [ ] **Step 2: Run** `npm run test:app -- conceptStrength` — Expected: FAIL.

- [ ] **Step 3: Implement** `src/progress/conceptStrength.ts`

```ts
import { progressFor, type ProgressMap } from '../study/conceptProgressData';
import type { Topic } from '../topics/topicsData';

// ph-4-us-6: how well each topic is known, from answers (not the user's own status). The one
// place the strength rule lives: the latest mini-quiz, else enough practice answers, else the
// one baseline question, else not tested. Always shown as a rough guide. Pure, so it runs
// under Node.

export type Strength = 'strong' | 'shaky' | 'likely-gap' | 'got-it' | 'missed-it' | 'not-tested';
export type StrengthSource = 'mini-quiz' | 'practice' | 'baseline' | 'none';

export interface ConceptEvidence {
  miniQuiz?: { score: number; correct?: number; total?: number };
  /** Practice-test answers on this topic. Filled from Slice 5a. */
  practice?: { correct: number; total: number };
  baseline?: 'got-it' | 'missed-it';
}

export interface StrengthResult {
  strength: Strength;
  source: StrengthSource;
  correct?: number;
  total?: number;
  /** Whole percent, for mini-quiz scores saved without counts. */
  percent?: number;
}

export const STRONG_AT = 0.8; // matches the real test's pass mark
export const SHAKY_AT = 0.5;
export const MIN_PRACTICE_ANSWERS = 3;

export const STRENGTH_LABEL: Record<Strength, string> = {
  strong: 'Strong',
  shaky: 'Shaky',
  'likely-gap': 'Likely gap',
  'got-it': 'Got it',
  'missed-it': 'Missed it',
  'not-tested': 'Not tested yet',
};

function band(ratio: number): Strength {
  return ratio >= STRONG_AT ? 'strong' : ratio >= SHAKY_AT ? 'shaky' : 'likely-gap';
}

export function conceptStrength(e: ConceptEvidence): StrengthResult {
  if (e.miniQuiz) {
    const { score, correct, total } = e.miniQuiz;
    return correct !== undefined && total !== undefined
      ? { strength: band(score), source: 'mini-quiz', correct, total }
      : { strength: band(score), source: 'mini-quiz', percent: Math.round(score * 100) };
  }
  if (e.practice && e.practice.total >= MIN_PRACTICE_ANSWERS) {
    const { correct, total } = e.practice;
    return { strength: band(correct / total), source: 'practice', correct, total };
  }
  if (e.baseline) return { strength: e.baseline, source: 'baseline' };
  return { strength: 'not-tested', source: 'none' };
}

export function basisLine(r: StrengthResult): string {
  switch (r.source) {
    case 'mini-quiz':
      return r.correct !== undefined && r.total !== undefined
        ? `${r.correct} of ${r.total} right in your latest quiz`
        : `${r.percent}% in your latest quiz`;
    case 'practice':
      return `${r.correct} of ${r.total} right in practice tests`;
    case 'baseline':
      return 'From 1 baseline question';
    case 'none':
      return 'Not tested yet';
  }
}

export interface ReportRow {
  chunkId: string;
  title: string;
  comingSoon: boolean;
  result: StrengthResult;
}

export type ReportSort = 'handbook' | 'needs-work';

export function toReportRows(
  topics: Topic[],
  progress: ProgressMap,
  baseline: Map<string, 'got-it' | 'missed-it'>
): ReportRow[] {
  return topics.map((t) => {
    const p = progressFor(progress, t.chunkId);
    const evidence: ConceptEvidence = {
      ...(p.latestMiniQuizScore !== undefined
        ? { miniQuiz: { score: p.latestMiniQuizScore, correct: p.latestMiniQuizCorrect, total: p.latestMiniQuizTotal } }
        : {}),
      ...(baseline.has(t.chunkId) ? { baseline: baseline.get(t.chunkId) } : {}),
    };
    return { chunkId: t.chunkId, title: t.title, comingSoon: t.approvedQuestionCount === 0, result: conceptStrength(evidence) };
  });
}

const NEEDS_WORK_RANK: Record<Strength, number> = {
  'likely-gap': 0,
  'missed-it': 0,
  shaky: 1,
  'not-tested': 2,
  strong: 3,
  'got-it': 3,
};

/** Rows arrive in handbook order; the sort is stable, so that order holds within a group. */
export function sortRows(rows: ReportRow[], sort: ReportSort): ReportRow[] {
  if (sort === 'handbook') return rows;
  return [...rows].sort((a, b) => NEEDS_WORK_RANK[a.result.strength] - NEEDS_WORK_RANK[b.result.strength]);
}

export function hasEvidence(rows: ReportRow[]): boolean {
  return rows.some((r) => r.result.source !== 'none');
}
```

Note: `miniQuiz.correct`/`total` may be `undefined` when spread from an older record; the
`conceptStrength` check handles that.

- [ ] **Step 4: Run** `npm run test:app -- conceptStrength` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progress/conceptStrength.ts src/progress/conceptStrength.test.ts
git commit -m "feat(ph-4-us-6): concept strength rule, rows and needs-work sort"
```

---

### Task 10: Progress tab concept report (ph-4-us-6)

**Files:**
- Create: `src/progress/useConceptEvidence.ts`, `src/progress/ConceptReportScreen.tsx`
- Test: `src/progress/ConceptReportScreen.test.tsx`
- Modify: `src/navigation/RootNavigator.tsx`

**Interfaces:**
- Consumes: Task 9 exports; `useTopics`; `useConceptProgress`; `useBaselineProgress`
  (`src/baseline/useBaselineProgress.ts`, states `loading | error | not-started | in-progress | complete{version}`);
  `useTestAttempt`; `toReviewItems`; `summarizeBaseline`, `finalBaselineTestId`; `openConcept`.
- Produces:
  ```ts
  export type EvidenceState =
    | { status: 'loading' }
    | { status: 'topics-error'; retry: () => void }
    | { status: 'ready'; rows: ReportRow[]; baselineError: boolean; retryBaseline: () => void };
  export function useConceptEvidence(): EvidenceState
  export function ConceptReportScreen(): JSX.Element
  ```

- [ ] **Step 1: Implement the hook** `src/progress/useConceptEvidence.ts` (thin glue; its
behaviour is tested through the screen)

```ts
import { useMemo } from 'react';
import { useBaselineProgress } from '../baseline/useBaselineProgress';
import { finalBaselineTestId, summarizeBaseline } from '../results/baselineResultsData';
import { toReviewItems } from '../review/reviewData';
import { useTestAttempt } from '../review/useTestAttempt';
import { useConceptProgress } from '../study/useConceptProgress';
import { useTopics } from '../topics/useTopics';
import { toReportRows, type ReportRow } from './conceptStrength';

// ph-4-us-6: everything the concept report needs, combined: topics (titles, order), live
// Concept Progress (mini-quiz scores) and the final baseline attempt (one question per topic).
// Practice-test evidence joins in Slice 5a. A baseline that can't be read leaves its rows
// "not tested" with a flag for the screen to say so, rather than blocking the report.
export type EvidenceState =
  | { status: 'loading' }
  | { status: 'topics-error'; retry: () => void }
  | { status: 'ready'; rows: ReportRow[]; baselineError: boolean; retryBaseline: () => void };

export function useConceptEvidence(): EvidenceState {
  const topics = useTopics();
  const progress = useConceptProgress();
  const baseline = useBaselineProgress();
  const attempt = useTestAttempt(baseline.status === 'complete' ? finalBaselineTestId(baseline.version) : null);

  const baselineLoading = baseline.status === 'loading' || (baseline.status === 'complete' && attempt.status === 'loading');
  const baselineError = baseline.status === 'error' || (baseline.status === 'complete' && attempt.status === 'error');
  const attemptData = attempt.status === 'ready' ? attempt.data : undefined;

  const rows = useMemo(() => {
    if (topics.status !== 'ready') return [];
    const results = new Map<string, 'got-it' | 'missed-it'>();
    const items = baseline.status === 'complete' ? toReviewItems(attemptData) : null;
    if (items) {
      for (const row of summarizeBaseline(items, topics.topics).topics) {
        if (row.result !== 'not-tested') results.set(row.chunkId, row.result);
      }
    }
    return toReportRows(topics.topics, progress.status === 'ready' ? progress.byChunk : {}, results);
  }, [topics, progress, baseline.status, attemptData]);

  if (topics.status === 'error') return { status: 'topics-error', retry: topics.retry };
  if (topics.status === 'loading' || progress.status === 'loading' || baselineLoading) return { status: 'loading' };
  return { status: 'ready', rows, baselineError, retryBaseline: attempt.retry };
}
```

- [ ] **Step 2: Failing screen tests** — `src/progress/ConceptReportScreen.test.tsx`

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { ConceptReportScreen } from './ConceptReportScreen';
import type { EvidenceState } from './useConceptEvidence';
import { toReportRows } from './conceptStrength';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
}));
let mockState: EvidenceState = { status: 'loading' };
jest.mock('./useConceptEvidence', () => ({ useConceptEvidence: () => mockState }));

const topic = (chunkId: string, order: number, approvedQuestionCount = 5) => ({ chunkId, title: `Topic ${chunkId}`, description: '', order, approvedQuestionCount });
const rows = toReportRows(
  [topic('a', 1), topic('b', 2), topic('c', 3), topic('d', 4, 0)],
  { a: { status: 'reviewed', latestMiniQuizScore: 0.9, latestMiniQuizCorrect: 9, latestMiniQuizTotal: 10 }, c: { status: 'in-progress', latestMiniQuizScore: 0.6 } },
  new Map([['b', 'missed-it' as const]])
);
const retryBaseline = jest.fn();

beforeEach(() => jest.clearAllMocks());

test('rows in handbook order with label and basis; a row opens its flashcards', async () => {
  mockState = { status: 'ready', rows, baselineError: false, retryBaseline };
  await render(<ConceptReportScreen />);
  expect(screen.getByText('A rough guide from your quizzes and baseline.')).toBeTruthy();
  const titles = screen.getAllByText(/^Topic /).map((n) => n.props.children);
  expect(titles).toEqual(['Topic a', 'Topic b', 'Topic c', 'Topic d']);
  expect(screen.getByText('9 of 10 right in your latest quiz')).toBeTruthy();
  expect(screen.getByText('Strong')).toBeTruthy();
  expect(screen.getByText('Missed it')).toBeTruthy();
  expect(screen.getByText('60% in your latest quiz')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText(/^Topic c, Shaky/));
  expect(mockNavigate).toHaveBeenCalledWith('Flashcards', { chunkId: 'c' });
});

test('needs work first reorders the rows', async () => {
  mockState = { status: 'ready', rows, baselineError: false, retryBaseline };
  await render(<ConceptReportScreen />);
  await fireEvent.press(screen.getByText('Needs work first'));
  const titles = screen.getAllByText(/^Topic /).map((n) => n.props.children);
  expect(titles).toEqual(['Topic b', 'Topic c', 'Topic d', 'Topic a']);
});

test('a coming-soon topic is not pressable', async () => {
  mockState = { status: 'ready', rows, baselineError: false, retryBaseline };
  await render(<ConceptReportScreen />);
  await fireEvent.press(screen.getByLabelText(/^Topic d/));
  expect(mockNavigate).not.toHaveBeenCalled();
});

test('no evidence anywhere shows what fills it in, with the baseline and the concept list', async () => {
  mockState = { status: 'ready', rows: toReportRows([topic('a', 1)], {}, new Map()), baselineError: false, retryBaseline };
  await render(<ConceptReportScreen />);
  expect(screen.getByText(/Take the baseline or a concept's mini-quiz/)).toBeTruthy();
  await fireEvent.press(screen.getByText('Start your baseline'));
  expect(mockNavigate).toHaveBeenCalledWith('Baseline');
  await fireEvent.press(screen.getByText('Go to the concept list'));
  expect(mockNavigate).toHaveBeenLastCalledWith('Main', { screen: 'Study', params: { screen: 'StudyHome' } });
});

test('a baseline that cannot load says so with Try again, and still shows the report', async () => {
  mockState = { status: 'ready', rows, baselineError: true, retryBaseline };
  await render(<ConceptReportScreen />);
  expect(screen.getByText("Couldn't load your baseline.")).toBeTruthy();
  await fireEvent.press(screen.getByText('Try again'));
  expect(retryBaseline).toHaveBeenCalled();
  expect(screen.getByText('Topic a')).toBeTruthy();
});

test('topics failing shows No connection', async () => {
  const retry = jest.fn();
  mockState = { status: 'topics-error', retry };
  await render(<ConceptReportScreen />);
  expect(screen.getByText('No connection')).toBeTruthy();
});
```

- [ ] **Step 3: Run** `npm run test:components -- ConceptReportScreen` — Expected: FAIL.

- [ ] **Step 4: Implement** `src/progress/ConceptReportScreen.tsx`

```tsx
import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { NoConnection } from '../components/NoConnection';
import { colors, radius, spacing, typography } from '../theme/tokens';
import {
  basisLine,
  hasEvidence,
  sortRows,
  STRENGTH_LABEL,
  type ReportRow,
  type ReportSort,
  type Strength,
} from './conceptStrength';
import { useConceptEvidence } from './useConceptEvidence';

// ph-4-us-6: the Progress tab's concept report. Every topic as strong / shaky / likely gap
// (or Got it / Missed it from the baseline alone), with what it's based on, sortable so the
// topics that need work come first. Tapping a topic opens its flashcards. Phase 5 adds the
// test date and outcome to this tab later.

const CHIP: Record<Strength, { backgroundColor: string; color: string }> = {
  strong: { backgroundColor: colors.successSoft, color: colors.success },
  'got-it': { backgroundColor: colors.successSoft, color: colors.success },
  shaky: { backgroundColor: colors.secondarySoft, color: colors.secondary },
  'likely-gap': { backgroundColor: colors.background, color: colors.alert },
  'missed-it': { backgroundColor: colors.background, color: colors.alert },
  'not-tested': { backgroundColor: colors.background, color: colors.inkSoft },
};

export function ConceptReportScreen() {
  const navigation = useNavigation();
  const evidence = useConceptEvidence();
  const [sort, setSort] = useState<ReportSort>('handbook');

  if (evidence.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Loading your progress" />
      </View>
    );
  }
  if (evidence.status === 'topics-error') {
    return <NoConnection message="Couldn't load your progress. Check your connection and try again." onRetry={evidence.retry} />;
  }

  const studyList = () => navigation.navigate('Main', { screen: 'Study', params: { screen: 'StudyHome' } });
  const notice = evidence.baselineError ? (
    <View style={styles.notice}>
      <Text style={[typography.small, styles.noticeText]}>Couldn't load your baseline.</Text>
      <Button label="Try again" variant="text" onPress={evidence.retryBaseline} />
    </View>
  ) : null;

  if (!hasEvidence(evidence.rows)) {
    return (
      <View style={[styles.list, styles.content]}>
        {notice}
        <Text style={typography.h1}>Nothing to show yet</Text>
        <Text style={[typography.body, styles.muted]}>
          Take the baseline or a concept's mini-quiz, and this shows which concepts you've got and which need work.
        </Text>
        <Button label="Start your baseline" onPress={() => navigation.navigate('Baseline')} />
        <Button label="Go to the concept list" variant="secondary" onPress={studyList} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={sortRows(evidence.rows, sort)}
      keyExtractor={(row) => row.chunkId}
      ListHeaderComponent={
        <View style={styles.header}>
          {notice}
          <Text style={[typography.body, styles.muted]}>A rough guide from your quizzes and baseline.</Text>
          <View style={styles.sort} accessibilityRole="radiogroup">
            {(['handbook', 'needs-work'] as const).map((value) => (
              <Button
                key={value}
                label={value === 'handbook' ? 'Handbook order' : 'Needs work first'}
                variant={sort === value ? 'primary' : 'secondary'}
                onPress={() => setSort(value)}
                style={styles.sortButton}
              />
            ))}
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <ReportRowView row={item} onPress={() => navigation.navigate('Flashcards', { chunkId: item.chunkId })} />
      )}
    />
  );
}

function ReportRowView({ row, onPress }: { row: ReportRow; onPress: () => void }) {
  const label = STRENGTH_LABEL[row.result.strength];
  const basis = basisLine(row.result);
  const chip = CHIP[row.result.strength];
  const content = (
    <>
      <View style={styles.rowHeader}>
        <Text style={[typography.h2, styles.rowTitle]}>{row.title}</Text>
        <View style={[styles.chip, { backgroundColor: chip.backgroundColor }]}>
          <Text style={[typography.small, { color: chip.color }]}>{label}</Text>
        </View>
      </View>
      {/* "Not tested yet" is already the chip; don't say it twice. */}
      {row.result.source !== 'none' && <Text style={typography.small}>{basis}</Text>}
    </>
  );
  const a11y = [row.title, label, row.result.source !== 'none' ? basis : null].filter(Boolean).join(', ');
  if (row.comingSoon) {
    return (
      <Card style={styles.comingSoon}>
        <View accessible accessibilityLabel={a11y} style={styles.rowBody}>
          {content}
        </View>
      </Card>
    );
  }
  return (
    <Card onPress={onPress} accessibilityLabel={a11y}>
      {content}
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.space5, gap: spacing.space3 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header: { gap: spacing.space3 },
  muted: { color: colors.inkSoft },
  sort: { flexDirection: 'row', gap: spacing.space2 },
  sortButton: { flex: 1 },
  notice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  noticeText: { color: colors.alert },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 },
  rowTitle: { flex: 1 },
  rowBody: { gap: spacing.space2 },
  chip: { borderRadius: radius.chip, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.space2, paddingVertical: 2 },
  comingSoon: { backgroundColor: colors.background },
});
```

The "Topic d" coming-soon row in the test reads "Not tested yet" as its chip; the
`getByLabelText(/^Topic d/)` matches the non-pressable `View`.

- [ ] **Step 5: Wire the Progress tab** — in `src/navigation/RootNavigator.tsx` replace
`const ProgressStack = makeStack('ProgressHome', 'Progress', 'Progress / Outcome');` with:

```tsx
// ph-4-us-6: the Progress tab is the concept report (Phase 5 adds the outcome log here later).
const ProgressStackNav = createNativeStackNavigator();
function ProgressStack() {
  return (
    <ProgressStackNav.Navigator screenOptions={headerOptions}>
      <ProgressStackNav.Screen name="ProgressHome" component={ConceptReportScreen} options={{ title: 'Progress' }} />
    </ProgressStackNav.Navigator>
  );
}
```

and import `ConceptReportScreen` from `'../progress/ConceptReportScreen'`.

- [ ] **Step 6: Run** `npm run test:components`, `npm run test:app`, `npx tsc --noEmit` — Expected: PASS, clean.

- [ ] **Step 7: Commit**

```bash
git add src/progress src/navigation/RootNavigator.tsx
git commit -m "feat(ph-4-us-6): Progress tab concept report with needs-work sort"
```

---

### Task 11: Deploy, device test, docs and status

**Files:**
- Modify: `docs/phases/phase-2-flashcard-study-mode/ph-2-us-{1,3,4,6,8,9,10,11}*.md`,
  `docs/phases/phase-3-practice-test-generator-and-test-taking-ui/ph-3-us-1*.md`,
  `docs/phases/phase-4-scoring-and-review/ph-4-us-6-per-concept-report.md`,
  `docs/phases/phase-2-flashcard-study-mode/phase-2-summary.md`,
  `docs/phases/phase-4-scoring-and-review/phase-4-summary.md`, `docs/build-order.md`,
  `docs/history/LOG.md`

- [ ] **Step 1: Full verification**

Run: `npm run test:rules`, `npm run test:functions`, `npm run test:question-bank`, `npm run test:app`, `npm run test:components`, `npx tsc --noEmit`
Expected: all PASS; record the counts.

- [ ] **Step 2: Deploy functions to dev**

Run: `npx firebase deploy --only functions --project dmv-app-dev` (rules didn't change).
Then the invoker smoke check from `docs/Prod-Launch-Plan.md` (curl a callable unauthenticated →
expect 401, not 403). If the deploy hits the transient `generateUploadUrl` error seen in 4a,
retry once.

- [ ] **Step 3: Device test on the Android emulator** (`npx expo start --dev-client`), with a user
who has taken the baseline, against dev:
  1. Open a topic → first card shows "Skip to quiz" → go to the end → "Take the mini-quiz".
  2. A topic with ~31 questions gets 10; a big one gets up to 15. Leaving mid-quiz asks first.
  3. Submit with misses → results: score, recommendation, missed list, "Review answers" opens Review.
  4. Review Again → only the missed cards, banner, "Show all cards" → full deck. List: in progress.
  5. Retake → different questions where the topic allows → Come Back Later → next topic opens;
     Back goes to where the first topic was opened from; list shows "needs revisit".
  6. Reopen that topic → only its missed cards. Take the quiz → Mark Reviewed → list: reviewed.
  7. Progress tab → that topic strong/shaky/likely gap with "N of M right in your latest quiz";
     baseline-only topics Got it / Missed it; "Needs work first" reorders; a row opens flashcards.
  8. Airplane mode at submit → "We'll submit as soon as you're back online" → reconnect → results.
  9. Clear app data (fresh anonymous user) → Progress tab empty state with both buttons.
Fix anything found (systematic-debugging), re-run the affected suites, commit as `fix(…)`.

- [ ] **Step 4: Story docs** — tick the acceptance criteria met and set statuses:
  - ph-2-us-6, 8, 9, 4: Complete, each with an "Implementation notes (Slice 4b)" section naming
    the plan and spec, and the changes from the spec's "Story updates" (scaled size and no
    force-quit resume on us-8; missed-only passes on us-4; uid in the key and
    `lastQuizMissedIds` on us-6).
  - ph-2-us-3: Complete (mini-quiz button live). ph-2-us-1 and ph-2-us-10: Complete.
  - ph-2-us-11: add `latestMiniQuizCorrect` / `latestMiniQuizTotal` to the schema.
  - ph-3-us-1: note the mini-quiz part is dropped (spec decision 6).
  - ph-4-us-6: concept report criteria ticked; stays In Progress for 5a's "Topics to work on".
  - Phase 2 and Phase 4 summaries: status rows.

- [ ] **Step 5: `docs/build-order.md`** — add a **Status** paragraph under 4b (date, plan and
spec paths, deploy result, device test, suite counts, decisions changed vs the stories,
carry-forwards). Remove the 4a carry-forwards that 4b resolved (Review Again route reset,
cache-only empty snapshot); keep the Slice 6 one and add: clear `card-perf` keys on sign-out.

- [ ] **Step 6: Log** — append a one-line entry to `docs/history/LOG.md` under today's date
(project-history skill).

- [ ] **Step 7: Commit**

```bash
git add docs
git commit -m "docs: Slice 4b (mini-quiz, recommendation and progress) complete"
```
