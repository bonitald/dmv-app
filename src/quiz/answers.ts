import type { AnswerSubmission, QuizQuestion } from '../api/types';

/** questionId → the choice text the user picked. Unanswered questions have no entry. */
export type Answers = Record<string, string>;

/** Builds `scoreTest`'s `answers`, in question order. Unanswered questions are left out. */
export function toAnswerList(questions: QuizQuestion[], answers: Answers): AnswerSubmission[] {
  return questions
    .filter((question) => answers[question.id] !== undefined)
    .map((question) => ({ questionId: question.id, choice: answers[question.id] }));
}

export function countUnanswered(questions: QuizQuestion[], answers: Answers): number {
  return questions.filter((question) => answers[question.id] === undefined).length;
}
