# Slice 4a — Concept List and Flashcards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From "Learn first", a baseline results topic or a review link, a teen reaches a concept
list in handbook order, opens a topic, and flips through its flashcards (scenario cards badged)
to an end-of-deck screen offering the mini-quiz (placeholder) or "Start this concept over".
Opening a topic marks it "in progress"; topics with no approved questions show "coming soon";
Home's study card continues the last topic opened.

**Architecture:** A new `users/{uid}/conceptProgress/{chunkId}` record: the client writes only
`status` (rules-enforced), and `scoreTest` merges the mini-quiz score in the same transaction as
the attempt. The app gets pure, Node-tested modules under `src/study/` (status rules, deck
position, concept rows) wrapped by thin Firebase hooks (`useConceptProgress`,
`useFlashcardDeck`), a session-only deck cache, a `FlipCard` built on React Native's own
`Animated`, a `Flashcards` root-stack screen and the concept list as the Study tab's root.

**Tech Stack:** Firebase Cloud Functions v2 + Admin SDK (Jest against the Firestore emulator,
`npm run test:functions`), Firestore rules (`npm run test:rules`, `@firebase/rules-unit-testing`),
Expo SDK 57, React Navigation 7, `@react-native-firebase/firestore` / `functions` v26 modular API,
Jest (`test:app` = Node ts-jest for `*.test.ts`, `test:components` = jest-expo for `*.test.tsx`).

**Spec:** `docs/superpowers/specs/2026-10-03-slice-4a-concept-list-flashcards-design.md`, and the
stories it points to: `docs/phases/phase-2-flashcard-study-mode/ph-2-us-11-concept-progress-record-and-rules.md`,
`ph-2-us-12-concept-progress-client.md`, `ph-2-us-7-concept-list-with-status.md`,
`ph-2-us-3-flashcard-browse-ui.md`, `ph-2-us-5-scenario-cards-woven-in.md`, parent
`ph-2-us-10-concept-progress-saved.md` (status transitions table). Backend contract:
`functions/README.md` (`getFlashcards`, `scoreTest`).

## Decisions made while planning (flag to the user at review)

- **A tap mid-flip turns the card back smoothly** instead of being ignored. `Animated.timing` is
  interruptible, so no input lock is needed (a lock released by the animation's completion
  callback can stick, because that callback is unreliable under the native driver). The spec
  was updated to match.
- **`useConceptProgress` reports `error` separately from an empty map.** The concept list treats
  an error as "everything not started", but the flashcard viewer never calls `markOpened` from an
  unknown status, so a failed read can't downgrade a reviewed topic.
- **Last-opened is saved as soon as a deck loads**, independent of the status read, so Home's
  shortcut works even if Concept Progress can't be read.
- **End of deck also has a "Back to the last card" text button**, so screen-reader and
  non-swipe users can step back without the header Back leaving the topic.
- **The viewer's header shows the topic title** once topics load (falls back to "Flashcards").
- **A topic doc missing `approvedQuestionCount` counts as 0** ("coming soon"). `publish-topics`
  always writes it, so this only guards against a malformed doc.
- **The Study tab header stays "Study"**; the list has its own intro line.

## Global Constraints

- Colors, spacing, radius and type come only from `src/theme/tokens.ts`. No new hex values.
- Status chips: `primarySoft` in progress, `successSoft` reviewed, `secondarySoft` needs revisit,
  neutral (background + `line` border) not started. Every chip carries its text label, never
  color alone.
- Reuse `src/components/Button.tsx`, `Card.tsx`, `NoConnection.tsx`, `PlaceholderScreen.tsx`.
- Tap targets ≥ 48pt.
- Flashcards never show answer choices. Front = question text only; back = correct answer only,
  labelled "Answer". No right/wrong marking, nothing recorded per card.
