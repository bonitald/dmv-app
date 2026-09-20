import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from './adminApp';
import type { QuestionStatus } from './types';

export interface ReviewResult {
  id: string;
  verdict: Extract<QuestionStatus, 'approved' | 'flagged' | 'rejected'>;
  sourceRef?: string;
  reviewNotes?: string;
  reviewedBy: string;
}

export async function applyReviews(results: ReviewResult[]): Promise<{ updated: number }> {
  const db = getDb();
  const batch = db.batch();
  const collection = db.collection('questions');

  for (const result of results) {
    const ref = collection.doc(result.id);
    const update: Record<string, unknown> = {
      status: result.verdict,
      reviewedBy: result.reviewedBy,
      reviewedAt: FieldValue.serverTimestamp(),
      reviewNotes: result.reviewNotes ?? null,
    };
    if (result.sourceRef) {
      update.sourceRef = result.sourceRef;
    }
    batch.update(ref, update);
  }

  await batch.commit();
  return { updated: results.length };
}
