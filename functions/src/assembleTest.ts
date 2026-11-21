import { randomUUID } from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getDb } from './adminApp';
import { shuffle } from './shuffle';

// ph-1-us-4: exact per-test question count is undefined (prd.md Section 9) — kept as a single
// easy-to-change constant rather than hardcoded in multiple places.
const DEFAULT_QUESTION_COUNT = 25;

// ph-3-us-3: a practice test should resemble the real one, so we guarantee a minimum number of
// situational (scenario) questions and stop any single handbook topic from dominating.
export const MIN_SCENARIO_COUNT = 8; // at least this many scenario questions, if the bank has them
export const MAX_PER_TOPIC = 2; // at most this many questions from one chunkId (while avoidable)

/** The two fields of a question that `selectPracticeQuestions` needs to look at. */
export interface SelectableQuestion {
  type?: unknown; // 'scenario' marks a scenario question; anything else (or missing) is fact
  chunkId?: unknown; // handbook topic; used to cap how many questions share a topic
}

/**
 * Picks `count` questions from `pool` with a realistic mix: at least `minScenario` scenario
 * questions and at most `maxPerTopic` per topic, relaxing those rules only when the pool can't
 * satisfy them. Generic over the item type so it can be unit-tested with plain objects;
 * `describe` maps an item to its `type` and `chunkId` (for Firestore docs: `(d) => d.data()`).
 *
 * ph-3-us-6: when `opts.isSeen` is given, items it flags (questions from the user's recent tests)
 * are used only after unseen ones. Repeat-avoidance is a preference, not a guarantee. Priority
 * when rules clash: scenario minimum > repeat-avoidance > topic cap.
 *
 * Order of passes (each walks one shuffled copy of the pool, so results stay random). The scenario
 * tier runs first, until `minScenario`; the any-question tier then runs, until `count`. Each tier
 * does the same four passes:
 *   a. unseen, under the topic cap
 *   b. unseen, ignoring the cap (an unseen question over the cap beats a seen one under it)
 *   c. seen, under the topic cap
 *   d. seen, ignoring the cap (a small/lopsided pool still fills the test)
 * With no `isSeen` nothing is seen, so passes c and d take nothing new and the result is the same
 * as the original cap-only selection. Finally the picks are shuffled again so the scenario
 * questions are spread through the test rather than grouped at the start. Returns fewer than
 * `count` only if the pool is smaller.
 */
export function selectPracticeQuestions<T>(
  pool: T[],
  count: number,
  random: () => number,
  opts: { minScenario: number; maxPerTopic: number; isSeen?: (item: T) => boolean },
  describe: (item: T) => SelectableQuestion
): T[] {
  const shuffled = shuffle(pool, random);
  const isScenario = (item: T) => describe(item).type === 'scenario';
  const isSeen = opts.isSeen ?? (() => false); // no history: everything counts as unseen
  const isUnseen = (item: T) => !isSeen(item);

  // Picked items are tracked by position in `shuffled` (not by identity) so a pool containing
  // equal-looking items can never be confused, and so later passes skip what is already taken.
  const taken = new Set<number>();
  const perTopic = new Map<unknown, number>(); // how many picks each chunkId has so far
  const underCap = (item: T) => (perTopic.get(describe(item).chunkId) ?? 0) < opts.maxPerTopic;

  // Walks the shuffled pool and takes items that pass `accept`, until `target` picks exist.
  const pass = (target: number, accept: (item: T) => boolean, respectCap: boolean) => {
    for (let i = 0; i < shuffled.length && taken.size < target; i++) {
      const item = shuffled[i];
      if (taken.has(i) || !accept(item) || (respectCap && !underCap(item))) continue;
      taken.add(i);
      const chunk = describe(item).chunkId;
      perTopic.set(chunk, (perTopic.get(chunk) ?? 0) + 1);
    }
  };

  // The scenario target is bounded by `count` so a tiny test can't be forced over its size.
  const scenarioTarget = Math.min(opts.minScenario, count);
  // The scenario passes count only scenario picks toward the target, which is the same as the
  // total here because nothing else has been taken yet.
  const bothUnseen = (item: T) => isScenario(item) && isUnseen(item);
  pass(scenarioTarget, bothUnseen, true); // scenario: unseen, under cap
  pass(scenarioTarget, bothUnseen, false); // scenario: unseen, ignoring cap
  pass(scenarioTarget, isScenario, true); // scenario: seen allowed, under cap
  pass(scenarioTarget, isScenario, false); // scenario: seen allowed, ignoring cap (minimum wins)
  pass(count, isUnseen, true); // any: unseen, under cap
  pass(count, isUnseen, false); // any: unseen, ignoring cap
  pass(count, () => true, true); // any: seen allowed, under cap
  pass(count, () => true, false); // any: seen allowed, ignoring cap

  return shuffle([...taken].map((i) => shuffled[i]), random);
}

