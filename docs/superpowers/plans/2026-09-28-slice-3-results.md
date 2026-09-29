# Slice 3 — Results Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After section 3 of the baseline, the user sees their score as a percentage and N of
45, how that tracks against the real test's 80% mark, and every topic marked Got it / Missed it.
From there they can review all 45 questions with the right answers, or jump to the concept list
(still a stub) from a topic or "Start with what you missed".

**Architecture:** `scoreTest` starts saving each question's text, choices, type and optional
explanation on graded attempts, so any past attempt can be reviewed from the client-readable
`users/{uid}/testAttempts/{testId}` doc (the `questions` collection stays deny-all). The app gets
pure, Node-tested data modules (`src/review/reviewData.ts`, `src/results/baselineResultsData.ts`,
`src/topics/topicsData.ts`) and thin Firebase hooks around them. The quiz card gains a read-only
review state. A generic `Review` root-stack screen loads an attempt by `testId` (it will serve
practice tests and mini-quizzes later). The baseline's placeholder "complete" screen becomes the
results screen, fed by the in-memory `baselineReview` right after submit, or by the final
attempt doc when reopened later.

**Tech Stack:** Firebase Cloud Functions v2 + Admin SDK (Jest against the Firestore emulator,
`npm run test:functions`), question-bank scripts (`npm run test:question-bank`), Expo SDK 57,
React Navigation 7, `@react-native-firebase/firestore` v26 modular API, Jest (`test:app` = Node
ts-jest for `*.test.ts`, `test:components` = jest-expo for `*.test.tsx`).

**Spec:** `docs/build-order.md` (Slice 3) and its stories:
`docs/phases/phase-4-scoring-and-review/ph-4-us-3-question-content-on-attempts.md`,
`ph-4-us-4-question-review-screen.md`, `ph-4-us-6-per-concept-report.md` (**baseline results
part only**: its first four acceptance criteria and the "no evidence" wording), parent
`ph-4-us-2-review-each-question.md`. Backend contract: `functions/README.md` (`scoreTest`).

## Decisions made while planning (flag to the user at review)

- **`type` added to `PerQuestionResult`** (`'fact' | 'scenario' | null`). ph-4-us-3 lists only
  text/choices/explanation, but ph-4-us-4 requires the scenario badge in review, and the attempt
  is the review's only source. Costs nothing: the doc is already read.
- **Baseline review shows choices in the order the user saw them.** The baseline shuffles each
  question's choices with a seed from its ID, so `scoreTest` reapplies the same seeded shuffle
  (one shared helper, `baselineChoices`, used by both functions). Practice tests and mini-quizzes
  shuffle with a true random that isn't recorded, so their review shows the stored order. That's
  acceptable for now; Slice 5 can record the order on the assignment if it matters.
- **`baselineReview` text/choices come from re-reading the question docs**, not from the earlier
  sections' saved attempts as ph-4-us-3's third criterion words it. `gradeQuestions` already
  re-reads all 45 docs to reveal answers, so this is the same data with no extra reads, and it
  also works for attempts saved before this change. Outcome for the user is identical.
- **Topic taps and "Start with what you missed" go to the Study tab**, which is still the
  concept-list placeholder. All of them go through one `openConcept(navigation, chunkId)` helper,
  so Slice 4a changes one function to land on the topic's flashcards.
- **The review screen is a root-stack route `Review: { testId: string }`** that reads the
  attempt doc itself (Firestore's offline cache serves it if loaded before). No 45-item nav
  params.

## Global Constraints

- Colors, spacing, radius and type come only from `src/theme/tokens.ts`. No new hex values.
- Right is `success`/`successSoft`, wrong is `alert`, always paired with a text label, never
  color alone (ph-4-us-4, ph-4-us-6).
- Reuse `src/components/Button.tsx`, `Card.tsx`, `NoConnection.tsx`.
- Tap targets ≥ 48pt.
- The baseline results screen never says "pass" or "fail" (ph-4-us-6, criterion 2).
- `PASS_MARK = 0.8` lives in one shared module (`src/results/passMark.ts`) that ph-4-us-1
  (Slice 5) reuses. At-the-mark is `correctCount / totalCount >= PASS_MARK` on the raw ratio
  (36/45 is exactly 0.8 and counts as at the mark), never the rounded percentage.
- Pure data modules never import native Firebase modules (the `profileData.ts` vs `profile.ts`
  split): they stay testable under `npm run test:app`.
- `explanation` is never returned by `assembleTest`, `assembleMiniQuiz`, `getFlashcards` or
  `startOrResumeBaseline`, and never on a baseline section before the last.
- Every Cloud Function change follows the `cloud-function-documentation` skill (summary doc
  comment + inline "why" comments).
- `src/api/types.ts` is a hand-kept copy of the function contracts: change it alongside
  `functions/src/scoreTest.ts` and `functions/README.md`.

## Review Focus

1. **Baseline attempts saved before this ships** (every attempt made in Slice 2 testing) have no
   `text`/`choices`. Results must still render (score and topics come from `correct`/`chunkId`),
   and the review shows "Question text unavailable" plus the user's and the correct answer
   instead of crashing. → Task 3 (`toReviewItems`) and Task 6 tests.
2. **`topics` fails to load or is missing a topic** (offline first launch, unpublished topic).
   Results must still list every reviewed topic, falling back to its `chunkId` as the title,
   rather than an empty list. → Task 4 (`summarizeBaseline`) test.
3. **Reopening a completed baseline later** (from Home, after an app restart) must show the same
   results, loaded from the final attempt doc, not the old "arrive in the next build" text. The
   attempt doc lives at `baseline-{version}-3`, so progress must carry `version`. → Task 7 test.
4. **A deleted (`unavailable`) question** must not count toward the score, must show as "Not
   tested" on results and "This question was removed" in review, and must be excluded from
   "Missed only". → Tasks 3, 4, 6 tests.
5. **All correct**: "Missed only" has nothing to show, so it's off by default and shows "No
   misses", and "Start with what you missed" is hidden. → Tasks 3, 4, 6, 7 tests.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `scripts/question-bank/lib/types.ts`, `validate.ts`, `writeQuestions.ts` (modify) | Optional `explanation` on questions |
| `functions/src/shuffle.ts` (modify) | `baselineChoices(id, choices)` — the one seeded baseline order |
| `functions/src/startOrResumeBaseline.ts` (modify) | Use `baselineChoices` |
| `functions/src/scoreTest.ts` (modify) | Per-question `text`/`choices`/`type`/`explanation`; withholding |
| `functions/README.md` (modify) | `scoreTest` contract |
| `src/api/types.ts` (modify) | Client copy of `PerQuestionResult` |
| `src/results/passMark.ts` (create) | `PASS_MARK` |
| `src/topics/topicsData.ts` (create) | Pure: `Topic`, `toTopics` (sort by handbook order) |
| `src/topics/useTopics.ts` (create) | Reads `topics` once |
| `src/review/reviewData.ts` (create) | Pure: `ReviewItem`, `toReviewItems`, `missedOnly`, `countMissed` |
| `src/review/useTestAttempt.ts` (create) | Reads `users/{uid}/testAttempts/{testId}` |
| `src/review/ReviewScreen.tsx` (create) | Review UI: strip, card, explanation/fallback, filter |
| `src/quiz/QuizCard.tsx` (modify) | Read-only `review` state |
| `src/results/baselineResultsData.ts` (create) | Pure: `summarizeBaseline`, `trackingLine`, `finalBaselineTestId` |
| `src/results/BaselineResults.tsx` (create) | Results UI (replaces `src/baseline/BaselineComplete.tsx`) |
| `src/navigation/openConcept.ts` (create) | Single place topic links navigate from |
| `src/baseline/baselineProgressData.ts` (modify) | `complete` carries `version` |
| `src/baseline/BaselineScreen.tsx` (modify) | `complete` phase → `BaselineResults` |
| `src/navigation/types.ts`, `RootNavigator.tsx` (modify) | `Review` route |
| `src/home/HomeScreen.tsx` (modify) | "Baseline done" card copy |

---

### Task 1: Optional `explanation` on questions (ingestion)

**Files:**
- Modify: `scripts/question-bank/lib/types.ts` (`QuestionInput`)
- Modify: `scripts/question-bank/lib/validate.ts` (`validateQuestions`)
- Modify: `scripts/question-bank/lib/writeQuestions.ts`
- Test: `scripts/question-bank/lib/validate.test.ts`, `scripts/question-bank/lib/writeQuestions.test.ts`
- Modify: `scripts/question-bank/README.md`

**Interfaces:**
- Produces: `QuestionInput.explanation?: string`; Firestore `questions/{id}.explanation?: string`.

- [ ] **Step 1: Write the failing tests** — add inside `describe('validateQuestions', …)` in
  `validate.test.ts` (it already defines `validQuestion`):

```ts
  it('accepts a question with a non-empty explanation', () => {
    const q = { ...validQuestion, explanation: 'Red always means a full stop.' };
    expect(validateQuestions([q])).toEqual([q]);
  });

  it.each([[''], ['   '], [42], [null], [['a']]])('rejects explanation %p', (explanation) => {
    expect(() => validateQuestions([{ ...validQuestion, explanation }])).toThrow(
      'invalid "explanation"'
    );
  });
```

  In `writeQuestions.test.ts`, add a test in the file's existing style (read it first; it writes
  a temp JSON file and reads back the `questions` docs) asserting that a question with
  `explanation: 'Why'` is stored with `explanation: 'Why'`, and one without has no
  `explanation` field (`expect(data).not.toHaveProperty('explanation')`).

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test:question-bank -- validate writeQuestions`
Expected: FAIL — invalid explanations are accepted; stored doc has no `explanation`.

- [ ] **Step 3: Implement**

`types.ts`, in `QuestionInput` after `selfCheck`:

```ts
  /**
   * Optional short, paraphrased "why" shown when reviewing a graded question (ph-4-us-3). Never
   * sent before grading. prd.md Section 8's no-verbatim rule applies.
   */
  explanation?: string;
