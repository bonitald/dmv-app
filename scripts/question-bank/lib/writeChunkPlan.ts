import { readFileSync } from 'node:fs';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from './adminApp';
import { validateChunkPlan } from './validate';
import type { ChunkRecord, IngestionRunRecord } from './types';

export async function writeChunkPlan(jsonPath: string): Promise<string> {
  const raw = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  const plan = validateChunkPlan(raw);

  const chunks: ChunkRecord[] = plan.chunks.map((chunk) => ({
    chunkId: chunk.chunkId,
    title: chunk.title,
    description: chunk.description,
    pageStart: chunk.pageStart,
    pageEnd: chunk.pageEnd,
    status: 'pending',
    questionsGenerated: 0,
    error: null,
  }));

  const record: IngestionRunRecord = {
    sourceDoc: plan.sourceDoc,
    createdAt: FieldValue.serverTimestamp(),
    status: 'processing',
    chunks,
  };

  const ref = getDb().collection('ingestionRuns').doc();
  await ref.set(record);

  return ref.id;
}
