import { getDb } from './adminApp';
import type { QuestionRecord } from './types';

export interface ExportedQuestion extends QuestionRecord {
  id: string;
}

export async function exportQuestions(chunkId: string): Promise<ExportedQuestion[]> {
  const db = getDb();
  const snap = await db
    .collection('questions')
    .where('chunkId', '==', chunkId)
    .where('status', 'in', ['pending_review', 'flagged'])
    .get();

  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as QuestionRecord) }));
}