- No new native modules: flip uses `Animated`, swipe uses `PanResponder`. No dev-client rebuild.
- Screens never write `status` directly: only `markOpened` / `setStatusFromChoice` in
  `src/study/conceptProgress.ts`. `not-started` is never stored (it's the absence of a doc).
- Flashcard decks live only in memory for the app session. Never persist them to the device
  (extraction prevention, ph-1-us-10).
- Pure data modules never import native Firebase modules (`topicsData.ts` vs `useTopics.ts`
  split); they stay testable under `npm run test:app`.
- Every Cloud Function change follows the `cloud-function-documentation` skill (summary doc
  comment + inline "why" comments).
- `src/api/types.ts` is a hand-kept copy of the function contracts: change it alongside
  `functions/README.md`.

## Review Focus

1. **Status still loading or unreadable when the deck loads.** A reviewed topic must never be
   written back to "in progress". → Task 6 test "never writes status while progress is loading
   or unreadable".
2. **Reopening a topic in the same session, or offline after it loaded.** No second
   `getFlashcards` call (rate limit, offline). → Task 6 test "reopening a topic this session
   makes no new call".
3. **A results or review link into a topic with no approved questions.** "Nothing here yet" with
   a Back button, no status write, not remembered for Home. → Task 6 error-state tests.
4. **A one-card topic.** Previous disabled, Next goes straight to the end, start over works. →
   Task 6 test "one-card topic".
5. **The remembered topic is no longer in the catalog, or topics haven't loaded.** Home falls
   back to "Learn concept by concept" rather than a broken card. → Task 8 tests.

---

## File Structure

**Backend**
- Modify `firestore.rules` — `conceptProgress` match block.
- Modify `firestore-tests/rules.test.ts` — Concept Progress allow/deny cases.
- Modify `functions/src/scoreTest.ts` — mini-quiz score merge.
- Modify `functions/src/scoreTest.test.ts` — merge tests.
- Modify `functions/README.md` — `scoreTest` persistence, `conceptProgress` record.

**Client data**
- Create `src/study/conceptProgressData.ts` (+ `.test.ts`) — statuses, `toProgress`,
  `progressFor`, `nextStatus`, `statusForChoice`. Pure.
- Create `src/study/conceptProgress.ts` (+ `.test.ts`) — subscribe, `markOpened`,
  `setStatusFromChoice`. Firebase.
- Create `src/study/useConceptProgress.ts` — live map hook.
- Modify `src/topics/topicsData.ts` (+ test) — `description`, `approvedQuestionCount`.
- Modify `src/topics/useTopics.ts` — `retry()`.
- Modify `src/results/baselineResultsData.test.ts` — Topic fixtures gain the new fields.
- Modify `src/api/types.ts`, `src/api/callables.ts` — `Flashcard`, `FlashcardDeck`,
  `getFlashcards`.
- Create `src/study/deck.ts` (+ `.test.ts`) — deck reducer, shuffle, swipe, error mapping. Pure.
- Create `src/study/flashcardCache.ts` (+ `.test.ts`) — session cache.
- Create `src/study/useFlashcardDeck.ts` — load via cache or callable.
- Modify `src/profile/localFlags.ts`, create `src/profile/localFlags.test.ts` — last-opened
  topic.

**UI**
- Create `src/components/ScenarioBadge.tsx`; modify `src/quiz/QuizCard.tsx` to use it.
- Create `src/study/FlipCard.tsx` (+ `.test.tsx`).
- Create `src/study/FlashcardScreen.tsx` (+ `.test.tsx`).
- Create `src/study/conceptList.ts` (+ `.test.ts`) — rows for the list. Pure.
- Create `src/study/ConceptListScreen.tsx` (+ `.test.tsx`).
- Modify `src/navigation/types.ts`, `RootNavigator.tsx`, `openConcept.ts`.
- Modify `src/home/HomeScreen.tsx`.
- Modify tests that follow the new links: `src/baseline/baselineFlow.test.tsx`,
  `src/review/ReviewScreen.test.tsx`, `src/onboarding/onboardingFlow.test.tsx`.

---

### Task 1: Concept Progress security rules (ph-2-us-11)

**Files:**
- Modify: `firestore.rules` (after the `baseline` block, before `topics`)
- Test: `firestore-tests/rules.test.ts` (append)

**Interfaces:**
- Produces: `users/{uid}/conceptProgress/{chunkId}` — client may create/update only
  `{ status: 'in-progress' | 'reviewed' | 'needs-revisit', statusUpdatedAt: serverTimestamp() }`;
  owner-only read; no delete.

- [ ] **Step 1: Write the failing tests** — append to `firestore-tests/rules.test.ts`:

```ts
// ph-2-us-11: Concept Progress. The client may set only `status` (one of three values) and a
// server `statusUpdatedAt`; the score fields belong to scoreTest. Owner-only, never deleted.
describe('users/{uid}/conceptProgress (ph-2-us-11)', () => {
  const path = 'users/alice-uid/conceptProgress/row';
  const alice = () => testEnv.authenticatedContext('alice-uid').firestore();
  const seed = (docPath: string, data: Record<string, unknown>) =>
    testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), docPath), data);
    });
  const scored = { latestMiniQuizScore: 0.6, latestMiniQuizAt: new Date(), latestTestId: 't1' };

  test('the owner can read their own doc', async () => {
    await seed(path, { status: 'reviewed' });
    await assertSucceeds(getDoc(doc(alice(), path)));
  });

  test("reading another user's doc is denied", async () => {
    await seed('users/bob-uid/conceptProgress/row', { status: 'reviewed' });
    await assertFails(getDoc(doc(alice(), 'users/bob-uid/conceptProgress/row')));
  });

  test.each(['in-progress', 'reviewed', 'needs-revisit'])(
    'creating with status %s and a server statusUpdatedAt succeeds',
    async (status) => {
      await assertSucceeds(
        setDoc(doc(alice(), path), { status, statusUpdatedAt: serverTimestamp() })
      );
    }
  );

  test.each(['not-started', 'done', ''])('status "%s" is denied', async (status) => {
    await assertFails(setDoc(doc(alice(), path), { status, statusUpdatedAt: serverTimestamp() }));
  });

  test('a client-chosen statusUpdatedAt is denied', async () => {
    await assertFails(setDoc(doc(alice(), path), { status: 'reviewed', statusUpdatedAt: new Date() }));
  });

  test('creating without statusUpdatedAt is denied', async () => {
    await assertFails(setDoc(doc(alice(), path), { status: 'reviewed' }));
  });

  test('creating with a score is denied', async () => {
    await assertFails(
      setDoc(doc(alice(), path), {
        status: 'reviewed',
        statusUpdatedAt: serverTimestamp(),
        latestMiniQuizScore: 1,
      })
    );
  });

  test('creating with an unknown key is denied', async () => {
    await assertFails(
      setDoc(doc(alice(), path), { status: 'reviewed', statusUpdatedAt: serverTimestamp(), note: 'x' })
    );
  });

  test('the owner can set status on a doc scoreTest already wrote', async () => {
    await seed(path, scored);
    await assertSucceeds(
      setDoc(doc(alice(), path), { status: 'reviewed', statusUpdatedAt: serverTimestamp() }, { merge: true })
    );
  });

  test('changing a score field on update is denied', async () => {
    await seed(path, { ...scored, status: 'in-progress', statusUpdatedAt: new Date() });
    await assertFails(
      updateDoc(doc(alice(), path), {
        status: 'reviewed',
        statusUpdatedAt: serverTimestamp(),
        latestMiniQuizScore: 1,
      })
    );
  });

  test('removing a score field is denied', async () => {
    await seed(path, { ...scored, status: 'in-progress', statusUpdatedAt: new Date() });
    await assertFails(updateDoc(doc(alice(), path), { latestTestId: deleteField() }));
  });

  test('changing status to not-started on update is denied', async () => {
    await seed(path, { status: 'reviewed', statusUpdatedAt: new Date() });
    await assertFails(
      updateDoc(doc(alice(), path), { status: 'not-started', statusUpdatedAt: serverTimestamp() })
    );
  });

  test('deleting is denied', async () => {
    await seed(path, { status: 'reviewed', statusUpdatedAt: new Date() });
    await assertFails(deleteDoc(doc(alice(), path)));
  });

  test("writing another user's doc is denied", async () => {
    await assertFails(
      setDoc(doc(alice(), 'users/bob-uid/conceptProgress/row'), {
        status: 'reviewed',
        statusUpdatedAt: serverTimestamp(),
      })
    );
  });

  test('an unauthenticated device can neither read nor write', async () => {
    await seed(path, { status: 'reviewed' });
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, path)));
    await assertFails(setDoc(doc(anon, path), { status: 'reviewed', statusUpdatedAt: serverTimestamp() }));
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test:rules`
Expected: the new "succeeds" cases FAIL (no rule matches, so everything under
`conceptProgress` is denied); the deny cases already pass.

- [ ] **Step 3: Add the rule** — in `firestore.rules`, after the `baseline/{docId}` block:

```
    // ph-2-us-11: Concept Progress, one doc per handbook topic — the first client-writable
    // collection under users/{uid}. The client sets only `status` (the user's own choice,
    // ph-2-us-10) and `statusUpdatedAt`, which must be the server's time. The score fields
    // (latestMiniQuizScore, latestMiniQuizAt, latestTestId) are written only by scoreTest via
    // the Admin SDK, so a client can't forge a quiz score. `not-started` is never stored: it's
    // the absence of a doc. Delete is denied; account deletion goes through ph-9-us-9.
    match /users/{uid}/conceptProgress/{chunkId} {
      function isOwner() {
        return request.auth != null && request.auth.uid == uid;
      }
      function validStatus() {
        return request.resource.data.status in ['in-progress', 'reviewed', 'needs-revisit']
          && request.resource.data.statusUpdatedAt == request.time;
      }

      allow read: if isOwner();
      allow create: if isOwner()
        && request.resource.data.keys().hasOnly(['status', 'statusUpdatedAt'])
        && validStatus();
      allow update: if isOwner()
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'statusUpdatedAt'])
        && validStatus();
      allow delete: if false;
    }
```

Also update the closing comment at the bottom of the file: replace "Later phases that need a
client-writable sub-collection under users/{uid} (driving sessions, test outcomes, settings) add
an explicit `match` block here" with "Later phases that need a client-writable sub-collection
under users/{uid} (driving sessions, test outcomes, settings) add an explicit `match` block here,
as `conceptProgress` does above,".

- [ ] **Step 4: Run to verify they pass**

Run: `npm run test:rules`
Expected: all PASS, including the existing cases.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules firestore-tests/rules.test.ts
git commit -m "feat(ph-2-us-11): conceptProgress rules: client sets status only"
```

---

### Task 2: `scoreTest` merges the mini-quiz score into Concept Progress (ph-2-us-11)

**Files:**
- Modify: `functions/src/scoreTest.ts` (`scoreAssignedTest`, around lines 233–289)
- Test: `functions/src/scoreTest.test.ts`
- Modify: `functions/README.md` (`scoreTest` → **Persistence**)

**Interfaces:**
- Produces: after a mini-quiz is graded, `users/{uid}/conceptProgress/{chunkId}` holds
  `latestMiniQuizScore` (0–1), `latestMiniQuizAt` (server timestamp), `latestTestId`; `status`
  untouched. Read by the client as `ConceptProgress` (Task 3).

Invoke the `cloud-function-documentation` skill before editing `scoreTest.ts`.

- [ ] **Step 1: Write the failing tests** — in `functions/src/scoreTest.test.ts`, add
  `'conceptProgress'` to the cleared subcollections in `beforeEach`:

```ts
    for (const sub of ['testAssignments', 'testAttempts', 'baseline', 'conceptProgress']) {
```

Then add after the "a low-scoring mini-quiz recommends review-again" test:

```ts
  describe('Concept Progress (ph-2-us-11)', () => {
    const progressRef = () => db.collection('users').doc(uid).collection('conceptProgress').doc('row');

    async function takeMiniQuiz(choices: string[]) {
      const assembled = await assembleMiniQuizForUser(db, { uid }, { chunkId: 'row', count: choices.length });
      await scoreTestForUser(db, { uid }, {
        testId: assembled.testId,
        answers: assembled.questions.map((q, i) => ({ questionId: q.id, choice: choices[i] })),
      });
      return assembled.testId;
    }

    test('a mini-quiz merges its score and leaves an existing status alone', async () => {
      await seedQuestion('q1', 'row', 'a');
      await seedQuestion('q2', 'row', 'a');
      await progressRef().set({ status: 'reviewed', statusUpdatedAt: new Date() });

      const testId = await takeMiniQuiz(['a', 'b']);

      const progress = (await progressRef().get()).data()!;
      expect(progress.status).toBe('reviewed');
      expect(progress.latestMiniQuizScore).toBe(0.5);
      expect(progress.latestTestId).toBe(testId);
      expect(progress.latestMiniQuizAt).toBeDefined();
    });

    test('with no doc yet, it creates one with score fields only (no status)', async () => {
      await seedQuestion('q1', 'row', 'a');

      await takeMiniQuiz(['a']);

      const progress = (await progressRef().get()).data()!;
      expect(Object.keys(progress).sort()).toEqual(['latestMiniQuizAt', 'latestMiniQuizScore', 'latestTestId']);
      expect(progress.latestMiniQuizScore).toBe(1);
    });

    test('retaking the quiz overwrites the latest score', async () => {
      await seedQuestion('q1', 'row', 'a');

      await takeMiniQuiz(['b']);
      const secondTestId = await takeMiniQuiz(['a']);

      const progress = (await progressRef().get()).data()!;
      expect(progress.latestMiniQuizScore).toBe(1);
      expect(progress.latestTestId).toBe(secondTestId);
    });

    test('a practice test does not touch Concept Progress', async () => {
      await seedQuestion('q1', 'row', 'a');
      const assembled = await assembleTestForUser(db, { uid }, { count: 1 });

      await scoreTestForUser(db, { uid }, {
        testId: assembled.testId,
        answers: [{ questionId: 'q1', choice: 'a' }],
      });

      const all = await db.collection('users').doc(uid).collection('conceptProgress').get();
      expect(all.empty).toBe(true);
    });

    test('a baseline section does not touch Concept Progress', async () => {
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

      await scoreTestForUser(db, { uid }, {
        testId: started.testId,
        answers: [{ questionId: 'q1', choice: 'a' }],
      });

      const all = await db.collection('users').doc(uid).collection('conceptProgress').get();
      expect(all.empty).toBe(true);
    });
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test:functions -- -t "Concept Progress"`
Expected: the first three FAIL (`progressRef().get()` has no data / no score fields); the
practice and baseline tests pass already.

- [ ] **Step 3: Implement** — in `functions/src/scoreTest.ts`, update the `scoreAssignedTest`
  doc comment's `Writes:` line:

```ts
 * Writes:   `users/{uid}/testAttempts/{testId}`; sets the assignment's `scored: true`; for a
 *           mini-quiz, merges the latest score into `users/{uid}/conceptProgress/{chunkId}`
 *           (ph-2-us-11) without touching the client-owned `status`
```

Then, inside the transaction, after `tx.update(assignmentRef, { scored: true });`:

```ts
    // ph-2-us-11: a mini-quiz's score goes on the topic's Concept Progress record, written here
    // (not by the client) so it can't be forged. `merge` keeps the client-owned `status`, and
    // creates the doc with score fields only if this topic was never opened. It's in the same
    // transaction as the attempt, so the two can't disagree. An assignment without a topic
    // can't happen for mini-quizzes (assembleMiniQuiz always records it); skip rather than
    // write to a bad path if one ever does.
    if (type === 'mini-quiz' && typeof assignment.chunkId === 'string' && assignment.chunkId) {
      const progressRef = db
        .collection('users')
        .doc(uid)
        .collection('conceptProgress')
        .doc(assignment.chunkId);
      tx.set(
        progressRef,
        {
          latestMiniQuizScore: score,
          latestMiniQuizAt: FieldValue.serverTimestamp(),
          latestTestId: testId,
        },
        { merge: true }
      );
    }
```

- [ ] **Step 4: Run to verify they pass**

Run: `npm run test:functions`
Expected: all PASS (previous 66 plus 5 new).

- [ ] **Step 5: Document** — in `functions/README.md`, in the `scoreTest` **Persistence**
  paragraph, after "Clients can read attempts but never write them." add:

```markdown
For a **mini-quiz**, the same transaction also merges `{ latestMiniQuizScore (0–1),
latestMiniQuizAt (server timestamp), latestTestId }` into `users/{uid}/conceptProgress/{chunkId}`
(ph-2-us-11), creating the doc if needed. It never writes `status`: that field is the client's
(rules allow the owner to set only `status` and `statusUpdatedAt`). Practice tests and baseline
sections don't touch Concept Progress.
```

- [ ] **Step 6: Build check and commit**

Run: `npm --prefix functions run build`
Expected: no TypeScript errors.

```bash
git add functions/src/scoreTest.ts functions/src/scoreTest.test.ts functions/README.md
git commit -m "feat(ph-2-us-11): scoreTest merges mini-quiz score into conceptProgress"
```

---

### Task 3: Client Concept Progress module (ph-2-us-12)

**Files:**
- Create: `src/study/conceptProgressData.ts`, `src/study/conceptProgressData.test.ts`
- Create: `src/study/conceptProgress.ts`, `src/study/conceptProgress.test.ts`
- Create: `src/study/useConceptProgress.ts`

**Interfaces:**
- Consumes: the Task 1/2 record shape.
- Produces:
  - `type ConceptStatus = 'not-started' | 'in-progress' | 'reviewed' | 'needs-revisit'`
  - `type StoredStatus = Exclude<ConceptStatus, 'not-started'>`
  - `interface ConceptProgress { status: ConceptStatus; latestMiniQuizScore?: number; latestMiniQuizAt?: Date }`
  - `type ProgressMap = Record<string, ConceptProgress>`
  - `type NextStepChoice = 'review-again' | 'come-back-later' | 'mark-reviewed'`
  - `toProgress(data: Record<string, unknown> | undefined): ConceptProgress`
  - `progressFor(map: ProgressMap, chunkId: string): ConceptProgress`
  - `nextStatus(current: ConceptStatus, event: 'opened' | NextStepChoice): StoredStatus | null`
  - `statusForChoice(choice: NextStepChoice): StoredStatus`
  - `subscribeConceptProgress(uid, onChange: (map: ProgressMap) => void, onError: (e: unknown) => void): () => void`
  - `markOpened(uid: string, chunkId: string, current: ConceptStatus): void`
  - `setStatusFromChoice(uid: string, chunkId: string, choice: NextStepChoice): void`
  - `type ConceptProgressState = { status: 'loading' } | { status: 'ready'; byChunk: ProgressMap } | { status: 'error' }`
  - `useConceptProgress(): ConceptProgressState`

- [ ] **Step 1: Write the failing pure tests** — `src/study/conceptProgressData.test.ts`:

```ts
import { nextStatus, progressFor, statusForChoice, toProgress } from './conceptProgressData';

describe('toProgress', () => {
  test('no doc is not started', () => {
    expect(toProgress(undefined)).toEqual({ status: 'not-started' });
  });

  test('a stored status is kept, with the score and its date', () => {
    const at = new Date('2026-10-01T10:00:00Z');
    expect(
      toProgress({ status: 'reviewed', latestMiniQuizScore: 0.8, latestMiniQuizAt: { toDate: () => at } })
    ).toEqual({ status: 'reviewed', latestMiniQuizScore: 0.8, latestMiniQuizAt: at });
  });

  test('a score but no status is in progress', () => {
    expect(toProgress({ latestMiniQuizScore: 0.4 })).toEqual({
      status: 'in-progress',
      latestMiniQuizScore: 0.4,
    });
  });

  test('an unknown status is ignored (not started, or in progress with a score)', () => {
    expect(toProgress({ status: 'done' })).toEqual({ status: 'not-started' });
    expect(toProgress({ status: 'done', latestMiniQuizScore: 1 }).status).toBe('in-progress');
  });

  test('a pending server timestamp (null) leaves the date out', () => {
    expect(toProgress({ latestMiniQuizScore: 1, latestMiniQuizAt: null })).toEqual({
      status: 'in-progress',
      latestMiniQuizScore: 1,
    });
  });
});

test('progressFor: a topic missing from the map is not started', () => {
  expect(progressFor({ a: { status: 'reviewed' } }, 'b')).toEqual({ status: 'not-started' });
  expect(progressFor({ a: { status: 'reviewed' } }, 'a').status).toBe('reviewed');
});

describe('nextStatus (ph-2-us-10 transitions)', () => {
  test('opening a not-started topic makes it in progress', () => {
    expect(nextStatus('not-started', 'opened')).toBe('in-progress');
  });

  test.each(['in-progress', 'reviewed', 'needs-revisit'] as const)(
    'opening a %s topic writes nothing (opening never downgrades)',
    (current) => {
      expect(nextStatus(current, 'opened')).toBeNull();
    }
  );

  test.each([
    ['review-again', 'in-progress'],
    ['come-back-later', 'needs-revisit'],
    ['mark-reviewed', 'reviewed'],
  ] as const)('%s sets %s, whatever the current status', (choice, expected) => {
    expect(statusForChoice(choice)).toBe(expected);
    expect(nextStatus('reviewed', choice)).toBe(expected);
    expect(nextStatus('not-started', choice)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test:app -- conceptProgressData`
Expected: FAIL, "Cannot find module './conceptProgressData'".

- [ ] **Step 3: Implement** — `src/study/conceptProgressData.ts`:

```ts
// ph-2-us-10 / ph-2-us-12: Concept Progress as the app sees it, and the one place the status
// transitions table on ph-2-us-10 is applied. No Firebase imports, so it runs under plain-Node
// Jest.

export type ConceptStatus = 'not-started' | 'in-progress' | 'reviewed' | 'needs-revisit';
/** The statuses a client may store; `not-started` is the absence of a doc. */
export type StoredStatus = Exclude<ConceptStatus, 'not-started'>;

export interface ConceptProgress {
  status: ConceptStatus;
  /** 0–1, written only by scoreTest (ph-2-us-11). */
  latestMiniQuizScore?: number;
  latestMiniQuizAt?: Date;
}

export type ProgressMap = Record<string, ConceptProgress>;

/** The three choices on the post-quiz recommendation screen (ph-2-us-9). */
export type NextStepChoice = 'review-again' | 'come-back-later' | 'mark-reviewed';

const STORED: readonly string[] = ['in-progress', 'reviewed', 'needs-revisit'];

function toDate(value: unknown): Date | undefined {
  // Firestore Timestamps have toDate(). A server timestamp still pending reads as null.
  const maybe = value as { toDate?: () => Date } | null | undefined;
  return typeof maybe?.toDate === 'function' ? maybe.toDate() : undefined;
}

export function toProgress(data: Record<string, unknown> | undefined): ConceptProgress {
  if (!data) return { status: 'not-started' };
  const score = typeof data.latestMiniQuizScore === 'number' ? data.latestMiniQuizScore : undefined;
  const at = toDate(data.latestMiniQuizAt);
  // A doc scoreTest created before the topic was ever opened has a score but no status.
  const status: ConceptStatus =
    typeof data.status === 'string' && STORED.includes(data.status)
      ? (data.status as StoredStatus)
      : score !== undefined
        ? 'in-progress'
        : 'not-started';
  return {
    status,
    ...(score !== undefined ? { latestMiniQuizScore: score } : {}),
    ...(at ? { latestMiniQuizAt: at } : {}),
  };
}

export function progressFor(map: ProgressMap, chunkId: string): ConceptProgress {
  return map[chunkId] ?? { status: 'not-started' };
}

export function statusForChoice(choice: NextStepChoice): StoredStatus {
  switch (choice) {
    case 'review-again':
      return 'in-progress';
    case 'come-back-later':
      return 'needs-revisit';
    case 'mark-reviewed':
      return 'reviewed';
  }
}

/** The status to write for an event, or null to write nothing. */
export function nextStatus(
  current: ConceptStatus,
  event: 'opened' | NextStepChoice
): StoredStatus | null {
  if (event === 'opened') return current === 'not-started' ? 'in-progress' : null;
  return statusForChoice(event);
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npm run test:app -- conceptProgressData`
Expected: PASS.

- [ ] **Step 5: Write the failing write tests** — `src/study/conceptProgress.test.ts`:

```ts
import { markOpened, setStatusFromChoice } from './conceptProgress';

// The Firestore calls are mocked so the write rules run under plain-Node Jest.
const mockSetDoc = jest.fn((..._args: unknown[]) => Promise.resolve());
jest.mock('@react-native-firebase/app', () => ({ getApp: jest.fn() }));
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') })),
  doc: jest.fn((parent: { path: string }, id: string) => ({ path: `${parent.path}/${id}` })),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TS'),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
}));

beforeEach(() => jest.clearAllMocks());

test('opening a not-started topic writes in-progress with the server time, merged', () => {
  markOpened('u1', 'row', 'not-started');
  expect(mockSetDoc).toHaveBeenCalledWith(
    { path: 'users/u1/conceptProgress/row' },
    { status: 'in-progress', statusUpdatedAt: 'SERVER_TS' },
    { merge: true }
  );
});

test.each(['in-progress', 'reviewed', 'needs-revisit'] as const)(
  'opening a %s topic writes nothing',
  (current) => {
    markOpened('u1', 'row', current);
    expect(mockSetDoc).not.toHaveBeenCalled();
  }
);

test.each([
  ['review-again', 'in-progress'],
  ['come-back-later', 'needs-revisit'],
  ['mark-reviewed', 'reviewed'],
] as const)('choice %s writes %s', (choice, status) => {
  setStatusFromChoice('u1', 'row', choice);
  expect(mockSetDoc).toHaveBeenCalledWith(
    { path: 'users/u1/conceptProgress/row' },
    { status, statusUpdatedAt: 'SERVER_TS' },
    { merge: true }
  );
});

test('a rejected write is logged, not thrown', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockSetDoc.mockImplementationOnce(() => Promise.reject(new Error('permission-denied')));

  expect(() => markOpened('u1', 'row', 'not-started')).not.toThrow();
  await new Promise((resolve) => setImmediate(resolve));

  expect(warn).toHaveBeenCalledWith(
    '[conceptProgress] status write failed',
    'row',
    'in-progress',
    expect.any(Error)
  );
  warn.mockRestore();
});
```

- [ ] **Step 6: Run to verify they fail**

Run: `npm run test:app -- conceptProgress.test`
Expected: FAIL, "Cannot find module './conceptProgress'".

- [ ] **Step 7: Implement** — `src/study/conceptProgress.ts`:

```ts
import { getApp } from '@react-native-firebase/app';
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from '@react-native-firebase/firestore';
import {
  nextStatus,
  statusForChoice,
  toProgress,
  type ConceptStatus,
  type NextStepChoice,
  type ProgressMap,
  type StoredStatus,
} from './conceptProgressData';

// ph-2-us-12: reads and writes users/{uid}/conceptProgress. Screens never write `status`
// themselves; they call markOpened / setStatusFromChoice, which apply ph-2-us-10's table.
// Writes aren't awaited: Firestore's offline cache updates the live subscription at once and
// syncs later (offline, the promise only settles once it syncs). A write the rules reject is
// logged, never thrown to the screen.

function progressCollection(uid: string) {
  return collection(getFirestore(getApp()), 'users', uid, 'conceptProgress');
}

export function subscribeConceptProgress(
  uid: string,
  onChange: (map: ProgressMap) => void,
  onError: (error: unknown) => void
): () => void {
  return onSnapshot(
    progressCollection(uid),
    (snapshot) => {
      const map: ProgressMap = {};
      snapshot.docs.forEach((d) => {
        map[d.id] = toProgress(d.data() as Record<string, unknown>);
      });
      onChange(map);
    },
    onError
  );
}

function writeStatus(uid: string, chunkId: string, status: StoredStatus): void {
  setDoc(
    doc(progressCollection(uid), chunkId),
    { status, statusUpdatedAt: serverTimestamp() },
    { merge: true }
  ).catch((error) => console.warn('[conceptProgress] status write failed', chunkId, status, error));
}

/** A topic's flashcards or quiz opened: not started → in progress; anything else stays. */
export function markOpened(uid: string, chunkId: string, current: ConceptStatus): void {
  const status = nextStatus(current, 'opened');
  if (status) writeStatus(uid, chunkId, status);
}

/** A next-step choice on the recommendation screen (ph-2-us-9, Slice 4b). */
export function setStatusFromChoice(uid: string, chunkId: string, choice: NextStepChoice): void {
  writeStatus(uid, chunkId, statusForChoice(choice));
}
```

- [ ] **Step 8: Run to verify they pass**

Run: `npm run test:app -- conceptProgress`
Expected: PASS (both files).

- [ ] **Step 9: Add the hook** — `src/study/useConceptProgress.ts`:

```ts
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { subscribeConceptProgress } from './conceptProgress';
import type { ProgressMap } from './conceptProgressData';

// ph-2-us-12: the user's Concept Progress, live. It updates when a status is written (from the
// local cache at once, even offline) or when scoreTest saves a new score. 'error' is kept apart
// from an empty map: lists show everything as not started, but nothing writes a status from an
// unknown one, so a failed read can never downgrade a reviewed topic. Signed out: empty, and
// nothing can write without a uid.
export type ConceptProgressState =
  | { status: 'loading' }
  | { status: 'ready'; byChunk: ProgressMap }
  | { status: 'error' };

export function useConceptProgress(): ConceptProgressState {
  const { uid } = useAuth();
  const [state, setState] = useState<ConceptProgressState>({ status: 'loading' });

  useEffect(() => {
    if (!uid) {
      setState({ status: 'ready', byChunk: {} });
      return;
    }
    return subscribeConceptProgress(
      uid,
      (byChunk) => setState({ status: 'ready', byChunk }),
      (error) => {
        console.warn('[conceptProgress] subscription failed', error);
        // Keep the last good map if there was one.
        setState((prev) => (prev.status === 'ready' ? prev : { status: 'error' }));
      }
    );
  }, [uid]);

  return state;
}
```

- [ ] **Step 10: Type check and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/study/conceptProgressData.ts src/study/conceptProgressData.test.ts src/study/conceptProgress.ts src/study/conceptProgress.test.ts src/study/useConceptProgress.ts
git commit -m "feat(ph-2-us-12): client Concept Progress module and status rules"
```

---

### Task 4: Topics fields, flashcard loading, deck logic and last-opened

**Files:**
- Modify: `src/topics/topicsData.ts`, `src/topics/topicsData.test.ts`, `src/topics/useTopics.ts`
- Modify: `src/results/baselineResultsData.test.ts` (Topic fixtures only)
- Modify: `src/api/types.ts`, `src/api/callables.ts`
- Create: `src/study/deck.ts`, `src/study/deck.test.ts`
- Create: `src/study/flashcardCache.ts`, `src/study/flashcardCache.test.ts`
- Create: `src/study/useFlashcardDeck.ts`
- Modify: `src/profile/localFlags.ts`; create `src/profile/localFlags.test.ts`

**Interfaces:**
- Produces:
  - `Topic` gains `description: string` and `approvedQuestionCount: number`.
  - `useTopics(): TopicsState & { retry: () => void }`
  - `interface Flashcard extends QuizQuestion { correctAnswer: string }`,
    `interface FlashcardDeck { chunkId: string; cards: Flashcard[] }`,
    `getFlashcards(input: { chunkId: string }): Promise<FlashcardDeck>`
  - `interface DeckState<T> { cards: T[]; index: number }` (`index === cards.length` = end of deck)
  - `type DeckAction<T> = { type: 'next' } | { type: 'previous' } | { type: 'restart'; cards: T[] }`
  - `deckReducer<T>(state: DeckState<T>, action: DeckAction<T>): DeckState<T>`
  - `shuffled<T>(items: readonly T[], random?: () => number): T[]`
  - `isHorizontalDrag(dx: number, dy: number): boolean`, `swipeDirection(dx: number, dy: number): 'next' | 'previous' | null`
  - `type DeckError = 'empty' | 'rate-limited' | 'offline' | 'error'`, `toDeckError(kind: CallableErrorKind): DeckError`
  - `getCachedDeck(chunkId): Flashcard[] | undefined`, `cacheDeck(chunkId, cards): void`, `clearDeckCache(): void`
  - `type DeckLoadState = { status: 'loading' } | { status: 'ready'; cards: Flashcard[] } | { status: 'error'; error: DeckError }`
  - `useFlashcardDeck(chunkId: string): DeckLoadState & { retry: () => void }`
  - `getLastOpenedTopic(uid: string): Promise<string | null>`, `setLastOpenedTopic(uid: string, chunkId: string): Promise<void>`

- [ ] **Step 1: Write the failing topics test** — replace `src/topics/topicsData.test.ts`:

```ts
import { toTopics } from './topicsData';

test('sorts by handbook order and keeps title, description and approved count', () => {
  expect(
    toTopics([
      { id: 'signs', data: { title: 'Signs', description: 'Shapes and colors', order: 20, approvedQuestionCount: 4 } },
      { id: 'row', data: { title: 'Right of way', description: 'Who goes first', order: 5, approvedQuestionCount: 9 } },
    ])
  ).toEqual([
    { chunkId: 'row', title: 'Right of way', description: 'Who goes first', order: 5, approvedQuestionCount: 9 },
    { chunkId: 'signs', title: 'Signs', description: 'Shapes and colors', order: 20, approvedQuestionCount: 4 },
  ]);
});

test('missing fields fall back: id for title, empty description, order last, 0 approved', () => {
  expect(toTopics([{ id: 'x', data: {} }, { id: 'a', data: { title: 'A', order: 1, approvedQuestionCount: 2 } }])).toEqual([
    { chunkId: 'a', title: 'A', description: '', order: 1, approvedQuestionCount: 2 },
    { chunkId: 'x', title: 'x', description: '', order: Number.MAX_SAFE_INTEGER, approvedQuestionCount: 0 },
  ]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:app -- topicsData`
Expected: FAIL (objects lack `description` / `approvedQuestionCount`).

- [ ] **Step 3: Implement** — `src/topics/topicsData.ts`:

```ts
// ph-1-us-9 topics as the app sees them: title, summary, handbook order and how many approved
// questions each has, per chunkId. No Firebase imports, so it runs under plain-Node Jest.

export interface Topic {
  chunkId: string;
  title: string;
  /** One-line summary for the concept list (ph-2-us-7). Empty when missing. */
  description: string;
  /** Handbook page the topic starts on; sorts topics in handbook order. */
  order: number;
  /** Approved questions in the topic. 0 shows as "coming soon" (ph-2-us-7). */
  approvedQuestionCount: number;
}

export function toTopics(docs: { id: string; data: Record<string, unknown> }[]): Topic[] {
  return docs
    .map(({ id, data }) => ({
      chunkId: id,
      title: typeof data.title === 'string' && data.title.trim() !== '' ? data.title : id,
      description: typeof data.description === 'string' ? data.description : '',
      order: typeof data.order === 'number' ? data.order : Number.MAX_SAFE_INTEGER,
      // publish-topics always writes this; a doc without it is treated as having nothing yet.
      approvedQuestionCount:
        typeof data.approvedQuestionCount === 'number' ? data.approvedQuestionCount : 0,
    }))
    .sort((a, b) => a.order - b.order);
}
```

In `src/results/baselineResultsData.test.ts`, give each `Topic` literal the new fields (ts-jest
type-checks them). Replace each of these five literals:

```ts
{ chunkId: 'a', title: 'A', order: 1 }   →  { chunkId: 'a', title: 'A', description: '', order: 1, approvedQuestionCount: 1 }
{ chunkId: 'b', title: 'B', order: 2 }   →  { chunkId: 'b', title: 'B', description: '', order: 2, approvedQuestionCount: 1 }
{ chunkId: 'c', title: 'C', order: 3 }   →  { chunkId: 'c', title: 'C', description: '', order: 3, approvedQuestionCount: 1 }
{ chunkId: 'd', title: 'D', order: 4 }   →  { chunkId: 'd', title: 'D', description: '', order: 4, approvedQuestionCount: 1 }
```

(the `'a'` literal appears twice, at lines 52 and 71; change both).

Replace `src/topics/useTopics.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { getApp } from '@react-native-firebase/app';
import { collection, getDocs, getFirestore } from '@react-native-firebase/firestore';
import { toTopics, type Topic } from './topicsData';

// The topic catalog (titles, handbook order), read once per screen. Firestore's offline cache
// serves it when there's no connection and it was read before. Results and review treat
// 'error' as "no titles" and fall back to chunkIds; the concept list shows "No connection" and
// calls retry().
export type TopicsState =
  | { status: 'loading' }
  | { status: 'ready'; topics: Topic[] }
  | { status: 'error' };

export function useTopics(): TopicsState & { retry: () => void } {
  const [state, setState] = useState<TopicsState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    getDocs(collection(getFirestore(getApp()), 'topics'))
      .then((snapshot) => {
        if (cancelled) return;
        const docs = snapshot.docs.map((d) => ({
          id: d.id,
          data: d.data() as Record<string, unknown>,
        }));
        setState({ status: 'ready', topics: toTopics(docs) });
      })
      .catch((error) => {
        console.warn('[topics] read failed', error);
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { ...state, retry };
}
```

- [ ] **Step 4: Run to verify**

Run: `npm run test:app -- topicsData baselineResultsData`
Expected: PASS.

- [ ] **Step 5: Add the flashcard API** — in `src/api/types.ts`, after `AssembledTest`:

```ts
/** One `getFlashcards` card: a question with its answer, for flip-card study (ph-2-us-3). */
export interface Flashcard extends QuizQuestion {
  correctAnswer: string;
}

/** `getFlashcards` response: the whole topic, already shuffled. */
export interface FlashcardDeck {
  chunkId: string;
  cards: Flashcard[];
}
```

In `src/api/callables.ts`, add `FlashcardDeck` to the `import type { … } from './types'` line,
and append:

```ts
/**
 * A topic's flashcards (ph-2-us-3), with answers. Rate-limited to 30 calls / 10 min per user,
 * so screens load through useFlashcardDeck, which reuses this session's copy.
 */
export function getFlashcards(input: { chunkId: string }): Promise<FlashcardDeck> {
  return call('getFlashcards', input);
}
```

- [ ] **Step 6: Write the failing deck tests** — `src/study/deck.test.ts`:

```ts
import { deckReducer, isHorizontalDrag, shuffled, swipeDirection, toDeckError } from './deck';

const deck = (index: number) => ({ cards: ['a', 'b', 'c'], index });

describe('deckReducer', () => {
  test('next moves forward and stops at the end-of-deck position', () => {
    expect(deckReducer(deck(0), { type: 'next' }).index).toBe(1);
    expect(deckReducer(deck(2), { type: 'next' }).index).toBe(3);
    expect(deckReducer(deck(3), { type: 'next' }).index).toBe(3);
  });

  test('previous moves back and stops at the first card', () => {
    expect(deckReducer(deck(3), { type: 'previous' }).index).toBe(2);
    expect(deckReducer(deck(0), { type: 'previous' }).index).toBe(0);
  });

  test('restart takes the new order and goes to the first card', () => {
    expect(deckReducer(deck(3), { type: 'restart', cards: ['c', 'a', 'b'] })).toEqual({
      cards: ['c', 'a', 'b'],
      index: 0,
    });
  });
});

test('shuffled returns a new array with the same items, leaving the input alone', () => {
  const input = [1, 2, 3, 4];
  const out = shuffled(input, () => 0);
  expect(out).not.toBe(input);
  expect([...out].sort()).toEqual([1, 2, 3, 4]);
  expect(input).toEqual([1, 2, 3, 4]);
  // random() = 0 always swaps with index 0: a deterministic, non-identity order.
  expect(out).toEqual([2, 3, 4, 1]);
});

test('a drag is horizontal only when clearly sideways', () => {
  expect(isHorizontalDrag(30, 5)).toBe(true);
  expect(isHorizontalDrag(30, 20)).toBe(false);
  expect(isHorizontalDrag(5, 0)).toBe(false);
});

test('swipe: left is next, right is previous, short or diagonal is nothing', () => {
  expect(swipeDirection(-80, 10)).toBe('next');
  expect(swipeDirection(80, 10)).toBe('previous');
  expect(swipeDirection(-30, 0)).toBeNull();
  expect(swipeDirection(-80, 60)).toBeNull();
});

test.each([
  ['not-found', 'empty'],
  ['resource-exhausted', 'rate-limited'],
  ['offline', 'offline'],
  ['unauthenticated', 'error'],
  ['unknown', 'error'],
] as const)('callable error %s shows as %s', (kind, expected) => {
  expect(toDeckError(kind)).toBe(expected);
});
```

- [ ] **Step 7: Run to verify they fail**

Run: `npm run test:app -- deck`
Expected: FAIL, "Cannot find module './deck'".

- [ ] **Step 8: Implement** — `src/study/deck.ts`:

```ts
import type { CallableErrorKind } from '../api/callableErrors';

// ph-2-us-3: the flashcard viewer's logic, kept pure so it runs under plain-Node Jest.
// `index === cards.length` is the end-of-deck screen.

export interface DeckState<T> {
  cards: T[];
  index: number;
}

export type DeckAction<T> = { type: 'next' } | { type: 'previous' } | { type: 'restart'; cards: T[] };

export function deckReducer<T>(state: DeckState<T>, action: DeckAction<T>): DeckState<T> {
  switch (action.type) {
    case 'next':
      return { ...state, index: Math.min(state.index + 1, state.cards.length) };
    case 'previous':
      return { ...state, index: Math.max(state.index - 1, 0) };
    case 'restart':
      return { cards: action.cards, index: 0 };
  }
}

/** Fisher–Yates on a copy. "Start this concept over" uses it until ph-2-us-4 orders by misses. */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** How far a swipe must travel to change card. */
export const SWIPE_DISTANCE = 50;

/** Clearly sideways, so the swipe can take the gesture from a long card's vertical scroll. */
export function isHorizontalDrag(dx: number, dy: number): boolean {
  return Math.abs(dx) > 10 && Math.abs(dx) > 2 * Math.abs(dy);
}

export function swipeDirection(dx: number, dy: number): 'next' | 'previous' | null {
  if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < 2 * Math.abs(dy)) return null;
  return dx < 0 ? 'next' : 'previous';
}

export type DeckError = 'empty' | 'rate-limited' | 'offline' | 'error';

/** getFlashcards failures as the viewer shows them (ph-2-us-3 error states). */
export function toDeckError(kind: CallableErrorKind): DeckError {
  switch (kind) {
    case 'not-found':
      return 'empty';
    case 'resource-exhausted':
      return 'rate-limited';
    case 'offline':
      return 'offline';
    default:
      return 'error';
  }
}
```

Check the `shuffled(…, () => 0)` expectation by hand against this loop (i=3: swap 3↔0 →
[4,2,3,1]; i=2: swap 2↔0 → [3,2,4,1]; i=1: swap 1↔0 → [2,3,4,1]). It matches `[2, 3, 4, 1]`.

- [ ] **Step 9: Run to verify they pass**

Run: `npm run test:app -- deck`
Expected: PASS.

- [ ] **Step 10: Cache and last-opened, test first** — `src/study/flashcardCache.test.ts`:

```ts
import type { Flashcard } from '../api/types';
import { cacheDeck, clearDeckCache, getCachedDeck } from './flashcardCache';

const card = { id: 'q1', text: 'Q', choices: ['a', 'b'], correctAnswer: 'a', type: 'fact', chunkId: 'row', conceptId: 'k' } as Flashcard;

beforeEach(() => clearDeckCache());

test('a cached deck comes back by chunkId; other topics are not cached', () => {
  expect(getCachedDeck('row')).toBeUndefined();
  cacheDeck('row', [card]);
  expect(getCachedDeck('row')).toEqual([card]);
  expect(getCachedDeck('signs')).toBeUndefined();
});

test('clearDeckCache empties it', () => {
  cacheDeck('row', [card]);
  clearDeckCache();
  expect(getCachedDeck('row')).toBeUndefined();
});
```

`src/profile/localFlags.test.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLastOpenedTopic, setLastOpenedTopic } from './localFlags';

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('last-opened topic is stored per uid', async () => {
  expect(await getLastOpenedTopic('u1')).toBeNull();
  await setLastOpenedTopic('u1', 'row');
  expect(await getLastOpenedTopic('u1')).toBe('row');
  expect(await getLastOpenedTopic('u2')).toBeNull();
  expect(await AsyncStorage.getItem('dmv-app:study:last-opened:u1')).toBe('row');
});

test('a storage failure reads as none', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
  expect(await getLastOpenedTopic('u1')).toBeNull();
  warn.mockRestore();
});
```

Run: `npm run test:app -- flashcardCache localFlags`
Expected: FAIL (modules / exports missing).

- [ ] **Step 11: Implement** — `src/study/flashcardCache.ts`:

```ts
import type { Flashcard } from '../api/types';

// ph-2-us-3: decks loaded this app session, by chunkId. Reopening a topic (or Review Again,
// ph-2-us-9) reads from here instead of calling getFlashcards again, so it doesn't use up the
// rate limit, and a loaded topic keeps working offline. Memory only: the answer key is never
// stored on the device (ph-1-us-10).
const decks = new Map<string, Flashcard[]>();

export function getCachedDeck(chunkId: string): Flashcard[] | undefined {
  return decks.get(chunkId);
}

export function cacheDeck(chunkId: string, cards: Flashcard[]): void {
  decks.set(chunkId, cards);
}

/** For tests now, and for sign-out once Slice 6 adds it. */
export function clearDeckCache(): void {
  decks.clear();
}
```

Append to `src/profile/localFlags.ts`:

```ts
// Slice 4a (ph-9-us-7): the topic whose flashcards last loaded on this device, for Home's
// "Continue learning". A string rather than a flag, under the same per-uid key scheme. Lost on
// reinstall, which is fine for a shortcut.
const LAST_OPENED_TOPIC = 'study:last-opened';

function lastOpenedKey(uid: string): string {
  return `${PREFIX}${LAST_OPENED_TOPIC}:${uid}`;
}

/** A storage failure reads as "none", which only costs the Home shortcut. */
export async function getLastOpenedTopic(uid: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(lastOpenedKey(uid));
  } catch (error) {
    console.warn('[localFlags] last-opened read failed', error);
    return null;
  }
}

export async function setLastOpenedTopic(uid: string, chunkId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(lastOpenedKey(uid), chunkId);
  } catch (error) {
    console.warn('[localFlags] last-opened write failed', error);
  }
}
```

Run: `npm run test:app -- flashcardCache localFlags`
Expected: PASS.

- [ ] **Step 12: Add the loading hook** — `src/study/useFlashcardDeck.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { getFlashcards } from '../api/callables';
import { toCallableError } from '../api/callableErrors';
import type { Flashcard } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { toDeckError, type DeckError } from './deck';
import { cacheDeck, getCachedDeck } from './flashcardCache';

// ph-2-us-3: one topic's cards, from this session's cache when loaded before, otherwise from
// getFlashcards. An empty deck shows like `not-found` ("Nothing here yet"). Waits for a uid:
// getFlashcards rejects unauthenticated callers.
export type DeckLoadState =
  | { status: 'loading' }
  | { status: 'ready'; cards: Flashcard[] }
  | { status: 'error'; error: DeckError };

export function useFlashcardDeck(chunkId: string): DeckLoadState & { retry: () => void } {
  const { uid } = useAuth();
  const [state, setState] = useState<DeckLoadState>(() => {
    const cached = getCachedDeck(chunkId);
    return cached ? { status: 'ready', cards: cached } : { status: 'loading' };
  });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const cached = getCachedDeck(chunkId);
    if (cached) {
      setState({ status: 'ready', cards: cached });
      return;
    }
    if (!uid) return;
    let cancelled = false;
    setState({ status: 'loading' });
    getFlashcards({ chunkId })
      .then(({ cards }) => {
        if (cards.length > 0) cacheDeck(chunkId, cards);
        if (cancelled) return;
        setState(cards.length > 0 ? { status: 'ready', cards } : { status: 'error', error: 'empty' });
      })
      .catch((error) => {
        const callableError = toCallableError(error);
        console.warn('[flashcards] load failed', chunkId, callableError.code, callableError.message);
        if (!cancelled) setState({ status: 'error', error: toDeckError(callableError.kind) });
      });
    return () => {
      cancelled = true;
    };
  }, [uid, chunkId, attempt]);

  return { ...state, retry };
}
```

(Exercised through the screen in Task 6.)

- [ ] **Step 13: Full app suite, type check, commit**

Run: `npm run test:app && npx tsc --noEmit`
Expected: all PASS, no type errors.

```bash
git add src/topics src/results/baselineResultsData.test.ts src/api/types.ts src/api/callables.ts src/study/deck.ts src/study/deck.test.ts src/study/flashcardCache.ts src/study/flashcardCache.test.ts src/study/useFlashcardDeck.ts src/profile/localFlags.ts src/profile/localFlags.test.ts
git commit -m "feat(ph-2-us-3): flashcard loading, session cache, deck logic, last-opened topic"
```

---

### Task 5: Shared scenario badge and the flip card (ph-2-us-3, ph-2-us-5)

**Files:**
- Create: `src/components/ScenarioBadge.tsx`
- Modify: `src/quiz/QuizCard.tsx` (badge block and `badge`/`badgeText` styles)
- Create: `src/study/FlipCard.tsx`, `src/study/FlipCard.test.tsx`

**Interfaces:**
- Consumes: `Flashcard` (Task 4).
- Produces: `ScenarioBadge({ type }: { type: string | null | undefined })`;
  `FlipCard({ card }: { card: Pick<Flashcard, 'text' | 'correctAnswer' | 'type'> })` — the
  parent passes a `key` per card so a new card starts on its front. Accessible labels:
  `"Question: <text>"` / `"Scenario question: <text>"` on the front, `"Answer: <correctAnswer>"`
  on the back.

- [ ] **Step 1: Write the failing tests** — `src/study/FlipCard.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FlipCard } from './FlipCard';

const card = {
  text: 'Who goes first at a 4-way stop?',
  correctAnswer: 'The first car to stop',
  type: 'fact' as const,
};

test('starts on the front: the question, labelled as one, and a hint', async () => {
  await render(<FlipCard card={card} />);
  expect(screen.getByLabelText('Question: Who goes first at a 4-way stop?')).toBeTruthy();
  expect(screen.getByText('Tap to see the answer')).toBeTruthy();
  expect(screen.queryByText('SCENARIO')).toBeNull();
});

test('a tap turns it to the answer, and another tap turns it back', async () => {
  await render(<FlipCard card={card} />);
  await fireEvent.press(screen.getByLabelText('Question: Who goes first at a 4-way stop?'));
  expect(screen.getByLabelText('Answer: The first car to stop')).toBeTruthy();
  expect(screen.getByText('ANSWER')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Answer: The first car to stop'));
  expect(screen.getByLabelText('Question: Who goes first at a 4-way stop?')).toBeTruthy();
});

test('rapid taps never stick: an even number of taps ends on the front', async () => {
  await render(<FlipCard card={card} />);
  for (let i = 0; i < 4; i++) {
    await fireEvent.press(screen.getByRole('button'));
  }
  expect(screen.getByLabelText('Question: Who goes first at a 4-way stop?')).toBeTruthy();
});

test('a scenario card shows the badge and says so', async () => {
  await render(<FlipCard card={{ ...card, type: 'scenario' }} />);
  expect(screen.getByText('SCENARIO')).toBeTruthy();
  expect(screen.getByLabelText('Scenario question: Who goes first at a 4-way stop?')).toBeTruthy();
});

test('an unknown type gets the plain fact styling', async () => {
  await render(<FlipCard card={{ ...card, type: 'diagram' as never }} />);
  expect(screen.queryByText('SCENARIO')).toBeNull();
  expect(screen.getByLabelText('Question: Who goes first at a 4-way stop?')).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test:components -- FlipCard`
Expected: FAIL, "Cannot find module './FlipCard'".

- [ ] **Step 3: Extract the badge** — `src/components/ScenarioBadge.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

// ph-2-us-5: the SCENARIO badge from the "Scenario question card" mockup, shared by the quiz
// card and the flashcard. Nothing for fact cards, or for a missing or unknown type.
export function ScenarioBadge({ type }: { type: string | null | undefined }) {
  if (type !== 'scenario') return null;
  return (
    <View style={styles.badge}>
      <Text style={[typography.caption, styles.text]}>SCENARIO</Text>
    </View>
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
  text: { color: colors.secondary },
});
```

In `src/quiz/QuizCard.tsx`: import `ScenarioBadge` from `'../components/ScenarioBadge'`;
replace

```tsx
      {question.type === 'scenario' && (
        <View style={styles.badge}>
          <Text style={[typography.caption, styles.badgeText]}>SCENARIO</Text>
        </View>
      )}
```

with `<ScenarioBadge type={question.type} />`; delete the `badge` and `badgeText` entries from
its `StyleSheet`. Update the header comment's "Scenario questions get the badge from the
Scenario question card mockup (ph-2-us-5)" to "Scenario questions get the shared ScenarioBadge
(ph-2-us-5)".

- [ ] **Step 4: Implement the flip card** — `src/study/FlipCard.tsx`:

```tsx
import { useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { Flashcard } from '../api/types';
import { ScenarioBadge } from '../components/ScenarioBadge';
import { colors, radius, spacing, typography } from '../theme/tokens';

// ph-2-us-3 / ph-2-us-5: a classic flip card for memorizing. Front: the question only, never
// the choices. Back: only the correct answer, labelled "Answer", with no right/wrong marking.
// Tap anywhere to turn it. The turn is interruptible, so a tap mid-turn just turns it back from
// where it is. Both faces stay mounted so the turn shows real content on each side; the card is
// one accessible button whose label says which side is up. Long text scrolls inside the card.
// The parent gives each card a `key`, so moving to another card always starts on its front.
const FLIP_MS = 300;

export function FlipCard({ card }: { card: Pick<Flashcard, 'text' | 'correctAnswer' | 'type'> }) {
  const [flipped, setFlipped] = useState(false);
  const turn = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    const next = !flipped;
    setFlipped(next);
    Animated.timing(turn, {
      toValue: next ? 180 : 0,
      duration: FLIP_MS,
      useNativeDriver: true,
    }).start();
  };

  // Each face is visible only on its own half of the turn, as well as backface-hidden, so the
  // turn looks right on Android too.
  const frontStyle = {
    opacity: turn.interpolate({ inputRange: [0, 90, 90.01, 180], outputRange: [1, 1, 0, 0] }),
    transform: [
      { perspective: 1000 },
      { rotateY: turn.interpolate({ inputRange: [0, 180], outputRange: ['0deg', '180deg'] }) },
    ],
  };
  const backStyle = {
    opacity: turn.interpolate({ inputRange: [0, 90, 90.01, 180], outputRange: [0, 0, 1, 1] }),
    transform: [
      { perspective: 1000 },
      { rotateY: turn.interpolate({ inputRange: [0, 180], outputRange: ['180deg', '360deg'] }) },
    ],
  };
  const scenario = card.type === 'scenario';

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={
        flipped
          ? `Answer: ${card.correctAnswer}`
          : `${scenario ? 'Scenario question' : 'Question'}: ${card.text}`
      }
      accessibilityHint={flipped ? 'Shows the question again' : 'Shows the answer'}
      style={styles.container}
    >
      <Animated.View style={[styles.face, frontStyle]}>
        <ScrollView contentContainerStyle={styles.faceContent}>
          <ScenarioBadge type={card.type} />
          <Text style={[typography.h1, styles.text]}>{card.text}</Text>
          <Text style={typography.small}>Tap to see the answer</Text>
        </ScrollView>
      </Animated.View>
      <Animated.View style={[styles.face, styles.back, backStyle]}>
        <ScrollView contentContainerStyle={styles.faceContent}>
          <Text style={[typography.caption, styles.answerLabel]}>ANSWER</Text>
          <Text style={[typography.h1, styles.text]}>{card.correctAnswer}</Text>
        </ScrollView>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 280 },
  face: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
  },
  back: { borderColor: colors.primary, borderWidth: 2 },
  faceContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.space5,
    gap: spacing.space3,
  },
  // Line height only, as QuizCard's question does; the size stays the token's.
  text: { lineHeight: 28 },
  answerLabel: { color: colors.primary },
});
```

- [ ] **Step 5: Run to verify they pass**

Run: `npm run test:components -- FlipCard QuizCard`
Expected: PASS (QuizCard's existing "SCENARIO" assertion still holds).

- [ ] **Step 6: Commit**

```bash
git add src/components/ScenarioBadge.tsx src/quiz/QuizCard.tsx src/study/FlipCard.tsx src/study/FlipCard.test.tsx
git commit -m "feat(ph-2-us-3): flip flashcard with shared scenario badge (ph-2-us-5)"
```

---

### Task 6: Flashcard viewer screen and links into it (ph-2-us-3)

**Files:**
- Create: `src/study/FlashcardScreen.tsx`, `src/study/FlashcardScreen.test.tsx`
- Modify: `src/navigation/types.ts`, `src/navigation/RootNavigator.tsx`, `src/navigation/openConcept.ts`
- Modify: `src/baseline/baselineFlow.test.tsx`, `src/review/ReviewScreen.test.tsx`,
  `src/onboarding/onboardingFlow.test.tsx` (mocks only)

**Interfaces:**
- Consumes: `useFlashcardDeck`, `deckReducer`, `shuffled`, `isHorizontalDrag`,
  `swipeDirection`, `DeckError` (Task 4); `FlipCard` (Task 5); `useConceptProgress`,
  `markOpened`, `progressFor` (Task 3); `setLastOpenedTopic` (Task 4); `useTopics` (Task 4).
- Produces: root routes `Flashcards: { chunkId: string }` and `MiniQuiz: { chunkId: string }`;
  `openConcept(navigation, chunkId)` opens `Flashcards`.

- [ ] **Step 1: Write the failing tests** — `src/study/FlashcardScreen.test.tsx`:

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getFlashcards } from '../api/callables';
import { CallableError } from '../api/callableErrors';
import type { Flashcard } from '../api/types';
import { markOpened } from './conceptProgress';
import { clearDeckCache } from './flashcardCache';
import { FlashcardScreen } from './FlashcardScreen';
import type { ConceptProgressState } from './useConceptProgress';

// ph-2-us-3 through the real screen, deck logic, cache and flip card. Only the callable, the
// Concept Progress read/write and topics are mocked.
jest.mock('@react-native-firebase/app', () => ({ getApp: jest.fn() }));
jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ status: 'ready', uid: 'u1' }) }));
jest.mock('../api/callables', () => ({ getFlashcards: jest.fn() }));
jest.mock('./conceptProgress', () => ({ markOpened: jest.fn() }));
let mockProgress: ConceptProgressState = { status: 'ready', byChunk: {} };
jest.mock('./useConceptProgress', () => ({ useConceptProgress: () => mockProgress }));
jest.mock('../topics/useTopics', () => ({
  useTopics: () => ({
    status: 'ready',
    topics: [{ chunkId: 'row', title: 'Right of way', description: '', order: 1, approvedQuestionCount: 2 }],
    retry: jest.fn(),
  }),
}));

const mockGet = getFlashcards as jest.Mock;
const card = (n: number, over: Partial<Flashcard> = {}): Flashcard => ({
  id: `q${n}`,
  text: `Question ${n}`,
  choices: [`Right ${n}`, `Wrong ${n}`],
  correctAnswer: `Right ${n}`,
  type: 'fact',
  chunkId: 'row',
  conceptId: 'k',
  ...over,
});
const deckOf = (...cards: Flashcard[]) => ({ chunkId: 'row', cards });

const Stack = createNativeStackNavigator();
function tree() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Flashcards" component={FlashcardScreen as never} initialParams={{ chunkId: 'row' }} />
        <Stack.Screen name="MiniQuiz">{() => <Text>Mini-quiz screen</Text>}</Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  clearDeckCache();
  await AsyncStorage.clear();
  mockProgress = { status: 'ready', byChunk: {} };
});

