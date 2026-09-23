import type { Firestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getDb } from './adminApp';
import { shuffle } from './shuffle';

/**
 * Per-user limit on flashcard requests: at most RATE_LIMIT_MAX_CALLS per RATE_LIMIT_WINDOW_MS.
 *
 * Unlike assembleTest/assembleMiniQuiz, this function returns `correctAnswer`, so repeated calls
 * could be used to scrape the whole answer key. The limit slows that down; it doesn't prevent it.
 * 30 calls / 10 minutes is a starting proposal, not a validated product decision (ph-1-us-10,
 * Questions section) — tune here if real study sessions hit it.
 */
export const RATE_LIMIT_MAX_CALLS = 30;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

/**
 * One study card. Includes `correctAnswer` on purpose — flashcards show the answer.
 * `sourceRef`, `selfCheck` and review metadata are intentionally absent.
 */
export interface Flashcard {
  id: string;
  text: string;
  choices: string[];
  correctAnswer: string;
  /** 'fact' or 'scenario' — lets the UI style situational cards differently (ph-2-us-5). */
  type: string;
  chunkId: string;
  conceptId: string;
}

/** Response shape: the requested topic and its cards, in shuffled order. */
export interface GetFlashcardsResult {
  chunkId: string;
  cards: Flashcard[];
}

/** Injectable dependencies — both exist so tests can be deterministic. */
interface GetFlashcardsOptions {
  /** Random source for card order. Defaults to Math.random. */
  random?: () => number;
  /** Current time in ms for the rate limit. Defaults to Date.now. */
  now?: () => number;
}

/** Shape of `users/{uid}/rateLimits/flashcards` — a fixed-window counter. */
interface RateLimitState {
  /** When the current window began (ms since epoch). */
  windowStart: number;
  /** Calls made so far in the current window. */
  count: number;
}

/**
 * Counts one flashcard request against the caller's rate limit, or rejects it if the limit is
 * already used up for the current window.
 *
 * Trigger:  called by getFlashcardsForUser before any question content is read
 * Auth:     none itself — the caller has already verified `uid`
 * Inputs:   db; uid — whose counter to charge; now — current time in ms
 * Returns:  nothing
 * Reads:    `users/{uid}/rateLimits/flashcards`
 * Writes:   `users/{uid}/rateLimits/flashcards` — increments the count, or starts a new window
 *           once the old one has expired. Not written when the call is rejected.
 * Errors:   HttpsError('resource-exhausted') when the window's limit is already reached
 */
async function checkAndConsumeRateLimit(db: Firestore, uid: string, now: number): Promise<void> {
  // Server-only counter: firestore.rules has no rule for users/{uid}/rateLimits, so it falls
  // through to deny-all and clients can neither read nor reset it.
  const ref = db.collection('users').doc(uid).collection('rateLimits').doc('flashcards');

  // A transaction makes read-check-increment atomic, so parallel calls from one user can't all
  // read the same count and slip past the limit together.
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() as RateLimitState) : null;
    const windowActive = data !== null && now - data.windowStart < RATE_LIMIT_WINDOW_MS;

    // Throwing inside the transaction aborts it, so a rejected call doesn't count against the user.
    if (windowActive && data!.count >= RATE_LIMIT_MAX_CALLS) {
      throw new HttpsError('resource-exhausted', 'Too many flashcard requests — try again later.');
    }

    // Still in the window: add one. No counter yet, or the window expired: start a fresh window.
    tx.set(ref, windowActive ? { windowStart: data!.windowStart, count: data!.count + 1 } : { windowStart: now, count: 1 });
  });
}

/**
 * Returns one topic's approved questions, with their answers, for flashcard study.
 *
 * Implements ph-1-us-10. Split from the `getFlashcards` export below so it can be unit-tested
 * without the Firebase runtime (db, auth, randomness and time are all passed in).
 *
 * Trigger:  called by the `getFlashcards` onCall wrapper
 * Auth:     requires a signed-in user (anonymous auth counts); otherwise throws
 * Inputs:   db; auth — request.auth; chunkId — required topic, from request.data.chunkId;
 *           options.random / options.now — injectable for deterministic tests
 * Returns:  { chunkId, cards[] } — every approved question in the topic, shuffled. Cards include
 *           `correctAnswer`: this is the one read path that sends answers to the client,
 *           which is why it is rate-limited (see RATE_LIMIT_MAX_CALLS)
 * Reads:    `questions` where chunkId == input and status == 'approved';
 *           `users/{uid}/rateLimits/flashcards`
 * Writes:   the rate-limit counter only. Studying is unscored: nothing is written to
 *           testAssignments or testAttempts.
 * Errors:   HttpsError('unauthenticated') — no signed-in caller
 *           HttpsError('invalid-argument') — chunkId missing or not a non-empty string
 *           HttpsError('resource-exhausted') — over the per-user rate limit
 *           HttpsError('not-found') — the topic has no approved questions
 */
export async function getFlashcardsForUser(
  db: Firestore,
  auth: { uid: string } | undefined,
  chunkId: unknown,
  options: GetFlashcardsOptions = {}
): Promise<GetFlashcardsResult> {
  // Callable functions expose the caller via `auth`; it is undefined when no valid ID token was sent.
  if (!auth) {
    throw new HttpsError('unauthenticated', 'getFlashcards requires a signed-in caller.');
  }
  // chunkId arrives straight from client request data, so validate its type, not just presence.
  if (typeof chunkId !== 'string' || chunkId.length === 0) {
    throw new HttpsError('invalid-argument', 'chunkId must be a non-empty string.');
  }

  // Charge the rate limit before reading any content, so over-limit callers get nothing back.
  const now = options.now ? options.now() : Date.now();
  await checkAndConsumeRateLimit(db, auth.uid, now);

  // Only reviewed, approved questions may reach students; drafts and rejected ones stay hidden.
  const snapshot = await db
    .collection('questions')
    .where('chunkId', '==', chunkId)
    .where('status', '==', 'approved')
    .get();

  if (snapshot.empty) {
    throw new HttpsError('not-found', `No approved questions exist for chunkId "${chunkId}".`);
  }

  // Shuffle so each study session presents the topic's cards in a different order.
  const random = options.random ?? Math.random;
  const shuffled = shuffle(snapshot.docs, random);

  // Map to the card shape: answers included, but sourceRef/selfCheck/review fields left out.
  const cards: Flashcard[] = shuffled.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      text: data.text,
      choices: data.choices,
      correctAnswer: data.correctAnswer,
      type: data.type,
      chunkId: data.chunkId,
      conceptId: data.conceptId,
    };
  });

  return { chunkId, cards };
}

/**
 * The deployed Cloud Function. `onCall` verifies the caller's Firebase ID token and fills in
 * `request.auth` before this runs. Expects request data `{ chunkId: string }`.
 * See `getFlashcardsForUser` for the logic.
 */
export const getFlashcards = onCall((request) =>
  getFlashcardsForUser(getDb(), request.auth, request.data?.chunkId)
);
