import { randomUUID } from 'crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getDb } from './adminApp';
import type { AssembledQuestion } from './assembleTest';
import { shuffle } from './shuffle';

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
 * (`chunkId`) and sized by `miniQuizSize` (ph-2-us-8) rather than the whole approved bank.
 *
 * Trigger:  called by the `assembleMiniQuiz` onCall wrapper below
 * Auth:     requires a signed-in caller; otherwise `unauthenticated`
 * Inputs:   input.chunkId — required, the topic to quiz
 *           input.count — optional; defaults to miniQuizSize(topic's approved questions), capped at 15
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

  // An explicit count is still accepted (and capped) so the contract stays backwards
  // compatible; the app no longer sends one.
  if (
    input.count !== undefined &&
    (typeof input.count !== 'number' || !Number.isInteger(input.count) || input.count <= 0)
  ) {
    throw new HttpsError('invalid-argument', 'count must be a positive integer.');
  }

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

  // Size from the topic's whole approved pool (before excludeIds is applied), so the quiz
  // length doesn't shrink on "Review Again".
  const count =
    typeof input.count === 'number'
      ? Math.min(input.count, MAX_MINI_QUIZ_COUNT)
      : miniQuizSize(snapshot.size);

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