test('shows the first front with progress and no choices; Next and Previous move', async () => {
  mockGet.mockResolvedValue(deckOf(card(1), card(2)));
  await render(tree());

  expect(await screen.findByLabelText('Question: Question 1')).toBeTruthy();
  expect(screen.getByText('1 of 2')).toBeTruthy();
  expect(screen.queryByText('Wrong 1')).toBeNull();
  expect(mockGet).toHaveBeenCalledWith({ chunkId: 'row' });

  await fireEvent.press(screen.getByText('Next'));
  expect(screen.getByLabelText('Question: Question 2')).toBeTruthy();
  expect(screen.getByText('2 of 2')).toBeTruthy();

  await fireEvent.press(screen.getByText('Previous'));
  expect(screen.getByLabelText('Question: Question 1')).toBeTruthy();
});

test('a card turned to its answer shows its front again after moving away and back', async () => {
  mockGet.mockResolvedValue(deckOf(card(1), card(2)));
  await render(tree());

  await fireEvent.press(await screen.findByLabelText('Question: Question 1'));
  expect(screen.getByLabelText('Answer: Right 1')).toBeTruthy();
  await fireEvent.press(screen.getByText('Next'));
  await fireEvent.press(screen.getByText('Previous'));
  expect(screen.getByLabelText('Question: Question 1')).toBeTruthy();
});

