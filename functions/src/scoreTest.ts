import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getDb } from './adminApp';

/**
 * Mini-quiz score (0-1) at or above which the student is told to move on to the next topic;
 * below it they're told to review this one again. 80% is the proposed default from prd.md
 * Section 9, not yet a validated product decision (ph-1-us-11) — tune it here.
 */
const MINI_QUIZ_PASS_THRESHOLD = 0.8;

/** Which kind of session was graded. Stored on the attempt so later phases can filter by it. */
type AttemptType = 'practice' | 'mini-quiz' | 'baseline';

/** One submitted answer: the choice text the student picked for a question. */
interface AnswerInput {
  questionId: string;
  choice: string;
}

/** How the student did on one topic within the session. */
export interface PerTopicResult {
  chunkId: string;
  correct: number;
  total: number;
}

/**
 * What the client receives after submitting. The same fields (minus `testId`, plus `chunkId`
 * and `createdAt`) are saved to `users/{uid}/testAttempts/{testId}`. Correct answers are
 * deliberately not returned — review of individual misses is a later phase.
 */
export interface ScoreTestResult {
  testId: string;
  type: AttemptType;
  /** correctCount / totalCount, 0-1. */
  score: number;
  correctCount: number;
  /** Number of questions assigned, not number answered — skipped questions count as wrong. */
  totalCount: number;
  perTopic: PerTopicResult[];
  /** Mini-quizzes only; null for practice tests and baseline sections. */
  recommendation: 'move-on' | 'review-again' | null;
}

/** Raw request data. Typed `unknown` because it comes straight from the client. */
interface ScoreTestInput {
  testId: unknown;
  answers: unknown;
}

/**
 * Checks the request shape and drops malformed answer entries.
 *
 * A malformed entry is ignored rather than rejected, so a single bad element can't block a
 * student from submitting the rest of their test — the skipped question just scores as wrong.
 */
function validateInput(input: ScoreTestInput): { testId: string; answers: AnswerInput[] } {
  if (typeof input.testId !== 'string' || input.testId.length === 0) {
    throw new HttpsError('invalid-argument', 'testId must be a non-empty string.');
  }
  if (!Array.isArray(input.answers)) {
    throw new HttpsError('invalid-argument', 'answers must be an array.');
  }
  const answers = input.answers.filter(
    (a): a is AnswerInput =>
      typeof a === 'object' && a !== null && typeof a.questionId === 'string' && typeof a.choice === 'string'
  );
  return { testId: input.testId, answers };
}

/**
 * Grades the given questions against the submitted answers.
 *
 * Only `questionIds` (always taken from a server-side record) are graded. Answers for any other
 * question ID are ignored, so a client can't pad its score by submitting extra questions.
 *
 * Returns:  correctCount; perTopic breakdown; attemptChunkId — the single topic every question
 *           belongs to, or null when they span several topics
 * Reads:    `questions/{id}` for each ID
 * Writes:   none
 */
async function gradeQuestions(
  db: Firestore,
  questionIds: string[],
  answers: AnswerInput[]
): Promise<{
  correctCount: number;
  perTopic: PerTopicResult[];
  attemptChunkId: string | null;
}> {
  const answerByQuestionId = new Map(answers.map((a) => [a.questionId, a.choice]));
  const questionDocs = await Promise.all(questionIds.map((id) => db.collection('questions').doc(id).get()));

  const perTopicMap = new Map<string, PerTopicResult>();
  let correctCount = 0;
  let singleChunkId: string | null = null;

  for (const doc of questionDocs) {
    const data = doc.data()!;
    const chunkId: string = data.chunkId;
    // Track whether every question shares one topic; 'mixed' as soon as two differ.
    singleChunkId = singleChunkId === null ? chunkId : singleChunkId === chunkId ? chunkId : 'mixed';

    // A question with no submitted answer is wrong, not an error.
    const submitted = answerByQuestionId.get(doc.id) ?? null;
    const correct = submitted !== null && submitted === data.correctAnswer;
    if (correct) correctCount += 1;

    const topic = perTopicMap.get(chunkId) ?? { chunkId, correct: 0, total: 0 };
    topic.total += 1;
    if (correct) topic.correct += 1;
    perTopicMap.set(chunkId, topic);
  }

  return {
    correctCount,
    perTopic: [...perTopicMap.values()],
    attemptChunkId: singleChunkId === 'mixed' ? null : singleChunkId,
  };
}

