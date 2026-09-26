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
 * Returns:  { testId, questions[] } — no correctAnswer/sourceRef/selfCheck/review metadata;
 *           each question's choices are shuffled
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
      // Shuffled so the correct answer isn't always in the stored (usually first) slot. Safe for
      // grading: scoreTest compares answer text to correctAnswer, not position.
      choices: shuffle(data.choices, random),
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