test('end of deck: start over reuses the session copy; the mini-quiz opens its screen', async () => {
  mockGet.mockResolvedValue(deckOf(card(1), card(2)));
  await render(tree());
  await screen.findByLabelText('Question: Question 1');

  await fireEvent.press(screen.getByText('Next'));
  await fireEvent.press(screen.getByText('Next'));
  expect(screen.getByText('End of this concept')).toBeTruthy();

  await fireEvent.press(screen.getByText('Back to the last card'));
  expect(screen.getByText('2 of 2')).toBeTruthy();
  await fireEvent.press(screen.getByText('Next'));

  await fireEvent.press(screen.getByText('Start this concept over'));
  expect(screen.getByText('1 of 2')).toBeTruthy();
  expect(mockGet).toHaveBeenCalledTimes(1);

  await fireEvent.press(screen.getByText('Next'));
  await fireEvent.press(screen.getByText('Next'));
  await fireEvent.press(screen.getByText('Take the mini-quiz'));
  expect(await screen.findByText('Mini-quiz screen')).toBeTruthy();
});

test('one-card topic: Previous is disabled and Next goes straight to the end', async () => {
  mockGet.mockResolvedValue(deckOf(card(1)));
  await render(tree());
  await screen.findByLabelText('Question: Question 1');

  expect(screen.getByRole('button', { name: 'Previous' }).props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(screen.getByText('Next'));
  expect(screen.getByText('End of this concept')).toBeTruthy();
  expect(screen.getByText(/You've been through the only card in this concept\./)).toBeTruthy();

  await fireEvent.press(screen.getByText('Start this concept over'));
  expect(screen.getByText('1 of 1')).toBeTruthy();
});

test('a scenario card is badged inside the same flow', async () => {
  mockGet.mockResolvedValue(deckOf(card(1, { type: 'scenario' }), card(2)));
  await render(tree());
  expect(await screen.findByLabelText('Scenario question: Question 1')).toBeTruthy();
  expect(screen.getByText('SCENARIO')).toBeTruthy();
});

test('opening marks a not-started topic and remembers it for Home', async () => {
  mockGet.mockResolvedValue(deckOf(card(1)));
  await render(tree());
  await screen.findByLabelText('Question: Question 1');

  await waitFor(() => expect(markOpened).toHaveBeenCalledWith('u1', 'row', 'not-started'));
  expect(markOpened).toHaveBeenCalledTimes(1);
  await waitFor(async () =>
    expect(await AsyncStorage.getItem('dmv-app:study:last-opened:u1')).toBe('row')
  );
});

test('a reviewed topic is passed as reviewed, so markOpened leaves it alone', async () => {
  mockProgress = { status: 'ready', byChunk: { row: { status: 'reviewed' } } };
  mockGet.mockResolvedValue(deckOf(card(1)));
  await render(tree());
  await screen.findByLabelText('Question: Question 1');
  await waitFor(() => expect(markOpened).toHaveBeenCalledWith('u1', 'row', 'reviewed'));
});

test.each([{ status: 'loading' }, { status: 'error' }] as ConceptProgressState[])(
  'never writes status while progress is %o, but still remembers the topic',
  async (progress) => {
    mockProgress = progress;
    mockGet.mockResolvedValue(deckOf(card(1)));
    await render(tree());
    await screen.findByLabelText('Question: Question 1');
    await waitFor(async () =>
      expect(await AsyncStorage.getItem('dmv-app:study:last-opened:u1')).toBe('row')
    );
    expect(markOpened).not.toHaveBeenCalled();
  }
);

test('reopening a topic this session makes no new call', async () => {
  mockGet.mockResolvedValue(deckOf(card(1)));
  const first = await render(tree());
  await screen.findByLabelText('Question: Question 1');
  await first.unmount();

  await render(tree());
  expect(await screen.findByLabelText('Question: Question 1')).toBeTruthy();
  expect(mockGet).toHaveBeenCalledTimes(1);
});

test.each([
  [new CallableError('not-found', 'not-found', 'none'), 'Nothing here yet'],
  [new CallableError('resource-exhausted', 'resource-exhausted', 'slow'), 'Take a short break'],
  [new CallableError('offline', 'unavailable', 'net'), 'No connection'],
  [new CallableError('unknown', 'internal', 'boom'), 'Something went wrong'],
])('a %s failure shows "%s" and writes nothing', async (error, title) => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockGet.mockRejectedValue(error);
  await render(tree());

  expect(await screen.findByText(title)).toBeTruthy();
  expect(markOpened).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('dmv-app:study:last-opened:u1')).toBeNull();
});

test('an empty deck shows "Nothing here yet" with a Back button', async () => {
  mockGet.mockResolvedValue(deckOf());
  await render(tree());
  expect(await screen.findByText('Nothing here yet')).toBeTruthy();
  expect(screen.getByText('Back')).toBeTruthy();
  expect(markOpened).not.toHaveBeenCalled();
});

test('retry after a connection failure loads the deck', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockGet
    .mockRejectedValueOnce(new CallableError('offline', 'unavailable', 'net'))
    .mockResolvedValueOnce(deckOf(card(1)));
  await render(tree());

  await fireEvent.press(await screen.findByText('Try again'));
  expect(await screen.findByLabelText('Question: Question 1')).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test:components -- FlashcardScreen`
Expected: FAIL, "Cannot find module './FlashcardScreen'".

- [ ] **Step 3: Add routes** — in `src/navigation/types.ts`, inside `RootStackParamList` after
  `Review`:

```ts
  /** One topic's flip-card flashcards (ph-2-us-3). Above the tabs so Back returns to the list,
   * results or review, wherever it was opened from. */
  Flashcards: { chunkId: string };
  /** The topic's mini-quiz. A placeholder until Slice 4b (ph-2-us-8). */
  MiniQuiz: { chunkId: string };
```

`src/navigation/openConcept.ts`:

```ts
import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from './types';

// Every "go study this topic" link (baseline results, review) goes through here, so they all
// open that topic's flashcards (Slice 4a, ph-2-us-3). Back returns to where the link was.
export function openConcept(
  navigation: NavigationProp<RootStackParamList>,
  chunkId: string
): void {
  navigation.navigate('Flashcards', { chunkId });
}
```

- [ ] **Step 4: Implement the screen** — `src/study/FlashcardScreen.tsx`:

```tsx
import { useEffect, useMemo, useReducer, useRef } from 'react';
import { ActivityIndicator, PanResponder, StyleSheet, Text, View } from 'react-native';
import type { Flashcard } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { NoConnection } from '../components/NoConnection';
import type { RootStackScreenProps } from '../navigation/types';
import { setLastOpenedTopic } from '../profile/localFlags';
import { colors, spacing, typography } from '../theme/tokens';
import { useTopics } from '../topics/useTopics';
import { markOpened } from './conceptProgress';
import { progressFor } from './conceptProgressData';
import {
  deckReducer,
  isHorizontalDrag,
  shuffled,
  swipeDirection,
  type DeckAction,
  type DeckError,
  type DeckState,
} from './deck';
import { FlipCard } from './FlipCard';
import { useConceptProgress } from './useConceptProgress';
import { useFlashcardDeck } from './useFlashcardDeck';

// ph-2-us-3: one topic's flashcards, one at a time, then an end-of-deck choice: the mini-quiz
// (a placeholder until Slice 4b) or start over in a fresh order from this session's copy.
// Nothing is recorded per card. Opening counts only once the deck has cards, so an empty or
// failed topic never turns "in progress" or becomes Home's "Continue learning".
export function FlashcardScreen({ navigation, route }: RootStackScreenProps<'Flashcards'>) {
  const { chunkId } = route.params;
  const { uid } = useAuth();
  const deck = useFlashcardDeck(chunkId);
  const progress = useConceptProgress();
  const topics = useTopics();

  const title =
    topics.status === 'ready' ? topics.topics.find((t) => t.chunkId === chunkId)?.title : undefined;
  useEffect(() => {
    if (title) navigation.setOptions({ title });
  }, [navigation, title]);

  const remembered = useRef(false);
  useEffect(() => {
    if (remembered.current || !uid || deck.status !== 'ready') return;
    remembered.current = true;
    void setLastOpenedTopic(uid, chunkId);
  }, [uid, chunkId, deck.status]);

  // Status is written only from a known current status, so a reviewed topic is never
  // downgraded by a read that's still loading or failed (ph-2-us-10: opening never downgrades).
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current || !uid || deck.status !== 'ready' || progress.status !== 'ready') return;
    marked.current = true;
    markOpened(uid, chunkId, progressFor(progress.byChunk, chunkId).status);
  }, [uid, chunkId, deck.status, progress]);

  if (deck.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Loading cards" />
      </View>
    );
  }
  if (deck.status === 'error') {
    return <DeckErrorView error={deck.error} onRetry={deck.retry} onBack={() => navigation.goBack()} />;
  }
  return <Deck cards={deck.cards} onQuiz={() => navigation.navigate('MiniQuiz', { chunkId })} />;
}

