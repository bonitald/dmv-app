// Client-side copies of the Cloud Function contracts in functions/README.md. The functions
// package is built separately, so these are kept in sync by hand. Change both sides together.

export type QuestionType = 'fact' | 'scenario';

/** A question as the assemble functions hand it out: no correct answer. */
export interface QuizQuestion {
  id: string;
  text: string;
  choices: string[];
  type: QuestionType;
  chunkId: string;
  conceptId: string;
}

/** `assembleTest` / `assembleMiniQuiz` response. */
export interface AssembledTest {
  testId: string;
  questions: QuizQuestion[];
}

/** `startOrResumeBaseline` response. `testId` is `baseline-{version}-{section}`. */
export interface BaselineSection extends AssembledTest {
  version: string;
  section: number;
  totalSections: number;
}

export interface AnswerSubmission {
  questionId: string;
  choice: string;
}

export interface PerTopicResult {
  chunkId: string;
  correct: number;
  total: number;
}

/** `correctAnswer` / `correct` are null for baseline sections before the last. */
export interface PerQuestionResult {
  questionId: string;
  chunkId: string | null;
  choice: string | null;
  correctAnswer: string | null;
  correct: boolean | null;
  unavailable?: true;
}

export interface ScoreTestResult {
  testId: string;
  type: 'practice' | 'mini-quiz' | 'baseline';
  score: number;
  correctCount: number;
  totalCount: number;
  perTopic: PerTopicResult[];
  perQuestion: PerQuestionResult[];
  /** Final baseline section only: all 45 questions with answers revealed. */
  baselineReview?: PerQuestionResult[];
  recommendation: 'move-on' | 'review-again' | null;
}