// ph-3-us-6: how many of the user's most recent graded practice tests to steer away from, so
// back-to-back tests feel fresh. Change here to widen or narrow the "recently seen" window.
export const RECENT_TESTS_TO_AVOID = 3;

/**
 * Returns the IDs of questions in the user's last `RECENT_TESTS_TO_AVOID` practice attempts.
 *
 * Used by `assembleTestForUser` so a new test prefers questions the user hasn't just seen.
 * Only graded attempts exist in `testAttempts`, and only `type == 'practice'` counts (mini-quizzes
 * and baselines don't). Malformed attempt data is skipped rather than failing test assembly.
 *
 * Trigger:  helper called by `assembleTestForUser`
 * Auth:     none of its own; the caller has already verified the user
 * Inputs:   db — Firestore instance; uid — the user whose history to read
 * Returns:  Set of question IDs (possibly empty)
 * Reads:    `users/{uid}/testAttempts`, type == 'practice', newest first, limit 3
 *           (served by the existing composite index on type asc, createdAt desc)
 * Writes:   none
 * Errors:   none thrown by this helper itself (Firestore errors propagate)
 */
export async function recentlySeenQuestionIds(db: Firestore, uid: string): Promise<Set<string>> {
  const snapshot = await db
    .collection('users')
    .doc(uid)
    .collection('testAttempts')
    .where('type', '==', 'practice')
    .orderBy('createdAt', 'desc')
    .limit(RECENT_TESTS_TO_AVOID)
    .get();

  const seen = new Set<string>();
  for (const doc of snapshot.docs) {
    const perQuestion = doc.data().perQuestion;
    // Defensive: the field is written by our own scorer, but never let odd data break a test.
    if (!Array.isArray(perQuestion)) continue;
    for (const entry of perQuestion) {
      const id = entry?.questionId;
      if (typeof id === 'string') seen.add(id);
    }
  }
  return seen;
}

/**
 * One question as it is sent to the client. This is a deliberate subset of the Firestore
 * `questions` document: only the fields listed here leave the server, so anything else stored
 * on the document (e.g. review status or answer data) is never exposed to the app.
 */
export interface AssembledQuestion {
  id: string; // Firestore document ID of the question
  text: string; // The question prompt shown to the student
  choices: string[]; // Answer options, shuffled so the correct one isn't always first
  type: string; // Question style (e.g. fact recall vs. situational scenario)
  chunkId: string; // Handbook topic/chunk this question was generated from
  conceptId: string; // Handbook concept this question tests; used to group/track weak areas
}

/** What the `assembleTest` function returns to the caller. */
export interface AssembleTestResult {
  testId: string; // Freshly generated unique ID identifying this assembled test
  questions: AssembledQuestion[]; // The randomly selected questions, in test order
}

/** Optional overrides for `assembleTestForUser`. Mainly exist so tests can control behavior. */
interface AssembleTestOptions {
  count?: number; // How many questions to include (defaults to DEFAULT_QUESTION_COUNT)
  random?: () => number; // Random source returning [0, 1); inject a fake for deterministic tests
}