function Deck({ cards, onQuiz }: { cards: Flashcard[]; onQuiz: () => void }) {
  const [state, dispatch] = useReducer(
    (s: DeckState<Flashcard>, a: DeckAction<Flashcard>) => deckReducer(s, a),
    { cards, index: 0 }
  );

  // Swipe left for next, right for previous. It only claims clearly sideways drags, so a long
  // card can still scroll vertically. Buttons do the same for anyone who doesn't swipe.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, g) => isHorizontalDrag(g.dx, g.dy),
        onPanResponderRelease: (_event, g) => {
          const direction = swipeDirection(g.dx, g.dy);
          if (direction) dispatch({ type: direction });
        },
      }),
    []
  );

  const total = state.cards.length;
  if (state.index >= total) {
    return (
      <View style={[styles.screen, styles.end]} {...pan.panHandlers}>
        <Text style={typography.h1} accessibilityRole="header">
          End of this concept
        </Text>
        <Text style={[typography.body, styles.muted]}>
          {total === 1
            ? "You've been through the only card in this concept."
            : `You've been through all ${total} cards.`}{' '}
          Check what stuck with a quick quiz, or go through them again.
        </Text>
        <Button label="Take the mini-quiz" onPress={onQuiz} />
        <Button
          label="Start this concept over"
          variant="secondary"
          onPress={() => dispatch({ type: 'restart', cards: shuffled(state.cards) })}
        />
        <Button label="Back to the last card" variant="text" onPress={() => dispatch({ type: 'previous' })} />
      </View>
    );
  }

  const card = state.cards[state.index];
  return (
    <View style={styles.screen} {...pan.panHandlers}>
      <Text style={[typography.small, styles.progress]}>
        {state.index + 1} of {total}
      </Text>
      <FlipCard key={`${state.index}-${card.id}`} card={card} />
      <View style={styles.nav}>
        <Button
          label="Previous"
          variant="secondary"
          disabled={state.index === 0}
          onPress={() => dispatch({ type: 'previous' })}
          style={styles.navButton}
        />
        <Button label="Next" onPress={() => dispatch({ type: 'next' })} style={styles.navButton} />
      </View>
    </View>
  );
}