```

`validate.ts`, at the end of the per-question `forEach` body (after the selfCheck checks):

```ts
    // Optional, but when present it's shown to users as-is, so it must be real text.
    if (
      q.explanation !== undefined &&
      (typeof q.explanation !== 'string' || q.explanation.trim() === '')
    ) {
      throw new Error(
        `Question at index ${index} has an invalid "explanation" (must be a non-empty string when present)`
      );
    }
```

`writeQuestions.ts`, in the `record` literal after `selfCheck`:

```ts
      // Only written when present, so questions without one don't carry an empty field.
      ...(question.explanation ? { explanation: question.explanation } : {}),
```

- [ ] **Step 4: Run to verify they pass**

Run: `npm run test:question-bank`
Expected: all PASS.

- [ ] **Step 5: README** — in `scripts/question-bank/README.md`, where the question JSON fields
  are listed, add: `explanation` (optional string) — a short paraphrased "why", shown only in the
  post-grading review; must be non-empty when present. None exist yet (writing them is an
  unscheduled content task, ph-4-us-3 Questions).

- [ ] **Step 6: Commit**

```bash
git add scripts/question-bank
git commit -m "feat(ph-4-us-3): optional explanation field on questions"
```

---

### Task 2: `scoreTest` saves question content on attempts

**Files:**
- Modify: `functions/src/shuffle.ts`, `functions/src/startOrResumeBaseline.ts`, `functions/src/scoreTest.ts`
- Test: `functions/src/shuffle.test.ts`, `functions/src/scoreTest.test.ts`,
  `functions/src/assembleTest.test.ts`, `functions/src/assembleMiniQuiz.test.ts`,
  `functions/src/getFlashcards.test.ts`, `functions/src/startOrResumeBaseline.test.ts`
- Modify: `functions/README.md`

**Interfaces:**
- Consumes: `questions/{id}.explanation?` (Task 1).
- Produces (response, `testAttempts/{testId}.perQuestion`, and `baselineReview`):

```ts
export interface PerQuestionResult {
  questionId: string;
  chunkId: string | null;
  choice: string | null;
  correctAnswer: string | null;
  correct: boolean | null;
  text: string | null;           // null only when unavailable
  choices: string[] | null;      // null only when unavailable; baseline = seeded order the user saw
  type: 'fact' | 'scenario' | null; // null only when unavailable
  explanation?: string;          // only when revealed and the doc has a non-empty one
  unavailable?: true;
}
```
- Produces: `baselineChoices(questionId: string, choices: string[]): string[]` in `shuffle.ts`.

**Follow the `cloud-function-documentation` skill** for every changed function/helper.

- [ ] **Step 1: Write the failing tests**

`shuffle.test.ts`:

```ts
import { baselineChoices, seededRandom, shuffle } from './shuffle';

describe('baselineChoices', () => {
  test('is the seeded shuffle startOrResumeBaseline has always used', () => {
    const choices = ['a', 'b', 'c', 'd'];
    expect(baselineChoices('q1', choices)).toEqual(shuffle(choices, seededRandom('baseline:q1')));
  });

  test('does not mutate its input', () => {
    const choices = ['a', 'b', 'c', 'd'];
    baselineChoices('q1', choices);
    expect(choices).toEqual(['a', 'b', 'c', 'd']);
  });
});
```

(Merge the import with the file's existing import line.)

`scoreTest.test.ts` — give `seedQuestion` an optional `extra` argument so tests can add an
explanation or type:

```ts
  async function seedQuestion(
    id: string,
    chunkId: string,
    correctAnswer: string,
    extra: Record<string, unknown> = {}
  ) {
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
        ...extra,
      });
  }
```

Add `import { baselineChoices } from './shuffle';` and these tests:

```ts
  test('practice perQuestion carries text, choices, type and explanation, in response and attempt', async () => {
    await seedQuestion('q1', 'row', 'a', { explanation: 'Because a.', type: 'scenario' });
    await seedQuestion('q2', 'signs', 'b');
    const assembled = await assembleTestForUser(db, { uid }, { count: 2 });

    const result = await scoreTestForUser(db, { uid }, {
      testId: assembled.testId,
      answers: [{ questionId: 'q1', choice: 'a' }],
    });

    const byId = Object.fromEntries(result.perQuestion.map((q) => [q.questionId, q]));
    expect(byId.q1).toMatchObject({
      text: 'Question q1',
      choices: ['a', 'b'],
      type: 'scenario',
      explanation: 'Because a.',
    });
    expect(byId.q2).toMatchObject({ text: 'Question q2', choices: ['a', 'b'], type: 'fact' });
    expect(byId.q2).not.toHaveProperty('explanation');

    const attempt = await db.collection('users').doc(uid).collection('testAttempts').doc(assembled.testId).get();
    expect(attempt.data()?.perQuestion).toEqual(result.perQuestion);
  });

  test.each([[''], ['   '], [42], [null]])('leaves out a malformed explanation (%p)', async (explanation) => {
    await seedQuestion('q1', 'row', 'a', { explanation });
    const assembled = await assembleTestForUser(db, { uid }, { count: 1 });
    const result = await scoreTestForUser(db, { uid }, { testId: assembled.testId, answers: [] });
    expect(result.perQuestion[0]).not.toHaveProperty('explanation');
  });

  test('baseline sections before the last carry text and choices but no answer or explanation', async () => {
    await seedQuestion('q1', 'row', 'a', { choices: ['a', 'b', 'c', 'd'], explanation: 'Because a.' });
    await db.collection('baselineTests').doc(CURRENT_BASELINE_VERSION).set({
      sections: [
        { section: 1, questionIds: ['q1'] },
        { section: 2, questionIds: [] },
      ],
      createdAt: new Date(),
    });
    const started = await startOrResumeBaselineForUser(db, { uid });

    const result = await scoreTestForUser(db, { uid }, {
      testId: started.testId,
      answers: [{ questionId: 'q1', choice: 'a' }],
    });

    const expected = {
      questionId: 'q1',
      chunkId: 'row',
      choice: 'a',
      correctAnswer: null,
      correct: null,
      text: 'Question q1',
      // The order startOrResumeBaseline showed, so review matches what the user saw.
      choices: started.questions[0].choices,
      type: 'fact',
    };
    expect(result.perQuestion).toEqual([expected]);
    const attempt = await db.collection('users').doc(uid).collection('testAttempts').doc(started.testId).get();
    expect(attempt.data()?.perQuestion).toEqual([expected]);
    expect(JSON.stringify(attempt.data())).not.toContain('Because a.');
  });

  test('baselineReview reveals text, seeded choices, answers and explanations for every section', async () => {
    await seedQuestion('q1', 'row', 'a', { choices: ['a', 'b', 'c', 'd'], explanation: 'Because a.' });
    await seedQuestion('q2', 'signs', 'b');
    await db.collection('baselineTests').doc(CURRENT_BASELINE_VERSION).set({
      sections: [
        { section: 1, questionIds: ['q1'] },
        { section: 2, questionIds: ['q2'] },
      ],
      createdAt: new Date(),
    });
    const s1 = await startOrResumeBaselineForUser(db, { uid });
    await scoreTestForUser(db, { uid }, { testId: s1.testId, answers: [{ questionId: 'q1', choice: 'b' }] });
    const s2 = await startOrResumeBaselineForUser(db, { uid });
    const final = await scoreTestForUser(db, { uid }, { testId: s2.testId, answers: [] });

    expect(final.baselineReview).toEqual([
      {
        questionId: 'q1',
        chunkId: 'row',
        choice: 'b',
        correctAnswer: 'a',
        correct: false,
        text: 'Question q1',
        choices: baselineChoices('q1', ['a', 'b', 'c', 'd']),
        type: 'fact',
        explanation: 'Because a.',
      },
      {
        questionId: 'q2',
        chunkId: 'signs',
        choice: null,
        correctAnswer: 'b',
        correct: false,
        text: 'Question q2',
        choices: baselineChoices('q2', ['a', 'b']),
        type: 'fact',
      },
    ]);
  });
