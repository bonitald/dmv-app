import { getDb } from './adminApp';
import { readChunkPlan } from './readChunkPlan';
import type { IngestionRunRecord } from './types';

async function seedRun(chunks: IngestionRunRecord['chunks']): Promise<string> {
  const ref = getDb().collection('ingestionRuns').doc();
  await ref.set({
    sourceDoc: 'x.pdf',
    createdAt: new Date(),
    status: 'processing',
    chunks,
  });
  return ref.id;
}

describe('readChunkPlan', () => {
  const baseChunk = {
    chunkId: 'c1',
    title: 'Right of Way',
    description: 'desc',
    pageStart: 1,
    pageEnd: 2,
    status: 'pending' as const,
    questionsGenerated: 0,
    error: null,
  };

  it('reads back a previously written run', async () => {
    const runId = await seedRun([baseChunk, { ...baseChunk, chunkId: 'c2', status: 'done', questionsGenerated: 4 }]);

    const record = await readChunkPlan(runId);

    expect(record.sourceDoc).toBe('x.pdf');
    expect(record.status).toBe('processing');
    expect(record.chunks).toEqual([
      baseChunk,
      { ...baseChunk, chunkId: 'c2', status: 'done', questionsGenerated: 4 },
    ]);
  });

  it('rejects an unknown runId', async () => {
    await expect(readChunkPlan('nonexistent-run')).rejects.toThrow('does not exist');
  });
});