function DeckErrorView({
  error,
  onRetry,
  onBack,
}: {
  error: DeckError;
  onRetry: () => void;
  onBack: () => void;
}) {
  if (error === 'empty') {
    return (
      <View style={styles.center}>
        <Text style={typography.h1}>Nothing here yet</Text>
        <Text style={[typography.body, styles.muted, styles.centerText]}>
          Cards for this concept are still being written. Try another concept for now.
        </Text>
        <Button label="Back" onPress={onBack} style={styles.wideButton} />
      </View>
    );
  }
  if (error === 'rate-limited') {
    return (
      <NoConnection
        title="Take a short break"
        message="You've opened a lot of cards in a short time. Try again in a few minutes."
        onRetry={onRetry}
      />
    );
  }
  if (error === 'offline') {
    return (
      <NoConnection
        message="Couldn't load these cards. Check your connection and try again."
        onRetry={onRetry}
      />
    );
  }
  return (
    <NoConnection
      title="Something went wrong"
      message="Couldn't load these cards. Please try again."
      onRetry={onRetry}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.space5,
    gap: spacing.space3,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.space5,
    gap: spacing.space2,
  },
  centerText: { textAlign: 'center' },
  progress: { textAlign: 'center' },
  nav: { flexDirection: 'row', gap: spacing.space3 },
  navButton: { flex: 1 },
  end: { justifyContent: 'center' },
  muted: { color: colors.inkSoft },
  wideButton: { marginTop: spacing.space5, paddingHorizontal: spacing.space6 },
});
```

- [ ] **Step 5: Register the routes** — in `src/navigation/RootNavigator.tsx`, import
  `FlashcardScreen` from `'../study/FlashcardScreen'`, and after the `Review` screen add:

```tsx
        <RootStack.Screen
          name="Flashcards"
          component={FlashcardScreen}
          options={{ title: 'Flashcards' }}
        />
        <RootStack.Screen name="MiniQuiz" options={{ title: 'Mini-quiz' }}>
          {() => (
            <PlaceholderScreen
              label="Mini-quiz"
              note="A quick quiz on this concept is coming in the next update."
            />
          )}
        </RootStack.Screen>
