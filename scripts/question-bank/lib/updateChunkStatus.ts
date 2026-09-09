import { getDb } from './adminApp';
import type { ChunkStatus, IngestionRunRecord } from './types';

export interface UpdateChunkStatusOptions {
  questionsGenerated?: number;
  error?: string;
}

export async function updateChunkStatus(
  runId: string,
  chunkId: string,
  status: ChunkStatus,
  options: UpdateChunkStatusOptions = {}
): Promise<void> {
  const ref = getDb().collection('ingestionRuns').doc(runId);

  await getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new Error(`ingestionRuns/${runId} does not exist`);
    }

    const data = snap.data() as IngestionRunRecord;
    const index = data.chunks.findIndex((c) => c.chunkId === chunkId);
    if (index === -1) {
      throw new Error(`Chunk "${chunkId}" not found in ingestionRuns/${runId}`);
    }

    const updatedChunks = [...data.chunks];
    updatedChunks[index] = {
      ...updatedChunks[index],
      status,
      questionsGenerated: options.questionsGenerated ?? updatedChunks[index].questionsGenerated,
      error: status === 'error' ? options.error ?? 'Unknown error' : null,
    };

    const allSettled = updatedChunks.every((c) => c.status === 'done' || c.status === 'error');

    tx.update(ref, {
      chunks: updatedChunks,
      status: allSettled ? 'complete' : data.status,
    });
  });
}