/**
 * Grades a practice test or mini-quiz against the assignment recorded when it was handed out.
 *
 * Reads:    `users/{uid}/testAssignments/{testId}` (written by assembleTest/assembleMiniQuiz),
 *           `questions/{id}`
 * Writes:   `users/{uid}/testAttempts/{testId}`; sets the assignment's `scored: true`
 * Errors:   HttpsError('not-found') — no such assignment for this user
 *           HttpsError('already-exists') — the assignment was already scored
 */
async function scoreAssignedTest(
  db: Firestore,
  uid: string,
  testId: string,
  answers: AnswerInput[]
): Promise<ScoreTestResult> {
  // Both docs live under the caller's own uid, so one user can never score another's test.
  const assignmentRef = db.collection('users').doc(uid).collection('testAssignments').doc(testId);
  const attemptRef = db.collection('users').doc(uid).collection('testAttempts').doc(testId);

  // A transaction makes check-then-mark-scored atomic, so a double-tapped submit can't record
  // two attempts for one test.
  return db.runTransaction(async (tx) => {
    const assignmentSnap = await tx.get(assignmentRef);
    if (!assignmentSnap.exists) {
      throw new HttpsError('not-found', 'No assignment found for this testId.');
    }
    const assignment = assignmentSnap.data()!;
    if (assignment.scored) {
      throw new HttpsError('already-exists', 'This test has already been scored.');
    }

    // Grade only the questions this user was actually assigned, never IDs the client chose.
    const questionIds: string[] = assignment.questionIds;
    const { correctCount, perTopic, attemptChunkId } = await gradeQuestions(db, questionIds, answers);
    const totalCount = questionIds.length;
    const score = totalCount === 0 ? 0 : correctCount / totalCount;
    // The type comes from the server-written assignment, so the client can't relabel a test.
    const type: AttemptType = assignment.type;

    const recommendation =
      type === 'mini-quiz' ? (score >= MINI_QUIZ_PASS_THRESHOLD ? 'move-on' : 'review-again') : null;

    tx.set(attemptRef, {
      type,
      // Mini-quizzes record their topic; practice tests get one only if every question shared it.
      chunkId: assignment.chunkId ?? attemptChunkId,
      score,
      correctCount,
      totalCount,
      perTopic,
      recommendation,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(assignmentRef, { scored: true });

    return { testId, type, score, correctCount, totalCount, perTopic, recommendation };
  });
}

/**
 * Grades one baseline section and advances the user's baseline progress.
 *
 * Reads:    `users/{uid}/baseline/progress`, `baselineTests/{version}`, `questions/{id}`
 * Writes:   `users/{uid}/testAttempts/{testId}`; `users/{uid}/baseline/progress` — moves
 *           `currentSection` forward, or on the last section sets `completedAt` and
 *           `freeTestUsedAt` (the baseline is the user's one free full test)
 * Errors:   HttpsError('invalid-argument') — malformed testId
 *           HttpsError('not-found') — no baseline in progress for this user, or the testId names a
 *           different baseline version than the one the user is pinned to
 *           HttpsError('already-exists') — not the user's current section, or already complete
 */
async function scoreBaselineSection(
  db: Firestore,
  uid: string,
  testId: string,
  answers: AnswerInput[]
): Promise<ScoreTestResult> {
  // testId format is `baseline-{version}-{section}` (set by startOrResumeBaseline). Split at the
  // last dash so a version name containing dashes still parses.
  const lastDash = testId.lastIndexOf('-');
  const version = testId.slice('baseline-'.length, lastDash);
  const section = Number(testId.slice(lastDash + 1));
  if (!version || Number.isNaN(section)) {
    throw new HttpsError('invalid-argument', `Malformed baseline testId "${testId}".`);
  }

  const progressRef = db.collection('users').doc(uid).collection('baseline').doc('progress');
  const attemptRef = db.collection('users').doc(uid).collection('testAttempts').doc(testId);
  const baselineRef = db.collection('baselineTests').doc(version);

  // Transaction so a double submit can't advance progress twice or record two attempts.
  return db.runTransaction(async (tx) => {
    const [progressSnap, baselineSnap] = await Promise.all([tx.get(progressRef), tx.get(baselineRef)]);
    if (!progressSnap.exists || !baselineSnap.exists) {
      throw new HttpsError('not-found', 'No baseline in progress for this testId.');
    }
    const progress = progressSnap.data()!;
    // The version comes from the client-supplied testId, so it must match the version the user
    // is pinned to — otherwise they could be graded against, and advance through, another
    // version's questions.
    if (progress.version !== version) {
      throw new HttpsError('not-found', 'No baseline in progress for this testId.');
    }
    // Only the section the user is on can be submitted. This blocks both resubmitting a graded
    // section and skipping ahead.
    if (progress.currentSection !== section || progress.completedAt) {
      throw new HttpsError('already-exists', 'This baseline section has already been scored.');
    }

    const sections: { section: number; questionIds: string[] }[] = baselineSnap.data()!.sections;
    const sectionDef = sections.find((s) => s.section === section)!;
    const { correctCount, perTopic } = await gradeQuestions(db, sectionDef.questionIds, answers);
    const totalCount = sectionDef.questionIds.length;
    const score = totalCount === 0 ? 0 : correctCount / totalCount;

    tx.set(attemptRef, {
      type: 'baseline' as AttemptType,
      // A baseline section spans many topics by design, so it has no single topic.
      chunkId: null,
      score,
      correctCount,
      totalCount,
      perTopic,
      recommendation: null,
      createdAt: FieldValue.serverTimestamp(),
    });

    // After the last section, leave currentSection where it is and mark the baseline complete;
    // startOrResumeBaseline then refuses to serve it again.
    const isLastSection = section >= sections.length;
    tx.update(progressRef, {
      currentSection: isLastSection ? section : section + 1,
      completedAt: isLastSection ? FieldValue.serverTimestamp() : null,
      freeTestUsedAt: isLastSection ? FieldValue.serverTimestamp() : null,
    });

    return {
      testId,
      type: 'baseline' as AttemptType,
      score,
      correctCount,
      totalCount,
      perTopic,
      recommendation: null,
    };
  });
}

/**
 * Grades a submitted set of answers for a practice test, mini-quiz, or baseline section.
 *
 * Implements ph-1-us-11. This is the only place correct answers are compared with a user's
 * submission; they never leave the server. Split from the `scoreTest` export below so it can be
 * unit-tested without the Firebase runtime.
 *
 * Trigger:  called by the `scoreTest` onCall wrapper
 * Auth:     requires a signed-in user (anonymous auth counts); otherwise throws
 * Inputs:   db; auth — request.auth; rawInput.testId — as returned by assembleTest,
 *           assembleMiniQuiz, or startOrResumeBaseline; rawInput.answers —
 *           [{ questionId, choice }]. Unanswered or unknown questions count as wrong.
 * Returns:  ScoreTestResult — score, per-topic breakdown, and for mini-quizzes a
 *           move-on/review-again recommendation (see MINI_QUIZ_PASS_THRESHOLD)
 * Reads:    the session's server-side record (testAssignments, or baseline progress +
 *           baselineTests) and `questions/{id}` for each graded question
 * Writes:   `users/{uid}/testAttempts/{testId}`; plus either the assignment's `scored: true`
 *           (practice/mini-quiz) or `users/{uid}/baseline/progress` (baseline)
 * Errors:   HttpsError('unauthenticated') — no signed-in caller
 *           HttpsError('invalid-argument') — missing testId, non-array answers, malformed
 *           baseline testId
 *           HttpsError('not-found') — no matching assignment or baseline for this user
 *           HttpsError('already-exists') — this session (or baseline section) was already scored
 */
export async function scoreTestForUser(
  db: Firestore,
  auth: { uid: string } | undefined,
  rawInput: ScoreTestInput
): Promise<ScoreTestResult> {
  // Callable functions expose the caller via `auth`; it is undefined when no valid ID token was sent.
  if (!auth) {
    throw new HttpsError('unauthenticated', 'scoreTest requires a signed-in caller.');
  }
  const { testId, answers } = validateInput(rawInput);

  // Baseline testIds have a fixed prefix; practice/mini-quiz testIds are UUIDs, which never do.
  if (testId.startsWith('baseline-')) {
    return scoreBaselineSection(db, auth.uid, testId, answers);
  }
  return scoreAssignedTest(db, auth.uid, testId, answers);
}

/**
 * The deployed Cloud Function. `onCall` verifies the caller's Firebase ID token and fills in
 * `request.auth` before this runs. Expects request data `{ testId, answers }`.
 * See `scoreTestForUser` for the logic.
 */
export const scoreTest = onCall((request) =>
  scoreTestForUser(getDb(), request.auth, request.data ?? {})
);