```

Update the file's header comment: "full-screen flows above the tabs (Baseline, Review,
Flashcards, the mini-quiz placeholder, the test date editor)".

- [ ] **Step 6: Run to verify they pass**

Run: `npm run test:components -- FlashcardScreen`
Expected: PASS.

- [ ] **Step 7: Point the existing link tests at flashcards**

`src/baseline/baselineFlow.test.tsx` — in `flowTree()`, after the `Review` stub add:

```tsx
        <Stack.Screen name="Flashcards">{() => <Text>Flashcards screen</Text>}</Stack.Screen>
```

and replace the two Study-tab tests:

```tsx
test('below the mark says where to focus; Start with what you missed opens flashcards', async () => {
  await finishWith(reviewOf(30));
  expect(await screen.findByText("The real test needs 80%. Here's where to focus first.")).toBeTruthy();
  await fireEvent.press(screen.getByText('Start with what you missed'));
  expect(navRef.getCurrentRoute()?.name).toBe('Flashcards');
});

test("tapping a topic opens that topic's flashcards", async () => {
  await finishWith(reviewOf(30));
  await fireEvent.press(await screen.findByLabelText('c2, Got it'));
  expect(navRef.getCurrentRoute()).toMatchObject({ name: 'Flashcards', params: { chunkId: 'c2' } });
});
```

`src/review/ReviewScreen.test.tsx` — in `renderReview()` replace
`<Stack.Screen name="Main">{() => <Text>Study tab</Text>}</Stack.Screen>` with
`<Stack.Screen name="Flashcards">{() => <Text>Flashcards screen</Text>}</Stack.Screen>`, and in
the "explanation panel…" test replace `expect(await screen.findByText('Study tab')).toBeTruthy();`
with `expect(await screen.findByText('Flashcards screen')).toBeTruthy();`.

`src/onboarding/onboardingFlow.test.tsx` — the real `RootNavigator` now imports the flashcard
screen, whose Concept Progress modules load native Firestore. Add next to the other mocks:

```tsx
jest.mock('../study/conceptProgress', () => ({ markOpened: jest.fn() }));
jest.mock('../study/useConceptProgress', () => ({
  useConceptProgress: () => ({ status: 'ready', byChunk: {} }),
}));
```

and add `getFlashcards: jest.fn(() => new Promise(() => {})),` to its `'../api/callables'` mock.

- [ ] **Step 8: Full component suite, type check, commit**

Run: `npm run test:components && npx tsc --noEmit`
Expected: all PASS, no type errors.

```bash
git add src/study/FlashcardScreen.tsx src/study/FlashcardScreen.test.tsx src/navigation src/baseline/baselineFlow.test.tsx src/review/ReviewScreen.test.tsx src/onboarding/onboardingFlow.test.tsx
git commit -m "feat(ph-2-us-3): flashcard viewer; topic links open flashcards"
```

---

### Task 7: Concept list as the Study tab (ph-2-us-7)

**Files:**
- Create: `src/study/conceptList.ts`, `src/study/conceptList.test.ts`
- Create: `src/study/ConceptListScreen.tsx`, `src/study/ConceptListScreen.test.tsx`
- Modify: `src/navigation/types.ts`, `src/navigation/RootNavigator.tsx` (Study stack)
- Modify: `src/onboarding/onboardingFlow.test.tsx` (the "Learn first" assertion)

**Interfaces:**
- Consumes: `Topic`, `useTopics` (Task 4); `ProgressMap`, `ConceptStatus`, `progressFor`,
  `useConceptProgress` (Task 3); `Flashcards` route (Task 6).
- Produces: `interface ConceptRow { chunkId; title; description; status: ConceptStatus; scorePercent: number | null; comingSoon: boolean }`,
  `STATUS_LABEL: Record<ConceptStatus, string>`,
  `toConceptRows(topics: Topic[], progress: ProgressMap): ConceptRow[]`, `ConceptListScreen`,
  `StudyStackParamList = { StudyHome: undefined }`.

- [ ] **Step 1: Write the failing row tests** — `src/study/conceptList.test.ts`:

```ts
import type { Topic } from '../topics/topicsData';
import { STATUS_LABEL, toConceptRows } from './conceptList';

const topic = (chunkId: string, order: number, approvedQuestionCount = 3): Topic => ({
  chunkId,
  title: chunkId.toUpperCase(),
  description: `About ${chunkId}`,
  order,
  approvedQuestionCount,
});

test('keeps the topics order and merges status and score; no record is not started', () => {
  const rows = toConceptRows([topic('a', 1), topic('b', 2), topic('c', 3)], {
    a: { status: 'reviewed', latestMiniQuizScore: 0.8 },
    c: { status: 'needs-revisit' },
  });
  expect(rows).toEqual([
    { chunkId: 'a', title: 'A', description: 'About a', status: 'reviewed', scorePercent: 80, comingSoon: false },
    { chunkId: 'b', title: 'B', description: 'About b', status: 'not-started', scorePercent: null, comingSoon: false },
    { chunkId: 'c', title: 'C', description: 'About c', status: 'needs-revisit', scorePercent: null, comingSoon: false },
  ]);
});

test('a topic with no approved questions is coming soon', () => {
  expect(toConceptRows([topic('a', 1, 0)], {})[0].comingSoon).toBe(true);
});

test('scores round to whole percents', () => {
  expect(toConceptRows([topic('a', 1)], { a: { status: 'in-progress', latestMiniQuizScore: 2 / 3 } })[0].scorePercent).toBe(67);
});

test('every status has a label', () => {
  expect(STATUS_LABEL).toEqual({
    'not-started': 'Not started',
    'in-progress': 'In progress',
    reviewed: 'Reviewed',
    'needs-revisit': 'Needs revisit',
  });
});
```

Run: `npm run test:app -- conceptList`
Expected: FAIL, "Cannot find module './conceptList'".

- [ ] **Step 2: Implement** — `src/study/conceptList.ts`:

```ts
import type { Topic } from '../topics/topicsData';
import { progressFor, type ConceptStatus, type ProgressMap } from './conceptProgressData';

// ph-2-us-7: the concept list's rows: every topic in handbook order (toTopics already sorts),
// with the user's status and latest quiz score. No Firebase imports.

export interface ConceptRow {
  chunkId: string;
  title: string;
  description: string;
  status: ConceptStatus;
  /** Latest mini-quiz score as a whole percent, or null if never taken. */
  scorePercent: number | null;
  /** No approved questions yet: shown, but not opened (ph-2-us-7). */
  comingSoon: boolean;
}

export const STATUS_LABEL: Record<ConceptStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  reviewed: 'Reviewed',
  'needs-revisit': 'Needs revisit',
};

export function toConceptRows(topics: Topic[], progress: ProgressMap): ConceptRow[] {
  return topics.map((topic) => {
    const { status, latestMiniQuizScore } = progressFor(progress, topic.chunkId);
    return {
      chunkId: topic.chunkId,
      title: topic.title,
      description: topic.description,
      status,
      scorePercent: latestMiniQuizScore === undefined ? null : Math.round(latestMiniQuizScore * 100),
      comingSoon: topic.approvedQuestionCount === 0,
    };
  });
}
```

Run: `npm run test:app -- conceptList`
Expected: PASS.

- [ ] **Step 3: Write the failing screen tests** — `src/study/ConceptListScreen.test.tsx`:

```tsx
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { Topic } from '../topics/topicsData';
import { ConceptListScreen } from './ConceptListScreen';
import type { ConceptProgressState } from './useConceptProgress';

// ph-2-us-7 through the real screen and row logic. Topics and Concept Progress are mocked.
jest.mock('@react-native-firebase/app', () => ({ getApp: jest.fn() }));
const mockRetry = jest.fn();
let mockTopics: { status: string; topics?: Topic[] } = { status: 'loading' };
jest.mock('../topics/useTopics', () => ({ useTopics: () => ({ ...mockTopics, retry: mockRetry }) }));
let mockProgress: ConceptProgressState = { status: 'ready', byChunk: {} };
jest.mock('./useConceptProgress', () => ({ useConceptProgress: () => mockProgress }));

const topic = (chunkId: string, title: string, order: number, approvedQuestionCount = 3): Topic => ({
  chunkId,
  title,
  description: `About ${title}`,
  order,
  approvedQuestionCount,
});
const TOPICS = [
  topic('a', 'Alpha', 1),
  topic('b', 'Bravo', 2, 0),
  topic('c', 'Charlie', 3),
  topic('d', 'Delta', 4),
];

const Stack = createNativeStackNavigator();
const navRef = createNavigationContainerRef();
async function renderList() {
  return render(
    <NavigationContainer ref={navRef}>
      <Stack.Navigator>
        <Stack.Screen name="StudyHome" component={ConceptListScreen} />
        <Stack.Screen name="Flashcards">{() => <Text>Flashcards screen</Text>}</Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTopics = { status: 'ready', topics: TOPICS };
  mockProgress = { status: 'ready', byChunk: {} };
});

test('every topic in order with its description, status and latest score', async () => {
  mockProgress = {
    status: 'ready',
    byChunk: { a: { status: 'reviewed', latestMiniQuizScore: 0.8 }, c: { status: 'in-progress' } },
  };
  await renderList();

  expect(screen.getByText('Start any concept, in any order, and start one over any time.')).toBeTruthy();
  expect(screen.getByLabelText('Alpha, Reviewed, latest quiz 80%')).toBeTruthy();
  expect(screen.getByLabelText('Bravo, Coming soon')).toBeTruthy();
  expect(screen.getByLabelText('Charlie, In progress')).toBeTruthy();
  expect(screen.getByLabelText('Delta, Not started')).toBeTruthy();
  expect(screen.getByText('About Alpha')).toBeTruthy();
  expect(screen.getByText('Latest quiz: 80%')).toBeTruthy();
  const titles = screen.getAllByText(/^(Alpha|Bravo|Charlie|Delta)$/).map((t) => t.props.children);
  expect(titles).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta']);
});

test("tapping any topic opens its flashcards, whatever its status", async () => {
  mockProgress = { status: 'ready', byChunk: { d: { status: 'reviewed' } } };
  await renderList();
  await fireEvent.press(screen.getByLabelText('Delta, Reviewed'));
  expect(navRef.getCurrentRoute()).toMatchObject({ name: 'Flashcards', params: { chunkId: 'd' } });
});

test('a coming-soon topic is shown but is not a button', async () => {
  await renderList();
  expect(screen.getByLabelText('Bravo, Coming soon')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Bravo/ })).toBeNull();
});

test('if progress cannot be read, every topic shows not started', async () => {
  mockProgress = { status: 'error' };
  await renderList();
  expect(screen.getByLabelText('Alpha, Not started')).toBeTruthy();
});

test('topics failing to load shows No connection, and Try again retries', async () => {
  mockTopics = { status: 'error' };
  await renderList();
  expect(screen.getByText('No connection')).toBeTruthy();
  await fireEvent.press(screen.getByText('Try again'));
  expect(mockRetry).toHaveBeenCalled();
});

test('while topics load, a labelled spinner shows', async () => {
  mockTopics = { status: 'loading' };
  await renderList();
  expect(screen.getByLabelText('Loading concepts')).toBeTruthy();
});
```

Run: `npm run test:components -- ConceptListScreen`
Expected: FAIL, "Cannot find module './ConceptListScreen'".

- [ ] **Step 4: Implement** — `src/study/ConceptListScreen.tsx`:

```tsx
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Card } from '../components/Card';
import { NoConnection } from '../components/NoConnection';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { useTopics } from '../topics/useTopics';
import { STATUS_LABEL, toConceptRows, type ConceptRow } from './conceptList';
import type { ConceptStatus } from './conceptProgressData';
import { useConceptProgress } from './useConceptProgress';

// ph-2-us-7: the Study tab. Every handbook topic in order, each with the user's status, and
// any of them can be opened: no locked topics. Topics with no approved questions yet show as
// "coming soon". Statuses update live (Concept Progress is a subscription). If they can't be
// read, everything shows as not started rather than blocking the list.
const CHIP: Record<ConceptStatus, { backgroundColor: string; color: string }> = {
  'not-started': { backgroundColor: colors.background, color: colors.inkSoft },
  'in-progress': { backgroundColor: colors.primarySoft, color: colors.primary },
  reviewed: { backgroundColor: colors.successSoft, color: colors.success },
  'needs-revisit': { backgroundColor: colors.secondarySoft, color: colors.secondary },
};