/**
 * Builds a fresh practice test for the signed-in user from the approved question bank.
 *
 * Implements ph-1-us-4. The logic lives here, separate from the `assembleTest` export at the
 * bottom of the file, so it can be unit-tested without the Firebase runtime: the database, the
 * caller's auth, and the randomness are all passed in rather than read from globals.
 *
 * Trigger:  called by the `assembleTest` onCall wrapper below
 * Auth:     requires a signed-in caller (anonymous sign-in counts); otherwise throws
 * Inputs:   db — Firestore instance
 *           auth — the caller's `request.auth` (undefined if not signed in)
 *           options.count — number of questions (default 25)
 *           options.random — random source for question and choice order (default Math.random)
 * Returns:  { testId, questions[] } — questions contain id/text/choices/type/chunkId/conceptId
 *           only
 *           Selection: random, but at least MIN_SCENARIO_COUNT (8) scenario questions and at
 *           most MAX_PER_TOPIC (2) per chunkId; both relax if the bank can't satisfy them
 *           (the scenario minimum takes priority over the topic cap). Questions from the user's
 *           last 3 practice attempts are avoided when enough others exist (a preference, not a
 *           guarantee; priority: scenario minimum > repeat-avoidance > topic cap).
 * Reads:    `questions` collection, filtered to status == 'approved'; and the user's most
 *           recent practice attempts in `users/{uid}/testAttempts` (see recentlySeenQuestionIds)
 * Writes:   `users/{uid}/testAssignments/{testId}` — records exactly which question IDs were
 *           assigned, so `scoreTest` (ph-1-us-11) can grade only what this call actually handed
 *           out rather than trusting arbitrary question IDs submitted by the client (which would
 *           let a caller submit IDs for questions they were never shown, revealing answers).
 * Errors:   HttpsError('unauthenticated') when `auth` is missing
 */
export async function assembleTestForUser(
  db: Firestore,
  auth: { uid: string } | undefined,
  options: AssembleTestOptions = {}
): Promise<AssembleTestResult> {
  // Callable functions verify the caller's ID token before we run and expose the result as
  // `auth`. It is undefined when no valid token was sent, so reject those callers up front.
  if (!auth) {
    throw new HttpsError('unauthenticated', 'assembleTest requires a signed-in caller.');
  }

  // Fall back to defaults for anything the caller (or a test) didn't override.
  const count = options.count ?? DEFAULT_QUESTION_COUNT;
  const random = options.random ?? Math.random;

  // Load every approved question. Only 'approved' content may reach students — drafts and
  // anything still awaiting review stay hidden.
  // The two reads are independent, so run them in parallel: the approved bank and the IDs the
  // user saw in their last few practice tests (ph-3-us-6).
  const [snapshot, seen] = await Promise.all([
    db.collection('questions').where('status', '==', 'approved').get(),
    recentlySeenQuestionIds(db, auth.uid),
  ]);

  // Pick a random, duplicate-free set with a realistic mix (scenario minimum, per-topic cap),
  // preferring questions not recently seen; see selectPracticeQuestions for the rules and
  // fallbacks. `d.data()` exposes type/chunkId.
  const selected = selectPracticeQuestions(
    snapshot.docs,
    count,
    random,
    { minScenario: MIN_SCENARIO_COUNT, maxPerTopic: MAX_PER_TOPIC, isSeen: (d) => seen.has(d.id) },
    (d) => d.data()
  );

  // Generated up front (rather than inline in the return) so the same ID is used both for the
  // client-facing result and the testAssignments document written below.
  const testId = randomUUID();

  // Convert each Firestore document into the client-safe shape. Copying fields one by one
  // (instead of spreading `doc.data()`) guarantees no extra stored fields leak to the app.
  const questions: AssembledQuestion[] = selected.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      text: data.text,
      // Most questions store the correct answer first, so serving stored order would let a
      // student learn to "always pick A". Shuffling here is safe for grading: scoreTest compares
      // the chosen answer's text to correctAnswer, not its position.
      choices: shuffle(data.choices, random),
      type: data.type,
      chunkId: data.chunkId,
      conceptId: data.conceptId,
    };
  });

  // Persist which question IDs were actually assigned to this caller for this test. A later
  // scoring function reads this record to grade only these questions, rather than trusting
  // question IDs supplied by the client (which could otherwise be used to probe for answers to
  // questions never shown to this user).
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

  return {
    testId,
    questions,
  };
}

/**
 * The deployed Cloud Function: a callable endpoint the mobile app invokes to get a new test.
 *
 * Thin wrapper only — it supplies the real Firestore instance and the caller's auth to
 * `assembleTestForUser`, which holds the actual logic (see its doc comment for inputs,
 * outputs, and errors). Clients pass no arguments; the question count is fixed server-side
 * by DEFAULT_QUESTION_COUNT.
 */
export const assembleTest = onCall((request) =>
  assembleTestForUser(getDb(), request.auth, { count: DEFAULT_QUESTION_COUNT })
);
