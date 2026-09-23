import { randomUUID } from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getDb } from './adminApp';
import { shuffle } from './shuffle';

// ph-1-us-4: exact per-test question count is undefined (prd.md Section 9) — kept as a single
// easy-to-change constant rather than hardcoded in multiple places.
const DEFAULT_QUESTION_COUNT = 25;

/**
 * One question as it is sent to the client. This is a deliberate subset of the Firestore
 * `questions` document: only the fields listed here leave the server, so anything else stored
 * on the document (e.g. review status or answer data) is never exposed to the app.
 */
export interface AssembledQuestion {
  id: string; // Firestore document ID of the question
  text: string; // The question prompt shown to the student
  choices: string[]; // Answer options, in stored order
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
 *           options.random — random source (default Math.random)
 * Returns:  { testId, questions[] } — questions contain id/text/choices/type/chunkId/conceptId
 *           only
 * Reads:    `questions` collection, filtered to status == 'approved'
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
  const snapshot = await db.collection('questions').where('status', '==', 'approved').get();

  // Shuffle the full pool, then take the first `count`. Together this picks a random,
  // duplicate-free set, so each generated test differs from the last.
  const shuffled = shuffle(snapshot.docs, random);
  const selected = shuffled.slice(0, count);

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
      choices: data.choices,
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