export function ConceptListScreen() {
  const navigation = useNavigation();
  const topics = useTopics();
  const progress = useConceptProgress();

  if (topics.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Loading concepts" />
      </View>
    );
  }
  if (topics.status === 'error') {
    return (
      <NoConnection
        message="Couldn't load the concepts. Check your connection and try again."
        onRetry={topics.retry}
      />
    );
  }

  const rows = toConceptRows(topics.topics, progress.status === 'ready' ? progress.byChunk : {});
  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={rows}
      keyExtractor={(row) => row.chunkId}
      ListHeaderComponent={
        <Text style={[typography.body, styles.muted]}>
          Start any concept, in any order, and start one over any time.
        </Text>
      }
      ListEmptyComponent={
        <Text style={[typography.body, styles.muted]}>No concepts yet. Check back soon.</Text>
      }
      renderItem={({ item }) => (
        <ConceptRowView
          row={item}
          onPress={() => navigation.navigate('Flashcards', { chunkId: item.chunkId })}
        />
      )}
    />
  );
}

function ConceptRowView({ row, onPress }: { row: ConceptRow; onPress: () => void }) {
  const statusText = row.comingSoon ? 'Coming soon' : STATUS_LABEL[row.status];
  const label = [row.title, statusText, row.scorePercent === null ? null : `latest quiz ${row.scorePercent}%`]
    .filter(Boolean)
    .join(', ');
  const chip = row.comingSoon
    ? { backgroundColor: colors.background, color: colors.inkFaint }
    : CHIP[row.status];

  const content = (
    <>
      <View style={styles.rowHeader}>
        <Text style={[typography.h2, styles.rowTitle]}>{row.title}</Text>
        <View style={[styles.chip, { backgroundColor: chip.backgroundColor }]}>
          <Text style={[typography.small, { color: chip.color }]}>{statusText}</Text>
        </View>
      </View>
      {row.description !== '' && <Text style={typography.small}>{row.description}</Text>}
      {row.scorePercent !== null && (
        <Text style={typography.small}>{`Latest quiz: ${row.scorePercent}%`}</Text>
      )}
    </>
  );

  if (row.comingSoon) {
    return (
      <Card style={styles.comingSoon}>
        <View accessible accessibilityLabel={label} style={styles.rowBody}>
          {content}
        </View>
      </Card>
    );
  }
  return (
    <Card onPress={onPress} accessibilityLabel={label}>
      {content}
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.space5, gap: spacing.space3 },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: { color: colors.inkSoft },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 },
  rowTitle: { flex: 1 },
  rowBody: { gap: spacing.space2 },
  chip: {
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.space2,
    paddingVertical: 2,
  },
  comingSoon: { backgroundColor: colors.background },
});
```

- [ ] **Step 5: Make it the Study tab** — in `src/navigation/types.ts` add:

```ts
export type StudyStackParamList = {
  /** The concept list (ph-2-us-7). Flashcards open above the tabs, on the root stack. */
  StudyHome: undefined;
};
```

In `src/navigation/RootNavigator.tsx`: import `ConceptListScreen` from
`'../study/ConceptListScreen'` and `StudyStackParamList` from `'./types'`; replace

```tsx
// The Study tab's first screen becomes the concept list (ph-2-us-7, Slice 4).
const StudyStack = makeStack('StudyHome', 'Study', 'Concepts');
```

with

```tsx
// ph-2-us-7: the Study tab is the concept list.
const StudyStackNav = createNativeStackNavigator<StudyStackParamList>();
function StudyStack() {
  return (
    <StudyStackNav.Navigator screenOptions={headerOptions}>
      <StudyStackNav.Screen name="StudyHome" component={ConceptListScreen} options={{ title: 'Study' }} />
    </StudyStackNav.Navigator>
  );
}
```

- [ ] **Step 6: Update the onboarding "Learn first" assertion** — in
  `src/onboarding/onboardingFlow.test.tsx`, its `useTopics` mock returns `loading`, so the list
  shows its spinner. Replace `expect(await screen.findByText('Concepts')).toBeTruthy();` with
  `expect(await screen.findByLabelText('Loading concepts')).toBeTruthy();`, and change that
  mock to `jest.mock('../topics/useTopics', () => ({ useTopics: () => ({ status: 'loading', retry: jest.fn() }) }));`.

- [ ] **Step 7: Run all, type check, commit**

Run: `npm run test:app && npm run test:components && npx tsc --noEmit`
Expected: all PASS, no type errors.

```bash
git add src/study/conceptList.ts src/study/conceptList.test.ts src/study/ConceptListScreen.tsx src/study/ConceptListScreen.test.tsx src/navigation src/onboarding/onboardingFlow.test.tsx
git commit -m "feat(ph-2-us-7): concept list with status replaces the Study placeholder"
```

---

### Task 8: Home "Continue learning" card (ph-9-us-7)

**Files:**
- Modify: `src/home/HomeScreen.tsx` (`StudyCard`)
- Modify: `src/onboarding/onboardingFlow.test.tsx` (Home tests)

**Interfaces:**
- Consumes: `getLastOpenedTopic` (Task 4), `useTopics` (Task 4), `Flashcards` route (Task 6),
  `useAuth`.

- [ ] **Step 1: Write the failing tests** — in `src/onboarding/onboardingFlow.test.tsx`, make the
  topics mock settable. Replace the `useTopics` mock with:

```tsx
let mockTopics: { status: string; topics?: unknown[] } = { status: 'loading' };
jest.mock('../topics/useTopics', () => ({ useTopics: () => ({ ...mockTopics, retry: jest.fn() }) }));
```

reset it in `beforeEach` with `mockTopics = { status: 'loading' };`, and add to the
`describe('Home (ph-9-us-7 / ph-9-us-5)'` block:

```tsx
  const ROW = { chunkId: 'row', title: 'Right of way', description: '', order: 1, approvedQuestionCount: 3 };

  test('the study card continues the last topic opened, and opens its flashcards', async () => {
    mockProfile = { onboarding: { choice: 'learn' }, testDate: null };
    mockTopics = { status: 'ready', topics: [ROW] };
    await AsyncStorage.setItem('dmv-app:study:last-opened:u1', 'row');
    await render(<RootNavigator initialRoute="Main" />);

    expect(await screen.findByText('Continue learning')).toBeTruthy();
    expect(screen.getByText('Right of way')).toBeTruthy();
    expect(screen.queryByText('Learn concept by concept')).toBeNull();
    await fireEvent.press(screen.getByText('Continue learning'));
    expect(await screen.findByLabelText('Loading cards')).toBeTruthy();
  });

  test('a remembered topic that is no longer in the catalog falls back to the list card', async () => {
    mockProfile = { onboarding: { choice: 'learn' }, testDate: null };
    mockTopics = { status: 'ready', topics: [ROW] };
    await AsyncStorage.setItem('dmv-app:study:last-opened:u1', 'gone');
    await render(<RootNavigator initialRoute="Main" />);

    expect(await screen.findByText('Learn concept by concept')).toBeTruthy();
    expect(screen.queryByText('Continue learning')).toBeNull();
  });

  test('before topics load, the study card is the list card', async () => {
    mockProfile = { onboarding: { choice: 'learn' }, testDate: null };
    await AsyncStorage.setItem('dmv-app:study:last-opened:u1', 'row');
    await render(<RootNavigator initialRoute="Main" />);

    expect(await screen.findByText('Learn concept by concept')).toBeTruthy();
  });
```

Run: `npm run test:components -- onboardingFlow`
Expected: the first new test FAILS (no "Continue learning"); the other two pass.

- [ ] **Step 2: Implement** — in `src/home/HomeScreen.tsx`, change the React import line to
  `import { useCallback, useState } from 'react';` (add it; the file has none), change the
  navigation import to `import { useFocusEffect, useNavigation } from '@react-navigation/native';`,
  add `import { useAuth } from '../auth/AuthProvider';`,
  `import { getLastOpenedTopic } from '../profile/localFlags';` and
  `import { useTopics } from '../topics/useTopics';`, then replace `StudyCard`:

```tsx
// ph-9-us-7 (Slice 4a): "Continue learning" opens the last topic whose flashcards loaded on this
// device, read again each time Home comes back into view. Before any topic has been opened, or
// if that topic is no longer in the catalog, it's "Learn concept by concept" and opens the list.
function StudyCard() {
  const navigation = useNavigation();
  const { uid } = useAuth();
  const topics = useTopics();
  const [lastOpened, setLastOpened] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      let cancelled = false;
      getLastOpenedTopic(uid).then((chunkId) => {
        if (!cancelled) setLastOpened(chunkId);
      });
      return () => {
        cancelled = true;
      };
    }, [uid])
  );

  const topic =
    lastOpened && topics.status === 'ready'
      ? topics.topics.find((t) => t.chunkId === lastOpened)
      : undefined;

  if (topic) {
    return (
      <RouteCard
        icon="book-outline"
        eyebrow="STUDY"
        title="Continue learning"
        body={topic.title}
        onPress={() => navigation.navigate('Flashcards', { chunkId: topic.chunkId })}
      />
    );
  }
  return (
    <RouteCard
      icon="book-outline"
      eyebrow="STUDY"
      title="Learn concept by concept"
      body="Flashcards and a quick quiz for each part of the handbook."
      onPress={() => navigation.navigate('Main', { screen: 'Study' })}
    />
  );
}
```

- [ ] **Step 3: Run to verify they pass**

Run: `npm run test:components && npx tsc --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/home/HomeScreen.tsx src/onboarding/onboardingFlow.test.tsx
git commit -m "feat(ph-9-us-7): Home study card continues the last topic opened"
```

---

### Task 9: Deploy, device test, docs and status

**Files:**
- Modify: `docs/phases/phase-2-flashcard-study-mode/ph-2-us-{3,5,7,10,11,12}-*.md`,
  `phase-2-summary.md`, `docs/phases/phase-9-first-run-onboarding-and-account-linking/ph-9-us-7-*.md`,
  `docs/build-order.md`, `docs/history/LOG.md`

- [ ] **Step 1: Full suites**

Run: `npm run test:rules && npm run test:functions && npm run test:question-bank && npm run test:app && npm run test:components && npx tsc --noEmit`
Expected: all PASS. Report counts (Slice 3 ended at functions 66, question bank 47, app 81,
components 79).

- [ ] **Step 2: Deploy to dev — confirm with the user first** (outward-facing). Then:

Run: `npx firebase deploy --only firestore:rules,functions --project dev`
Expected: rules released and `scoreTest` updated. Without the rules, every status write from
the app is denied (logged as `[conceptProgress] status write failed`).

- [ ] **Step 3: Device test on the Android emulator against dev.** No native deps were added,
  so no dev-client rebuild. `npx expo start --dev-client` (if the PC changed network, see
  `docs/android-emulator-setup.md` for the Metro IP and `-dns-server` fixes). Walk the Slice 4a
  test line in `docs/build-order.md`:
  - Fresh install (clear app data) → "Learn first" → the list shows every topic in handbook
    order, all "Not started", "coming soon" topics greyed and not tappable.
  - Open a topic → header shows its title → flip through every card (tap to flip, Next/Previous,
    swipe both ways, a long scenario card scrolls and is badged) → end of deck → "Back to the last
    card" → end again → "Start this concept over" (new order, starts at card 1) → end →
    "Take the mini-quiz" shows the placeholder → Back to the list: the topic shows "In progress".
  - Home shows "Continue learning · <topic>" and opens it.
  - Reopen the same topic: loads instantly (no spinner). Airplane mode → reopen it: still works;
    open a never-opened topic: "No connection" with Try again.
  - With a user who finished the baseline: results topic link and "Start with what you missed"
    open flashcards, and Back returns to the results; the review's "Study this concept" link too.
  - Note how many cards read badly without their choices ("Which of the following…"), with
    their topics, for the decision in the design doc.
  Fix anything that fails before continuing.

- [ ] **Step 4: Docs** — mark ph-2-us-11 and ph-2-us-12 Complete with criteria ticked
  (`setStatusFromChoice` built and tested; its screen arrives in 4b). ph-2-us-7 Complete (the
  latest-score display is unit-tested; it shows on device once 4b's quiz exists). ph-2-us-3
  "In Progress — viewer done (Slice 4a); 'Take the mini-quiz' opens a placeholder until
  ph-2-us-8". ph-2-us-5 Complete. ph-2-us-10 stays In Progress (its mini-quiz criterion is
  end-to-end in 4b). ph-9-us-7: note the "Continue learning" card. Record the design doc's five
  decisions and this plan's "Decisions made while planning" in the matching story Context
  sections (ph-2-us-7: viewer is on the root stack; ph-2-us-3: built-in Animated/PanResponder,
  interruptible flip, choice-worded questions shown as-is with the device-test count, "Back to
  the last card"). Update `phase-2-summary.md`, and set `docs/build-order.md` Slice 4a
  **Status: Complete (<date>)** with what the device test found and the plan path.

- [ ] **Step 5: Log** — append a one-line entry to `docs/history/LOG.md` (project-history skill).

- [ ] **Step 6: Commit**

```bash
git add docs
git commit -m "docs: Slice 4a (concept list and flashcards) complete"
```