```

Update the **existing** tests whose `toEqual` literals list full `PerQuestionResult` objects
(the "returns per-question results …", "skips a question deleted …", "scores a baseline section
…" and "finishing the baseline reveals …" tests) to include the new fields:
`text: 'Question <id>'`, `choices` (`['a', 'b']` for practice; `baselineChoices('<id>', ['a','b'])`
for baseline entries), `type: 'fact'`; and for the deleted question
`text: null, choices: null, type: null`.

No-leak tests, one per reader. In `assembleTest.test.ts` and `assembleMiniQuiz.test.ts` (both
have `seedQuestion(id, overrides)`):

```ts
  test('never returns explanation', async () => {
    await seedQuestion('q1', { explanation: 'Because a.' });
    const result = await assembleTestForUser(db, { uid }, { count: 1 });
    expect(result.questions[0]).not.toHaveProperty('explanation');
    expect(JSON.stringify(result)).not.toContain('Because a.');
  });
```

(Use `assembleMiniQuizForUser(db, { uid }, { chunkId: <the file's default chunkId>, count: 1 })`
in the mini-quiz file, and whatever `uid`/auth variable each file already uses.)
In `getFlashcards.test.ts`: same shape with `getFlashcardsForUser`, asserting on `result.cards[0]`.
In `startOrResumeBaseline.test.ts`: after `seedBaseline()`, update `q1` with
`{ explanation: 'Because a.' }` and assert the same on `result.questions[0]`.

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test:functions`
Expected: FAIL — `baselineChoices` not exported; perQuestion lacks `text`/`choices`/`type`.
(The four no-leak tests should already pass — they pin existing behavior.)

- [ ] **Step 3: Implement `baselineChoices`** in `shuffle.ts`:

```ts
/**
 * The baseline's fixed choice order for one question: a shuffle seeded by the question ID.
 *
 * The one definition of that order. startOrResumeBaseline uses it to serve choices, and
 * scoreTest uses it to save them on the attempt, so the review shows the choices exactly as the
 * user saw them. Change it in one place or the review stops matching the test.
 */
export function baselineChoices(questionId: string, choices: string[]): string[] {
  return shuffle(choices, seededRandom(`baseline:${questionId}`));
}
```

In `startOrResumeBaseline.ts`, replace `choices: shuffle(data.choices, seededRandom(\`baseline:${doc.id}\`)),`
with `choices: baselineChoices(doc.id, data.choices),` and update the import to
`import { baselineChoices } from './shuffle';`. Keep the existing comment above it.

- [ ] **Step 4: Implement in `scoreTest.ts`**

Import `baselineChoices` from `./shuffle`. Extend the `PerQuestionResult` interface with doc
comments:

```ts
  /** The question as the student saw it. Null only when unavailable. */
  text: string | null;
  /**
   * The choices in the order the student saw them for the baseline (see baselineChoices);
   * stored order for practice tests and mini-quizzes, whose shuffle isn't recorded. Null only
   * when unavailable.
   */
  choices: string[] | null;
  /** 'fact' or 'scenario', so the review can keep the scenario treatment. Null only when unavailable. */
  type: 'fact' | 'scenario' | null;
  /**
   * The question's short "why", when it has one. Left out while answers are withheld (it would
   * give the answer away) and when the stored value isn't a non-empty string.
   */
  explanation?: string;
```

Give `gradeQuestions` a fourth parameter and document it in its comment block
(`orderChoices — how to order each question's saved choices; defaults to stored order`):

```ts
async function gradeQuestions(
  db: Firestore,
  questionIds: string[],
  answers: AnswerInput[],
  orderChoices: (questionId: string, choices: string[]) => string[] = (_id, choices) => choices
)
```

In its loop, the unavailable branch pushes `text: null, choices: null, type: null` as well.
The graded branch becomes:

```ts
    perQuestion.push({
      questionId: doc.id,
      chunkId,
      choice: submitted,
      correctAnswer: data.correctAnswer,
      correct,
      // Saved so a past attempt can be reviewed without reading `questions`, which clients
      // can't. This exposes nothing new: the user was just shown this question.
      text: data.text,
      choices: orderChoices(doc.id, data.choices),
      type: data.type,
      // Only real text is sent; a malformed value is dropped rather than shown.
      ...(typeof data.explanation === 'string' && data.explanation.trim() !== ''
        ? { explanation: data.explanation }
        : {}),
    });
```

In `scoreBaselineSection`, pass `baselineChoices` to both `gradeQuestions` calls, and change the
withholding map to also drop `explanation`:

```ts
    const perQuestion = isLastSection
      ? graded
      : graded.map(({ explanation: _withheld, ...q }) => ({ ...q, correctAnswer: null, correct: null }));
```

Add to the withholding comment above it: "The explanation is dropped too: it would give the
answer away." Update the `scoreBaselineSection` and `scoreTestForUser` doc blocks' "Returns"
lines to mention question text, choices, type and explanation.

- [ ] **Step 5: Run to verify they pass**

Run: `npm run test:functions`
Expected: all PASS. (`getFlashcards` "unauthenticated" has flaked once before; rerun once if it
alone fails.)

- [ ] **Step 6: README** — in `functions/README.md` `scoreTest` section: update the Output
  `perQuestion` example to
  `{ "questionId": "...", "chunkId": "...", "choice": "... | null if skipped", "correctAnswer": "...", "correct": false, "text": "...", "choices": ["..."], "type": "fact | scenario", "explanation": "... (only when present)" }`;
  add a paragraph: text/choices/type are saved so past attempts can be reviewed without reading
  `questions`; baseline choices are in the seeded order the user saw (`baselineChoices`),
  practice/mini-quiz choices in stored order; `explanation` is included only when the question
  has a non-empty one, never on a baseline section before the last, and never by the assemble,
  flashcard or baseline-start functions; unavailable questions have `text`/`choices`/`type`
  null. Update the Persistence paragraph to say `perQuestion` and `baselineReview` entries carry
  these fields.

- [ ] **Step 7: Commit**

```bash
git add functions
git commit -m "feat(ph-4-us-3): scoreTest saves question text, choices, type and explanation"
```

- [ ] **Step 8: Deploy to dev** (needs Firebase CLI login; ask the user to run `firebase login`
  if it has expired): `npx firebase deploy --only functions --project dev` (check `.firebaserc`
  for the alias name). Then run the `curl` smoke check from `docs/Prod-Launch-Plan.md` against
  `scoreTest` to confirm it isn't 403. Record in the log if deploy is deferred.

---

### Task 3: Client types, topics and review data

**Files:**
- Modify: `src/api/types.ts`
- Create: `src/results/passMark.ts`, `src/topics/topicsData.ts`, `src/topics/useTopics.ts`,
  `src/review/reviewData.ts`, `src/review/useTestAttempt.ts`
- Test: `src/topics/topicsData.test.ts`, `src/review/reviewData.test.ts`

**Interfaces:**
- Consumes: `PerQuestionResult` shape from Task 2.
- Produces:

```ts
// src/results/passMark.ts
export const PASS_MARK = 0.8;

// src/topics/topicsData.ts
export interface Topic { chunkId: string; title: string; order: number }
export function toTopics(docs: { id: string; data: Record<string, unknown> }[]): Topic[];

// src/topics/useTopics.ts
export type TopicsState = { status: 'loading' } | { status: 'ready'; topics: Topic[] } | { status: 'error' };
export function useTopics(): TopicsState;

// src/review/reviewData.ts
export type ReviewOutcome = 'right' | 'wrong' | 'skipped' | 'removed';
export interface ReviewItem {
  questionId: string;
  chunkId: string | null;
  text: string | null;
  choices: string[] | null;
  type: 'fact' | 'scenario';
  choice: string | null;
  correctAnswer: string | null;
  explanation: string | null;
  outcome: ReviewOutcome;
}
export function toReviewItems(attempt: Record<string, unknown> | undefined): ReviewItem[] | null;
export function isMissed(item: ReviewItem): boolean;
export function countMissed(items: ReviewItem[]): number;

// src/review/useTestAttempt.ts
export type AttemptState =
  | { status: 'loading' }
  | { status: 'ready'; data: Record<string, unknown> | undefined }
  | { status: 'error'; offline: boolean };
export function useTestAttempt(testId: string | null): AttemptState & { retry: () => void };
```

- [ ] **Step 1: Update `src/api/types.ts`** — replace `PerQuestionResult` with:

```ts
/**
 * `correctAnswer` / `correct` / `explanation` are withheld for baseline sections before the
 * last. `text` / `choices` / `type` are null when the question was deleted (`unavailable`), and
 * missing on attempts saved before ph-4-us-3.
 */
export interface PerQuestionResult {
  questionId: string;
  chunkId: string | null;
  choice: string | null;
  correctAnswer: string | null;
  correct: boolean | null;
  text?: string | null;
  choices?: string[] | null;
  type?: QuestionType | null;
  explanation?: string;
  unavailable?: true;
}
```

(Optional on the client because old attempts lack them.) Create `src/results/passMark.ts`:

```ts
// ph-4-us-6 / ph-4-us-1: the real Colorado permit test's pass mark (20 of 25). Shared by
// baseline results (tracking line) and practice results (pass/fail, Slice 5).
export const PASS_MARK = 0.8;
```

- [ ] **Step 2: Write the failing tests**

`src/topics/topicsData.test.ts`:

```ts
import { toTopics } from './topicsData';

test('sorts by handbook order and keeps title', () => {
  expect(
    toTopics([
      { id: 'signs', data: { title: 'Signs', order: 20 } },
      { id: 'row', data: { title: 'Right of way', order: 5 } },
    ])
  ).toEqual([
    { chunkId: 'row', title: 'Right of way', order: 5 },
    { chunkId: 'signs', title: 'Signs', order: 20 },
  ]);
});

test('falls back to the id for a missing title and sorts a missing order last', () => {
  expect(toTopics([{ id: 'x', data: {} }, { id: 'a', data: { title: 'A', order: 1 } }])).toEqual([
    { chunkId: 'a', title: 'A', order: 1 },
    { chunkId: 'x', title: 'x', order: Number.MAX_SAFE_INTEGER },
  ]);
});
```

`src/review/reviewData.test.ts`:

```ts
import { countMissed, isMissed, toReviewItems } from './reviewData';

const entry = (over: Record<string, unknown> = {}) => ({
  questionId: 'q1',
  chunkId: 'row',
  choice: 'a',
  correctAnswer: 'a',
  correct: true,
  text: 'Q?',
  choices: ['a', 'b'],
  type: 'scenario',
  ...over,
});

test('uses baselineReview when present, perQuestion otherwise', () => {
  const review = toReviewItems({ type: 'baseline', perQuestion: [], baselineReview: [entry()] });
  expect(review).toEqual([
    {
      questionId: 'q1',
      chunkId: 'row',
      text: 'Q?',
      choices: ['a', 'b'],
      type: 'scenario',
      choice: 'a',
      correctAnswer: 'a',
      explanation: null,
      outcome: 'right',
    },
  ]);
  expect(toReviewItems({ type: 'practice', perQuestion: [entry({ explanation: 'Why' })] })?.[0].explanation).toBe('Why');
});

test('no review for a baseline section before the last (answers withheld)', () => {
  expect(toReviewItems({ type: 'baseline', perQuestion: [entry({ correct: null, correctAnswer: null })] })).toBeNull();
});

test('no review for a missing or malformed attempt', () => {
  expect(toReviewItems(undefined)).toBeNull();
  expect(toReviewItems({ type: 'practice', perQuestion: 'nope' })).toBeNull();
});

test('outcomes: wrong, skipped, removed', () => {
  const items = toReviewItems({
    type: 'practice',
    perQuestion: [
      entry({ questionId: 'w', choice: 'b', correct: false }),
      entry({ questionId: 's', choice: null, correct: false }),
      entry({ questionId: 'r', unavailable: true, chunkId: null, correct: null, correctAnswer: null, text: null, choices: null, type: null }),
    ],
  })!;
  expect(items.map((i) => i.outcome)).toEqual(['wrong', 'skipped', 'removed']);
  expect(items[2].type).toBe('fact');
  expect(items.filter(isMissed).map((i) => i.questionId)).toEqual(['w', 's']);
  expect(countMissed(items)).toBe(2);
});

test('attempts saved before ph-4-us-3 have null text and choices', () => {
  const legacy = { questionId: 'q1', chunkId: 'row', choice: 'a', correctAnswer: 'b', correct: false };
  const [item] = toReviewItems({ type: 'practice', perQuestion: [legacy] })!;
  expect(item).toMatchObject({ text: null, choices: null, type: 'fact', outcome: 'wrong' });
});

test('drops malformed entries instead of throwing', () => {
  expect(toReviewItems({ type: 'practice', perQuestion: [null, 5, entry()] })).toHaveLength(1);
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `npm run test:app -- topicsData reviewData`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement**

`src/topics/topicsData.ts`:

```ts
// ph-1-us-9 topics as the app sees them: title and handbook order per chunkId. No Firebase
// imports, so it runs under plain-Node Jest.

export interface Topic {
  chunkId: string;
  title: string;
  /** Handbook page the topic starts on; sorts topics in handbook order. */
  order: number;
}

export function toTopics(docs: { id: string; data: Record<string, unknown> }[]): Topic[] {
  return docs
    .map(({ id, data }) => ({
      chunkId: id,
      title: typeof data.title === 'string' && data.title.trim() !== '' ? data.title : id,
      order: typeof data.order === 'number' ? data.order : Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => a.order - b.order);
}
```

`src/topics/useTopics.ts`:

```ts
import { useEffect, useState } from 'react';
import { getApp } from '@react-native-firebase/app';
import { collection, getDocs, getFirestore } from '@react-native-firebase/firestore';
import { toTopics, type Topic } from './topicsData';

// The topic catalog (titles, handbook order), read once per screen. Firestore's offline cache
// serves it when there's no connection and it was read before. Screens treat 'error' as "no
// titles" and fall back to chunkIds rather than blocking.
export type TopicsState =
  | { status: 'loading' }
  | { status: 'ready'; topics: Topic[] }
  | { status: 'error' };

export function useTopics(): TopicsState {
  const [state, setState] = useState<TopicsState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    getDocs(collection(getFirestore(getApp()), 'topics'))
      .then((snapshot) => {
        if (cancelled) return;
        const docs = snapshot.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }));
        setState({ status: 'ready', topics: toTopics(docs) });
      })
      .catch((error) => {
        console.warn('[topics] read failed', error);
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
```

`src/review/reviewData.ts`:

```ts
// ph-4-us-4: a saved attempt (users/{uid}/testAttempts/{testId}) turned into review items.
// Attempts are server-written but read defensively: old attempts (before ph-4-us-3) have no
// question text, and a malformed entry is dropped rather than breaking the review. No Firebase
// imports, so it runs under plain-Node Jest.

export type ReviewOutcome = 'right' | 'wrong' | 'skipped' | 'removed';

export interface ReviewItem {
  questionId: string;
  chunkId: string | null;
  /** Null when the question was removed, or the attempt predates ph-4-us-3. */
  text: string | null;
  choices: string[] | null;
  /** Unknown types (old attempts, removed questions) show as plain fact questions. */
  type: 'fact' | 'scenario';
  choice: string | null;
  correctAnswer: string | null;
  explanation: string | null;
  outcome: ReviewOutcome;
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function toItem(raw: unknown): ReviewItem | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const q = raw as Record<string, unknown>;
  if (typeof q.questionId !== 'string') return null;
  const choice = str(q.choice);
  const outcome: ReviewOutcome =
    q.unavailable === true ? 'removed' : q.correct === true ? 'right' : choice === null ? 'skipped' : 'wrong';
  return {
    questionId: q.questionId,
    chunkId: str(q.chunkId),
    text: str(q.text),
    choices: Array.isArray(q.choices) && q.choices.every((c) => typeof c === 'string') ? (q.choices as string[]) : null,
    type: q.type === 'scenario' ? 'scenario' : 'fact',
    choice,
    correctAnswer: str(q.correctAnswer),
    explanation: str(q.explanation),
    outcome,
  };
}

/**
 * The questions to review, or null when there's no review to offer: a missing attempt, or a
 * baseline section before the last (answers withheld until the baseline is complete). The
 * final baseline section's `baselineReview` covers all 45 questions.
 */
export function toReviewItems(attempt: Record<string, unknown> | undefined): ReviewItem[] | null {
  if (!attempt) return null;
  const source = attempt.type === 'baseline' ? attempt.baselineReview : attempt.perQuestion;
  if (!Array.isArray(source)) return null;
  return source.map(toItem).filter((item): item is ReviewItem => item !== null);
}

/** Wrong or skipped. Removed questions aren't counted either way. */
export function isMissed(item: ReviewItem): boolean {
  return item.outcome === 'wrong' || item.outcome === 'skipped';
}

export function countMissed(items: ReviewItem[]): number {
  return items.filter(isMissed).length;
}
```

`src/review/useTestAttempt.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { getApp } from '@react-native-firebase/app';
import { doc, getDoc, getFirestore } from '@react-native-firebase/firestore';
import { useAuth } from '../auth/AuthProvider';

// ph-4-us-4: one saved attempt, users/{uid}/testAttempts/{testId}. getDoc falls back to
// Firestore's offline cache when there's no connection, so a review opened before still loads.
// With nothing cached it fails with code 'firestore/unavailable', shown as "No connection".
export type AttemptState =
  | { status: 'loading' }
  | { status: 'ready'; data: Record<string, unknown> | undefined }
  | { status: 'error'; offline: boolean };

export function useTestAttempt(testId: string | null): AttemptState & { retry: () => void } {
  const { uid } = useAuth();
  const [state, setState] = useState<AttemptState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!uid || !testId) return;
    let cancelled = false;
    setState({ status: 'loading' });
    getDoc(doc(getFirestore(getApp()), 'users', uid, 'testAttempts', testId))
      .then((snapshot) => {
        if (!cancelled) setState({ status: 'ready', data: snapshot.data() as Record<string, unknown> | undefined });
      })
      .catch((error: { code?: string }) => {
        console.warn('[review] attempt read failed', error);
        if (!cancelled) setState({ status: 'error', offline: error?.code === 'firestore/unavailable' });
      });
    return () => {
      cancelled = true;
    };
  }, [uid, testId, attempt]);

  return { ...state, retry };
}
```

- [ ] **Step 5: Run to verify they pass**

Run: `npm run test:app` then `npx tsc --noEmit`
Expected: all PASS; no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/api/types.ts src/results src/topics src/review
git commit -m "feat(ph-4-us-4): review and topic data modules, shared PASS_MARK"
```

---

### Task 4: Baseline results data

**Files:**
- Create: `src/results/baselineResultsData.ts`
- Test: `src/results/baselineResultsData.test.ts`

**Interfaces:**
- Consumes: `ReviewItem` (Task 3), `Topic` (Task 3), `PASS_MARK` (Task 3), `BASELINE_TOTAL_SECTIONS`
  (`src/baseline/baselineProgressData.ts`).
- Produces:

```ts
export type TopicResult = 'got-it' | 'missed-it' | 'not-tested';
export interface BaselineSummary {
  correctCount: number;
  totalCount: number;       // excludes removed questions
  percent: number;          // Math.round(correct / total * 100); 0 when total is 0
  atPassMark: boolean;      // raw ratio >= PASS_MARK
  topics: { chunkId: string; title: string; result: TopicResult }[]; // handbook order
  firstMissedChunkId: string | null;
}
export function summarizeBaseline(items: ReviewItem[], topics: Topic[]): BaselineSummary;
export function trackingLine(summary: BaselineSummary): string;
export function finalBaselineTestId(version: string): string;
```

- [ ] **Step 1: Write the failing test** `src/results/baselineResultsData.test.ts`:

```ts
import type { ReviewItem } from '../review/reviewData';
import { finalBaselineTestId, summarizeBaseline, trackingLine } from './baselineResultsData';

const item = (chunkId: string | null, outcome: ReviewItem['outcome']): ReviewItem => ({
  questionId: `q-${chunkId}`,
  chunkId,
  text: 'Q',
  choices: ['a', 'b'],
  type: 'fact',
  choice: outcome === 'skipped' ? null : 'a',
  correctAnswer: 'a',
  explanation: null,
  outcome,
});
const items = (right: number, wrong: number) => [
  ...Array.from({ length: right }, (_, i) => item(`r${i}`, 'right')),
  ...Array.from({ length: wrong }, (_, i) => item(`w${i}`, 'wrong')),
];

test('37 of 45 is 82% and at the mark', () => {
  const s = summarizeBaseline(items(37, 8), []);
  expect(s).toMatchObject({ correctCount: 37, totalCount: 45, percent: 82, atPassMark: true });
  expect(trackingLine(s)).toBe(
    "The real test needs 80%. You're off to a strong start — practice tests will tell you when you're ready."
  );
});

test('exactly 36 of 45 (80%) counts as at the mark', () => {
  expect(summarizeBaseline(items(36, 9), []).atPassMark).toBe(true);
});

test('35 of 45 rounds to 78% and is below the mark', () => {
  const s = summarizeBaseline(items(35, 10), []);
  expect(s).toMatchObject({ percent: 78, atPassMark: false });
  expect(trackingLine(s)).toBe("The real test needs 80%. Here's where to focus first.");
});

test('never says pass or fail', () => {
  for (const [r, w] of [[45, 0], [0, 45], [36, 9]]) {
    expect(trackingLine(summarizeBaseline(items(r, w), []))).not.toMatch(/pass|fail/i);
  }
});

test('topics in handbook order with got it / missed it / not tested; first miss in that order', () => {
  const s = summarizeBaseline(
    [item('b', 'wrong'), item('a', 'right'), item('c', 'skipped'), item(null, 'removed')],
    [
      { chunkId: 'c', title: 'C', order: 3 },
      { chunkId: 'a', title: 'A', order: 1 },
      { chunkId: 'b', title: 'B', order: 2 },
      { chunkId: 'd', title: 'D', order: 4 },
    ].sort((x, y) => x.order - y.order)
  );
  expect(s.topics).toEqual([
    { chunkId: 'a', title: 'A', result: 'got-it' },
    { chunkId: 'b', title: 'B', result: 'missed-it' },
    { chunkId: 'c', title: 'C', result: 'missed-it' },
    { chunkId: 'd', title: 'D', result: 'not-tested' },
  ]);
  expect(s.firstMissedChunkId).toBe('b');
  // The removed question doesn't count.
  expect(s).toMatchObject({ correctCount: 1, totalCount: 3 });
});

test('topics missing from the catalog (or no catalog) still show, titled by chunkId, in review order', () => {
  const s = summarizeBaseline([item('x', 'wrong'), item('a', 'right')], [{ chunkId: 'a', title: 'A', order: 1 }]);
  expect(s.topics).toEqual([
    { chunkId: 'a', title: 'A', result: 'got-it' },
    { chunkId: 'x', title: 'x', result: 'missed-it' },
  ]);
});

test('all correct: no first miss', () => {
  expect(summarizeBaseline(items(45, 0), []).firstMissedChunkId).toBeNull();
});

test('nothing gradable: 0%, not at the mark', () => {
  expect(summarizeBaseline([item(null, 'removed')], [])).toMatchObject({ totalCount: 0, percent: 0, atPassMark: false });
});

test('final attempt id is the last section', () => {
  expect(finalBaselineTestId('v1')).toBe('baseline-v1-3');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:app -- baselineResultsData`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** `src/results/baselineResultsData.ts`:

```ts
import { BASELINE_TOTAL_SECTIONS } from '../baseline/baselineProgressData';
import type { ReviewItem } from '../review/reviewData';
import type { Topic } from '../topics/topicsData';
import { PASS_MARK } from './passMark';

// ph-4-us-6 (baseline results part): the score, how it tracks against the real test's mark,
// and Got it / Missed it per topic. One question per topic, so no "shaky" (prd.md Section 4).
// No Firebase imports, so it runs under plain-Node Jest.

export type TopicResult = 'got-it' | 'missed-it' | 'not-tested';

export interface BaselineSummary {
  correctCount: number;
  /** Graded questions: removed (deleted) questions don't count. */
  totalCount: number;
  percent: number;
  /** On the raw ratio, so exactly 36 of 45 (80%) is at the mark. */
  atPassMark: boolean;
  /** Handbook order; topics missing from the catalog follow, in baseline order. */
  topics: { chunkId: string; title: string; result: TopicResult }[];
  firstMissedChunkId: string | null;
}

export function summarizeBaseline(items: ReviewItem[], topics: Topic[]): BaselineSummary {
  const graded = items.filter((i) => i.outcome !== 'removed');
  const correctCount = graded.filter((i) => i.outcome === 'right').length;
  const totalCount = graded.length;
  const ratio = totalCount === 0 ? 0 : correctCount / totalCount;

  const resultByChunk = new Map<string, TopicResult>();
  for (const i of graded) {
    if (!i.chunkId) continue;
    // Several questions on one topic (not the case for v1): any miss makes it "missed it".
    const result: TopicResult = i.outcome === 'right' ? 'got-it' : 'missed-it';
    if (resultByChunk.get(i.chunkId) !== 'missed-it') resultByChunk.set(i.chunkId, result);
  }

  const known = new Set(topics.map((t) => t.chunkId));
  const rows = [
    ...topics.map((t) => ({ chunkId: t.chunkId, title: t.title, result: resultByChunk.get(t.chunkId) ?? ('not-tested' as const) })),
    // Without these, a failed topics read would leave the list empty.
    ...[...resultByChunk.entries()]
      .filter(([chunkId]) => !known.has(chunkId))
      .map(([chunkId, result]) => ({ chunkId, title: chunkId, result })),
  ];

  return {
    correctCount,
    totalCount,
    percent: Math.round(ratio * 100),
    atPassMark: totalCount > 0 && ratio >= PASS_MARK,
    topics: rows,
    firstMissedChunkId: rows.find((r) => r.result === 'missed-it')?.chunkId ?? null,
  };
}

/**
 * How the score tracks against the real test. Deliberately never says "pass" or "fail": the
 * baseline is one question per topic, not the real 25-question test.
 */
export function trackingLine(summary: BaselineSummary): string {
  const mark = `The real test needs ${Math.round(PASS_MARK * 100)}%.`;
  return summary.atPassMark
    ? `${mark} You're off to a strong start — practice tests will tell you when you're ready.`
    : `${mark} Here's where to focus first.`;
}

/** The final section's attempt holds `baselineReview` (see scoreTest in functions/README.md). */
export function finalBaselineTestId(version: string): string {
  return `baseline-${version}-${BASELINE_TOTAL_SECTIONS}`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:app`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/results
git commit -m "feat(ph-4-us-6): baseline results summary and tracking line"
```

---

### Task 5: Review state on the quiz card

**Files:**
- Modify: `src/quiz/QuizCard.tsx`
- Test: `src/quiz/QuizCard.test.tsx` (create)

**Interfaces:**
- Produces:

```ts
export function QuizCard(props: {
  question: Pick<QuizQuestion, 'text' | 'choices' | 'type'>;
  selected: string | undefined;
  onSelect?: (choice: string) => void;         // unused in review
  review?: { choice: string | null; correctAnswer: string | null };
}): JSX.Element;
```

In review: choices are not pressable; the correct choice has a `success` border, `successSoft`
fill and a "Correct answer" tag; the user's wrong choice has an `alert` border and a "Your
answer" tag; a right choice gets "Your answer · Correct". Each choice's accessibility label
includes its tags.

- [ ] **Step 1: Write the failing test** `src/quiz/QuizCard.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QuizCard } from './QuizCard';

const question = { text: 'Q?', choices: ['Stop', 'Go', 'Yield'], type: 'scenario' as const };

test('review marks a wrong pick and the correct answer, and is not pressable', async () => {
  const onSelect = jest.fn();
  await render(
    <QuizCard question={question} selected={undefined} onSelect={onSelect} review={{ choice: 'Go', correctAnswer: 'Stop' }} />
  );
  expect(screen.getByLabelText('Stop, correct answer')).toBeTruthy();
  expect(screen.getByLabelText('Go, your answer')).toBeTruthy();
  expect(screen.getByText('Correct answer')).toBeTruthy();
  expect(screen.getByText('Your answer')).toBeTruthy();
  expect(screen.getByText('SCENARIO')).toBeTruthy();
  await fireEvent.press(screen.getByText('Yield'));
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.queryByRole('radio')).toBeNull();
});

test('review of a right pick shows one combined tag', async () => {
  await render(<QuizCard question={question} selected={undefined} review={{ choice: 'Stop', correctAnswer: 'Stop' }} />);
  expect(screen.getByLabelText('Stop, your answer, correct')).toBeTruthy();
  expect(screen.getByText('Your answer · Correct')).toBeTruthy();
});

test('taking a test is unchanged: radios that select', async () => {
  const onSelect = jest.fn();
  await render(<QuizCard question={question} selected="Go" onSelect={onSelect} />);
  expect(screen.getAllByRole('radio')).toHaveLength(3);
  await fireEvent.press(screen.getByText('Yield'));
  expect(onSelect).toHaveBeenCalledWith('Yield');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:components -- QuizCard`
Expected: FAIL — no review labels.

- [ ] **Step 3: Implement** — change the props as in Interfaces (`onSelect` optional), update the
  file's header comment to "…with no answer reveal while taking a test, and a read-only review
  state (ph-4-us-4) that marks the user's choice and the correct one." Replace the choices block
  with a branch:

```tsx
      {review ? (
        <View style={styles.choices}>
          {question.choices.map((choice) => {
            const isCorrect = choice === review.correctAnswer;
            const isMine = choice === review.choice;
            const tag = isMine && isCorrect ? 'Your answer · Correct' : isCorrect ? 'Correct answer' : isMine ? 'Your answer' : null;
            const label = [choice, isMine && 'your answer', isCorrect && (isMine ? 'correct' : 'correct answer')]
              .filter(Boolean)
              .join(', ');
            return (
              <View
                key={choice}
                accessible
                accessibilityLabel={label}
                style={[styles.choice, isCorrect && styles.choiceCorrect, isMine && !isCorrect && styles.choiceWrong]}
              >
                <Text style={[typography.body, styles.choiceText]}>{choice}</Text>
                {tag && (
                  <Text style={[typography.small, isCorrect ? styles.tagCorrect : styles.tagWrong]}>{tag}</Text>
                )}
              </View>
            );
          })}
        </View>
      ) : (
        /* existing radiogroup, unchanged, calling onSelect?.(choice) */
      )}
```

Add styles:

```ts
  choiceCorrect: { borderColor: colors.success, backgroundColor: colors.successSoft, borderWidth: 2 },
  choiceWrong: { borderColor: colors.alert, borderWidth: 2 },
  tagCorrect: { color: colors.success },
  tagWrong: { color: colors.alert },
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:components` then `npx tsc --noEmit`
Expected: all PASS (existing runner tests unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/quiz
git commit -m "feat(ph-4-us-4): read-only review state on the quiz card"
```

---

### Task 6: Review screen

**Files:**
- Create: `src/navigation/openConcept.ts`, `src/review/ReviewScreen.tsx`
- Modify: `src/navigation/types.ts`, `src/navigation/RootNavigator.tsx`
- Test: `src/review/ReviewScreen.test.tsx`

**Interfaces:**
- Consumes: `useTestAttempt`, `toReviewItems`, `isMissed`, `countMissed`, `useTopics` (Task 3);
  `QuizCard` review state (Task 5).
- Produces: route `Review: { testId: string }` on `RootStackParamList`;
  `openConcept(navigation: NavigationProp<RootStackParamList>, chunkId: string): void`.

Screen behaviour (ph-4-us-4):
- Loading → blank background. Error → `NoConnection` (offline) or `NoConnection title="Something went wrong"`, both with retry.
- `toReviewItems` returns null → "No review yet" + body "Answers show once the whole baseline is done." + Back button.
- Header row: caption "REVIEW", "Question i of n", a "Missed only" switch-like toggle button
  (`accessibilityRole="switch"`, `accessibilityState={{ checked }}`), defaulting on when
  `countMissed > 0`. When on and there are no misses, show "No misses" and turn it off.
- Strip: one chip per shown question, `success` fill for right, `alert` border+text for
  wrong/skipped, neutral for removed; label `Question 3, wrong` / `right` / `not answered` / `removed`.
- Body per item:
  - `removed` → Card with "This question was removed" (small note "It doesn't count toward your score.").
  - `text` null → Card with "Question text unavailable", then "Your answer: X" / "Not answered" and "Correct answer: Y".
  - else `QuizCard` in review with `review={{ choice, correctAnswer }}`; above it, "Not answered" when skipped.
  - Below: explanation panel (`Card`, caption "WHY", body text) when `explanation`; otherwise
    "From the handbook: <topic title>" and a text Button "Study this concept" → `openConcept`.
- Back / Next bar like the runner (`Button` secondary + primary; last question's primary is "Done" → `navigation.goBack()`).

- [ ] **Step 1: Write the failing test** `src/review/ReviewScreen.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { ReviewScreen } from './ReviewScreen';
import type { AttemptState } from './useTestAttempt';

jest.mock('@react-native-firebase/app', () => ({ getApp: jest.fn() }));
let mockAttempt: AttemptState = { status: 'loading' };
const mockRetry = jest.fn();
jest.mock('./useTestAttempt', () => ({ useTestAttempt: () => ({ ...mockAttempt, retry: mockRetry }) }));
jest.mock('../topics/useTopics', () => ({
  useTopics: () => ({ status: 'ready', topics: [{ chunkId: 'row', title: 'Right of way', order: 1 }] }),
}));

const q = (id: string, over: Record<string, unknown> = {}) => ({
  questionId: id,
  chunkId: 'row',
  choice: 'a',
  correctAnswer: 'a',
  correct: true,
  text: `Text ${id}`,
  choices: ['a', 'b'],
  type: 'fact',
  ...over,
});
const ready = (perQuestion: unknown[], type = 'practice') => {
  mockAttempt = {
    status: 'ready',
    data: type === 'baseline' ? { type, perQuestion: [], baselineReview: perQuestion } : { type, perQuestion },
  };
};

const Stack = createNativeStackNavigator();
async function renderReview() {
  return render(
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Review" component={ReviewScreen} initialParams={{ testId: 't1' }} />
        <Stack.Screen name="Main">{() => <Text>Study tab</Text>}</Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

beforeEach(() => jest.clearAllMocks());

test('missed only is on by default when there are misses, and shows wrong and skipped', async () => {
  ready([q('q1'), q('q2', { choice: 'b', correct: false }), q('q3', { choice: null, correct: false })]);
  await renderReview();
  expect(screen.getByRole('switch', { name: 'Missed only' }).props.accessibilityState.checked).toBe(true);
  expect(screen.getByText('Question 1 of 2')).toBeTruthy();
  expect(screen.getByText('Text q2')).toBeTruthy();
  expect(screen.getByLabelText('b, your answer')).toBeTruthy();
  await fireEvent.press(screen.getByText('Next'));
  expect(screen.getByText('Text q3')).toBeTruthy();
  expect(screen.getByText('Not answered')).toBeTruthy();
});

test('turning missed only off shows every question', async () => {
  ready([q('q1'), q('q2', { choice: 'b', correct: false })]);
  await renderReview();
  await fireEvent.press(screen.getByRole('switch', { name: 'Missed only' }));
  expect(screen.getByText('Question 1 of 2')).toBeTruthy();
  expect(screen.getByText('Text q1')).toBeTruthy();
});

test('all correct: missed only starts off; turning it on says No misses', async () => {
  ready([q('q1')]);
  await renderReview();
  const toggle = screen.getByRole('switch', { name: 'Missed only' });
  expect(toggle.props.accessibilityState.checked).toBe(false);
  await fireEvent.press(toggle);
  expect(screen.getByText('No misses')).toBeTruthy();
  expect(screen.getByText('Text q1')).toBeTruthy();
});

test('explanation panel when present; handbook topic and Study link otherwise', async () => {
  ready([q('q1', { explanation: 'Because a.' }), q('q2')]);
  await renderReview();
  expect(screen.getByText('Because a.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Next'));
  expect(screen.getByText('From the handbook: Right of way')).toBeTruthy();
  await fireEvent.press(screen.getByText('Study this concept'));
  expect(await screen.findByText('Study tab')).toBeTruthy();
});

test('removed and pre-ph-4-us-3 questions', async () => {
  ready([
    q('gone', { unavailable: true, chunkId: null, correct: null, correctAnswer: null, text: null, choices: null, type: null }),
    { questionId: 'old', chunkId: 'row', choice: 'b', correctAnswer: 'a', correct: false },
  ]);
  await renderReview();
  await fireEvent.press(screen.getByRole('switch', { name: 'Missed only' })); // show all
  expect(screen.getByText('This question was removed')).toBeTruthy();
  await fireEvent.press(screen.getByText('Next'));
  expect(screen.getByText('Question text unavailable')).toBeTruthy();
  expect(screen.getByText('Your answer: b')).toBeTruthy();
  expect(screen.getByText('Correct answer: a')).toBeTruthy();
});

test('scenario questions keep the badge', async () => {
  ready([q('q1', { type: 'scenario' })]);
  await renderReview();
  expect(screen.getByText('SCENARIO')).toBeTruthy();
});

test('baseline still in progress: no review', async () => {
  mockAttempt = { status: 'ready', data: { type: 'baseline', perQuestion: [q('q1', { correct: null, correctAnswer: null })] } };
  await renderReview();
  expect(screen.getByText('No review yet')).toBeTruthy();
});

test('baseline complete: reviews all of baselineReview', async () => {
  ready(Array.from({ length: 45 }, (_, i) => q(`b${i}`)), 'baseline');
  await renderReview();
  expect(screen.getByText('Question 1 of 45')).toBeTruthy();
});

test('offline with nothing cached: no connection with retry', async () => {
  mockAttempt = { status: 'error', offline: true };
  await renderReview();
  expect(screen.getByText('No connection')).toBeTruthy();
  await fireEvent.press(screen.getByText('Try again'));
  expect(mockRetry).toHaveBeenCalled();
});
```

(Check `NoConnection`'s default title and retry label in `src/components/NoConnection.tsx` and
match them in the last test.)

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:components -- ReviewScreen`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/navigation/types.ts` — add to `RootStackParamList`:

```ts
  /** Question-by-question review of a graded attempt (ph-4-us-4). */
  Review: { testId: string };
```

`src/navigation/openConcept.ts`:

```ts
import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from './types';

// Every "go study this topic" link (baseline results, review) goes through here. The Study tab
// is still the concept-list placeholder, so this opens the tab; Slice 4a (ph-2-us-7 / us-3)
// changes this one function to open the topic's flashcards.
export function openConcept(navigation: NavigationProp<RootStackParamList>, _chunkId: string): void {
  navigation.navigate('Main', { screen: 'Study' });
}
```

`src/review/ReviewScreen.tsx` — implement per the behaviour list above, using:
`const { testId } = useRoute<RouteProp<RootStackParamList, 'Review'>>().params;`
`const attempt = useTestAttempt(testId);` `const topics = useTopics();`
`const items = attempt.status === 'ready' ? toReviewItems(attempt.data) : null;`
State: `const [missedOnly, setMissedOnly] = useState<boolean | null>(null)` — `null` means "not
chosen yet", resolved to `countMissed(items) > 0` once items load (so the default follows the
data); `const [index, setIndex] = useState(0)`, reset to 0 whenever the filter changes.
`const shown = missedOnly && countMissed(items) > 0 ? items.filter(isMissed) : items;`
When the user turns the filter on with zero misses, keep `missedOnly` false and set a
`noMisses` flag that renders "No misses" under the header. Topic title:
`topics.status === 'ready' ? topics.topics.find(t => t.chunkId === item.chunkId)?.title : undefined`,
falling back to "this topic" in the copy ("From the handbook: this topic") when unknown.
Reuse the strip pattern from `QuizRunner` (horizontal `ScrollView`, 36pt chips, `stripScrollX`
exported from `src/quiz/QuizRunner.tsx` for auto-centring). Header comment:
`// ph-4-us-4: step through a graded attempt. Reads the saved attempt, so it works right after a
// test and later from history. The baseline reviews its final attempt's baselineReview (all 45).`

`src/navigation/RootNavigator.tsx` — import `ReviewScreen` and add below `Baseline`:

```tsx
        <RootStack.Screen name="Review" component={ReviewScreen} options={{ title: 'Review answers' }} />
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:components` then `npx tsc --noEmit`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/review src/navigation
git commit -m "feat(ph-4-us-4): question review screen with missed-only filter"
```

---

### Task 7: Baseline results screen

**Files:**
- Create: `src/results/BaselineResults.tsx`
- Delete: `src/baseline/BaselineComplete.tsx`
- Modify: `src/baseline/baselineProgressData.ts`, `src/baseline/baselineProgressData.test.ts`,
  `src/baseline/BaselineScreen.tsx`, `src/baseline/baselineFlow.test.tsx`,
  `src/home/HomeScreen.tsx`, `src/onboarding/onboardingFlow.test.tsx` (only if the card copy it
  asserts changes)

**Interfaces:**
- Consumes: `summarizeBaseline`, `trackingLine`, `finalBaselineTestId` (Task 4); `toReviewItems`,
  `useTestAttempt` (Task 3); `useTopics` (Task 3); `openConcept`, `Review` route (Task 6).
- Produces: `BaselineProgress` `complete` variant becomes `{ status: 'complete'; version: string }`;

```ts
export function BaselineResults(props: {
  /** Right after submit: the final section's baselineReview. Null when reopened later. */
  review: PerQuestionResult[] | null;
  /** The final attempt to load (and to open in Review), e.g. baseline-v1-3. */
  testId: string;
  onDone: () => void;
}): JSX.Element;
```

Screen (ScrollView, `colors.background`):
1. `typography.h1` "Your baseline results".
2. `typography.display` "{percent}%" and `typography.bodySemibold` "{correct} of {total} right"
   — combined accessibility label "82%, 37 of 45 right".
3. `typography.body` tracking line (`trackingLine`).
4. Buttons: primary "Start with what you missed" (only when `firstMissedChunkId`) →
   `openConcept(navigation, firstMissedChunkId)`; secondary "Review answers" →
   `navigation.navigate('Review', { testId })`.
5. `typography.caption` "BY TOPIC", `typography.small` "One question per topic, so this is only
   a rough guide."
6. One pressable row per topic (min height 48): title + a pill "Got it" (`successSoft`/`success`),
   "Missed it" (`alert` text, `alert` border), or "Not tested" (neutral `line`/`inkSoft`).
   Row `accessibilityLabel` "{title}, {Got it|Missed it|Not tested}", press →
   `openConcept(navigation, chunkId)`.
7. Text button "Back to Home" → `onDone`.

Data: `const attempt = useTestAttempt(review ? null : testId);` (no read when the review is in
memory); items = `review ? toReviewItems({ type: 'baseline', baselineReview: review }) :
toReviewItems(attempt.data)`. Loading → blank; attempt error → `NoConnection` (offline) or
"Something went wrong", with retry; items null (attempt missing) → "Something went wrong" with
retry. Topics still loading → render with `[]` topics (rows fall back to chunkIds and refresh
when titles arrive).

- [ ] **Step 1: Write the failing tests**

`baselineProgressData.test.ts` — change the complete expectation to
`expect(toBaselineProgress({ completedAt: {}, version: 'v1' })).toEqual({ status: 'complete', version: 'v1' });`
and add `expect(toBaselineProgress({ completedAt: {} })).toEqual({ status: 'complete', version: 'v1' });`
(missing version falls back to `'v1'`, the only version so far).

`baselineFlow.test.tsx` — add at the top, alongside the other mocks:

```tsx
jest.mock('../topics/useTopics', () => ({
  useTopics: () => ({ status: 'ready', topics: [] }),
}));
let mockAttempt: { status: string; data?: Record<string, unknown>; offline?: boolean } = { status: 'loading' };
jest.mock('../review/useTestAttempt', () => ({
  useTestAttempt: (testId: string | null) => (testId ? { ...mockAttempt, retry: jest.fn() } : { status: 'loading', retry: jest.fn() }),
}));
```

and a `Review` screen in `flowTree` (`<Stack.Screen name="Review">{() => <Text>Review screen</Text>}</Stack.Screen>`).
Replace the three "Baseline done" tests and add:

```tsx
const reviewOf = (right: number, total = 45) =>
  Array.from({ length: total }, (_, i) => ({
    questionId: `r${i}`,
    chunkId: `c${i}`,
    choice: i < right ? 'x' : 'y',
    correctAnswer: 'x',
    correct: i < right,
    text: `T${i}`,
    choices: ['x', 'y'],
    type: 'fact',
  }));

test('section 3 submit shows results from baselineReview: 82%, 37 of 45, tracking line, topics', async () => {
  mockProgress = { status: 'in-progress', currentSection: 3, totalSections: 3 };
  mockStart.mockResolvedValueOnce(sectionOf(3));
  mockScore.mockResolvedValueOnce(graded(3, { baselineReview: reviewOf(37) }));
  await renderFlow();
  await screen.findByText('Section 3 of 3');
  await answerAllAndSubmit(3);

  expect(await screen.findByText('82%')).toBeTruthy();
  expect(screen.getByText('37 of 45 right')).toBeTruthy();
  expect(screen.getByText(/The real test needs 80%\. You're off to a strong start/)).toBeTruthy();
  expect(screen.queryByText(/pass|fail/i)).toBeNull();
  expect(screen.getByLabelText('c0, Got it')).toBeTruthy();
  expect(screen.getByLabelText('c37, Missed it')).toBeTruthy();
});

test('below the mark says where to focus; Start with what you missed opens the Study tab', async () => {
  mockProgress = { status: 'in-progress', currentSection: 3, totalSections: 3 };
  mockStart.mockResolvedValueOnce(sectionOf(3));
  mockScore.mockResolvedValueOnce(graded(3, { baselineReview: reviewOf(30) }));
  await renderFlow();
  await screen.findByText('Section 3 of 3');
  await answerAllAndSubmit(3);
  expect(await screen.findByText("The real test needs 80%. Here's where to focus first.")).toBeTruthy();
  await fireEvent.press(screen.getByText('Start with what you missed'));
  expect(navRef.getCurrentRoute()?.name).toBe('Main');
});

test('Review answers opens the review for the final attempt', async () => {
  mockProgress = { status: 'in-progress', currentSection: 3, totalSections: 3 };
  mockStart.mockResolvedValueOnce(sectionOf(3));
  mockScore.mockResolvedValueOnce(graded(3, { baselineReview: reviewOf(45) }));
  await renderFlow();
  await screen.findByText('Section 3 of 3');
  await answerAllAndSubmit(3);
  expect(await screen.findByText('100%')).toBeTruthy();
  expect(screen.queryByText('Start with what you missed')).toBeNull();
  await fireEvent.press(screen.getByText('Review answers'));
  expect(navRef.getCurrentRoute()).toMatchObject({ name: 'Review', params: { testId: 'baseline-v1-3' } });
});

test('reopening a completed baseline loads results from the final attempt', async () => {
  mockProgress = { status: 'complete', version: 'v1' };
  mockAttempt = { status: 'ready', data: { type: 'baseline', perQuestion: [], baselineReview: reviewOf(30) } };
  await renderFlow();
  expect(await screen.findByText('67%')).toBeTruthy();
  expect(screen.getByText('30 of 45 right')).toBeTruthy();
  expect(mockStart).not.toHaveBeenCalled();
});

test('reopening while offline with nothing cached shows no connection', async () => {
  mockProgress = { status: 'complete', version: 'v1' };
  mockAttempt = { status: 'error', offline: true };
  await renderFlow();
  expect(await screen.findByText('No connection')).toBeTruthy();
});

test('already-exists from startOrResumeBaseline shows results, not an error', async () => {
  mockProgress = { status: 'in-progress', currentSection: 3, totalSections: 3 };
  mockAttempt = { status: 'ready', data: { type: 'baseline', perQuestion: [], baselineReview: reviewOf(40) } };
  mockStart.mockRejectedValueOnce(new CallableError('already-exists', 'already-exists', 'done'));
  await renderFlow();
  expect(await screen.findByText('89%')).toBeTruthy();
});
```

Reset `mockAttempt = { status: 'loading' }` in the existing `beforeEach`.

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test:app -- baselineProgressData` and `npm run test:components -- baselineFlow`
Expected: FAIL — no `version` on complete; placeholder text instead of results.

- [ ] **Step 3: Implement**

`baselineProgressData.ts`: the union's complete member becomes
`| { status: 'complete'; version: string }` and the branch
`if (data.completedAt) return { status: 'complete', version: typeof data.version === 'string' ? data.version : 'v1' };`
with a comment: "version names the final attempt doc that holds the results (ph-4-us-6)".

Then run `git grep -n "status: 'complete'" src` and add `version: 'v1'` to every
`BaselineProgress` literal it finds in tests (e.g. `onboardingFlow.test.tsx`'s Home card mock),
so `npx tsc --noEmit` stays clean.

`BaselineScreen.tsx`:
- `Phase` complete member → `{ kind: 'complete'; review: PerQuestionResult[] | null; testId: string | null }`.
- Initial decision: `setPhase({ kind: 'complete', review: null, testId: finalBaselineTestId(progress.version) })`.
- `already-exists` in `load`: `setPhase({ kind: 'complete', review: null, testId: null })` — the
  version comes from progress, which will report complete shortly.
- `submit`: keep `result.baselineReview` (drop `correctCount`/`totalCount` locals) and on the
  last section `setPhase({ kind: 'complete', review: baselineReview ?? null, testId: section.testId })`.
- Render:

```tsx
    case 'complete': {
      const testId =
        phase.testId ?? (progress.status === 'complete' ? finalBaselineTestId(progress.version) : null);
      // already-exists before progress catches up: wait a beat for the version.
      if (!testId) return <View style={styles.blank} />;
      return <BaselineResults review={phase.review} testId={testId} onDone={goHome} />;
    }
```

- Update the file's imports (`BaselineResults`, `finalBaselineTestId`, `PerQuestionResult`);
  delete `src/baseline/BaselineComplete.tsx`.

`src/results/BaselineResults.tsx`: implement per the screen list above, header comment
`// ph-4-us-6 (baseline results part): score, how it tracks against the real test's 80% mark,
// and Got it / Missed it per topic, with links into study and the 45-question review. Replaces
// Slice 2's placeholder. The Progress-tab concept report is Slice 4b.`
Use `useNavigation<NavigationProp<RootStackParamList>>()`.

`HomeScreen.tsx` "Baseline done" card body → `"See your score and what to work on first."`
(update `onboardingFlow.test.tsx` only if it asserts the old body).

- [ ] **Step 4: Run to verify they pass**

Run: `npm run test:app && npm run test:components && npx tsc --noEmit`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat(ph-4-us-6): baseline results screen replaces the placeholder"
```

---

### Task 8: Device test, docs and status

**Files:**
- Modify: `docs/phases/phase-4-scoring-and-review/ph-4-us-{2,3,4,6}-*.md`, `phase-4-summary.md`,
  `docs/build-order.md`, `docs/history/LOG.md`

- [ ] **Step 1: Full suites**

Run: `npm run test:functions && npm run test:question-bank && npm run test:app && npm run test:components && npx tsc --noEmit`
Expected: all PASS. Report counts.

- [ ] **Step 2: Device test on the Android emulator against dev** (functions from Task 2 must be
  deployed). Clear app data first (Slice 2 attempts have no question text). No native deps were
  added, so no dev-client rebuild. `npx expo start --dev-client`, then walk the Slice 3 test line
  in `docs/build-order.md`: finish the baseline → percentage, N of 45, tracking line, 45 topics
  in handbook order → Review answers (missed-only default, explanation fallback line, Study link)
  → back → tap a topic and "Start with what you missed" land on the Study tab → Home → reopen
  from the "Baseline done" card shows the same results → force-quit and reopen offline shows the
  cached results. Note anything that fails and fix it before continuing.

- [ ] **Step 3: Docs** — mark ph-4-us-3 and ph-4-us-4 Complete with their criteria ticked
  (ph-4-us-4's practice/mini-quiz entry points stay unticked until Slices 4b/5); ph-4-us-2
  Complete for the baseline, open for practice/mini-quiz history; ph-4-us-6 "In Progress —
  baseline results part done (Slice 3)" with its first four criteria ticked. Record the plan's
  "Decisions made while planning" in the relevant story Context sections (the `type` field, the
  seeded choice order, the Study-tab stub link). Update the Phase 4 summary and set
  `docs/build-order.md` Slice 3 **Status: Complete (<date>)** with what the device test found.

- [ ] **Step 4: Log** — append a one-line entry to `docs/history/LOG.md` (project-history skill).

- [ ] **Step 5: Commit**

```bash
git add docs
git commit -m "docs: Slice 3 (results) complete"
```
