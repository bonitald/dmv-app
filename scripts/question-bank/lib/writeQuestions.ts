import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from './adminApp';
import { readJsonFile } from './readJsonFile';
import { validateQuestions } from './validate';
import type { QuestionRecord } from './types';

export async function writeQuestions(jsonPath: string): Promise<{ written: number }> {
  const raw = readJsonFile(jsonPath);
  const questions = validateQuestions(raw);

  const db = getDb();
  const batch = db.batch();
  const collection = db.collection('questions');

  for (const question of questions) {
    const ref = collection.doc();
    const record: QuestionRecord = {
      conceptId: question.conceptId,
      chunkId: question.chunkId,
      sourceRef: question.sourceRef,
      type: question.type,
      text: question.text,
      choices: question.choices,
      correctAnswer: question.correctAnswer,
      selfCheck: question.selfCheck,
      status: question.selfCheck.passed ? 'pending_review' : 'flagged',
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null,
      createdAt: FieldValue.serverTimestamp(),
    };
    batch.set(ref, record);
  }

  await batch.commit();
  return { written: questions.length };
}
