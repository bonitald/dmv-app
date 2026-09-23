import { getDb } from './adminApp';
import { readChunkPlan } from './readChunkPlan';

export interface PublishTopicsResult {
  runId: string;
  topicsWritten: number;
}

export async function publishTopics(runId: string): Promise<PublishTopicsResult> {
  const run = await readChunkPlan(runId);
  const db = getDb();
  const batch = db.batch();

  for (const chunk of run.chunks) {
    const approvedSnap = await db
      .collection('questions')
      .where('chunkId', '==', chunk.chunkId)
      .where('status', '==', 'approved')
      .get();

    batch.set(db.collection('topics').doc(chunk.chunkId), {
      title: chunk.title,
      description: chunk.description,
      order: chunk.pageStart,
      approvedQuestionCount: approvedSnap.size,
    });
  }

  await batch.commit();
  return { runId, topicsWritten: run.chunks.length };
}
