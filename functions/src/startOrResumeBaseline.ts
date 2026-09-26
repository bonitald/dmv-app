import { FieldValue, type Firestore, type Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getDb } from './adminApp';
import type { AssembledQuestion } from './assembleTest';
import { seededRandom, shuffle } from './shuffle';

/**
 * The baseline definition every new user is started on (ph-1-us-8).
 *
 * All users share one fixed baseline, published by the `qb:build-baseline` script as
 * `baselineTests/{version}`. To replace a stale question, publish a new version and bump this
 * constant: users already mid-baseline keep finishing the version stored in their progress doc,
 * and finished users keep their result against the version they took.
 */
export const CURRENT_BASELINE_VERSION = 'v1';

/** What the client receives: one section of the baseline, ready to render as a test. */
export interface StartOrResumeBaselineResult {
  /**
   * `baseline-{version}-{section}`. `scoreTest` (ph-1-us-11) parses this exact format to tell a
   * baseline submission apart from a practice test or mini-quiz — don't change it on one side only.
   */
  testId: string;
  /** Which `baselineTests/{version}` this section came from. */
  version: string;
  /** 1-based section number the user should take now. */
  section: number;
  /** How many sections the baseline has in total (3 for the standard 45-question baseline). */
  totalSections: number;
  /** The section's questions, client-safe: no correct answers or review metadata. */
  questions: AssembledQuestion[];
}

/**
 * Shape of `users/{uid}/baseline/progress`. Clients may read it but never write it
 * (firestore.rules); only this function (on creation) and `scoreTest` (on advancing) do.
 */
interface BaselineProgress {
  /** Baseline version this user is locked to, so a mid-run version bump can't reshuffle them. */
  version: string;
  /** The section the user has not yet submitted. Advanced by `scoreTest`, never here. */
  currentSection: number;
  /** Set by `scoreTest` when the last section is graded; once set the baseline can't be retaken. */
  completedAt: Timestamp | null;
  /** When the baseline was consumed as the user's one free full test (ph-1-us-8). */
  freeTestUsedAt: Timestamp | null;
}

/**
 * Starts a new user's baseline diagnostic, or resumes an in-progress one at their current
 * section. Every user gets the same fixed 45 questions, delivered 15 at a time.
 *
 * Implements ph-1-us-8. Split from the `startOrResumeBaseline` export below so it can be
 * unit-tested without the Firebase runtime (db and auth are passed in).
 *
 * Trigger:  called by the `startOrResumeBaseline` onCall wrapper
 * Auth:     requires a signed-in user (anonymous auth counts); otherwise throws
 * Inputs:   db — Firestore instance; auth — request.auth. The client sends no request data:
 *           which section to serve comes only from server-side progress, so a client can't
 *           skip ahead or re-serve an earlier section.
 * Returns:  StartOrResumeBaselineResult — the current section's questions, without answers.
 *           Each question's choices are shuffled in a fixed order seeded by its ID, so every
 *           call and every user sees the same order.
 * Reads:    `users/{uid}/baseline/progress`, `baselineTests/{version}`, `questions/{id}` by ID
 * Writes:   `users/{uid}/baseline/progress`, only on a user's first call. Calling again without
 *           submitting returns the same section; only `scoreTest` moves progress forward.
 * Errors:   HttpsError('unauthenticated') — no signed-in caller
 *           HttpsError('already-exists') — this user already completed the baseline
 *           HttpsError('failed-precondition') — the user's baseline version isn't published, or
 *           the section references a question that has since been deleted
 *           HttpsError('internal') — the progress doc points at a section the baseline lacks
 */
export async function startOrResumeBaselineForUser(
  db: Firestore,
  auth: { uid: string } | undefined
): Promise<StartOrResumeBaselineResult> {
  // Callable functions expose the caller via `auth`; it is undefined when no valid ID token was sent.
  if (!auth) {
    throw new HttpsError('unauthenticated', 'startOrResumeBaseline requires a signed-in caller.');
  }

  // The baseline is per user and single-use, so everything keys off this one progress doc.
  const progressRef = db.collection('users').doc(auth.uid).collection('baseline').doc('progress');
  const progressSnap = await progressRef.get();

  let progress: BaselineProgress;
  if (progressSnap.exists) {
    progress = progressSnap.data() as BaselineProgress;
    // The baseline doubles as the one free full test, so it can't be retaken once finished.
    if (progress.completedAt) {
      throw new HttpsError('already-exists', 'The baseline has already been completed.');
    }
  } else {
    // First call ever for this user: create progress at section 1, pinned to the current version.
    progress = {
      version: CURRENT_BASELINE_VERSION,
      currentSection: 1,
      completedAt: null,
      freeTestUsedAt: null,
    };
    await progressRef.set({ ...progress, createdAt: FieldValue.serverTimestamp() });
  }

  // Load the version the user is pinned to, which may be older than CURRENT_BASELINE_VERSION.
  const baselineSnap = await db.collection('baselineTests').doc(progress.version).get();
  if (!baselineSnap.exists) {
    throw new HttpsError(
      'failed-precondition',
      `baselineTests/${progress.version} is not published.`
    );
  }
  const sections = baselineSnap.data()!.sections as { section: number; questionIds: string[] }[];
  const section = sections.find((s) => s.section === progress.currentSection);
  if (!section) {
    throw new HttpsError('internal', `Section ${progress.currentSection} is not defined.`);
  }

  // Fetch by ID, not by query: order and membership are fixed by the published baseline, and
  // every user must see the same questions in the same order. (Question order is never
  // shuffled, unlike assembleTest; only each question's choices are, in a fixed order below.)
  const questionDocs = await Promise.all(
    section.questionIds.map((id) => db.collection('questions').doc(id).get())
  );

  // A question hard-deleted from the bank after the baseline was published. Serving a partial
  // section would break "same questions for every user", so fail clearly instead; an operator
  // fixes it by publishing a new baseline version (qb:validate-baseline reports these).
  const missing = questionDocs.filter((doc) => !doc.exists).map((doc) => doc.id);
  if (missing.length > 0) {
    throw new HttpsError(
      'failed-precondition',
      `Baseline ${progress.version} section ${section.section} references deleted question(s): ${missing.join(', ')}.`
    );
  }

  // Map to the client-safe shape. `correctAnswer`, `sourceRef`, `selfCheck` and review fields are
  // intentionally left out so answers can't be read from the network response.
  const questions: AssembledQuestion[] = questionDocs.map((doc) => {
    const data = doc.data()!;
    return {
      id: doc.id,
      text: data.text,
      // Shuffle choices so the correct answer isn't always in the stored (usually first) slot,
      // but seed the shuffle with the question ID so the order never changes: a resumed section
      // must show exactly what was shown before, and every user gets the identical baseline.
      // Grading is unaffected — scoreTest compares answer text, not position.
      choices: shuffle(data.choices, seededRandom(`baseline:${doc.id}`)),
      type: data.type,
      chunkId: data.chunkId,
      conceptId: data.conceptId,
    };
  });

  return {
    testId: `baseline-${progress.version}-${section.section}`,
    version: progress.version,
    section: section.section,
    totalSections: sections.length,
    questions,
  };
}

/**
 * The deployed Cloud Function. `onCall` verifies the caller's Firebase ID token and fills in
 * `request.auth` before this runs. See `startOrResumeBaselineForUser` for the logic.
 */
export const startOrResumeBaseline = onCall((request) =>
  startOrResumeBaselineForUser(getDb(), request.auth)
);
