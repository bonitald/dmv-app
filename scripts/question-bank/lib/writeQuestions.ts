import { readFileSync } from 'node:fs';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from './adminApp';
import { validateQuestions } from './validate';

export async function writeQuestions(jsonPath: string): Promise<{ written: number }> {
  const raw = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  const questions = validateQuestions(raw);

  const db = getDb();
  const batch = db.batch();
  const collection = db.collection('questions');

  for (const question of questions) {
    const ref = collection.doc();
    batch.set(ref, {
      ...question,
      status: question.selfCheck.passed ? 'pending_review' : 'flagged',
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  return { written: questions.length };
}
