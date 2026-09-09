import { getDb } from './adminApp';
import { updateChunkStatus } from './updateChunkStatus';
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

describe('updateChunkStatus', () => {
  const baseChunk = {
    chunkId: 'c1',
    title: 'T',
    description: 'd',
    pageStart: 1,
    pageEnd: 2,
    status: 'pending' as const,
    questionsGenerated: 0,
    error: null,
  };

  it('marks a chunk done and records questionsGenerated', async () => {
    const runId = await seedRun([baseChunk, { ...baseChunk, chunkId: 'c2' }]);

    await updateChunkStatus(runId, 'c1', 'done', { questionsGenerated: 4 });

    const snap = await getDb().collection('ingestionRuns').doc(runId).get();
    const chunk = snap.data()?.chunks.find((c: { chunkId: string }) => c.chunkId === 'c1');
    expect(chunk).toMatchObject({ status: 'done', questionsGenerated: 4, error: null });
    expect(snap.data()?.status).toBe('processing');
  });

  it('marks a chunk errored with a message', async () => {
    const runId = await seedRun([baseChunk]);

    await updateChunkStatus(runId, 'c1', 'error', { error: 'PDF page unreadable' });

    const snap = await getDb().collection('ingestionRuns').doc(runId).get();
    const chunk = snap.data()?.chunks.find((c: { chunkId: string }) => c.chunkId === 'c1');
    expect(chunk).toMatchObject({ status: 'error', error: 'PDF page unreadable' });
  });

  it('flips the run to complete once every chunk is done or error', async () => {
    const runId = await seedRun([baseChunk, { ...baseChunk, chunkId: 'c2' }]);

    await updateChunkStatus(runId, 'c1', 'done', { questionsGenerated: 2 });
    await updateChunkStatus(runId, 'c2', 'error', { error: 'oops' });

    const snap = await getDb().collection('ingestionRuns').doc(runId).get();
    expect(snap.data()?.status).toBe('complete');
  });

  it('rejects an unknown chunkId', async () => {
    const runId = await seedRun([baseChunk]);

    await expect(updateChunkStatus(runId, 'nope', 'done', {})).rejects.toThrow(
      'Chunk "nope" not found'
    );
  });

  it('rejects an unknown runId', async () => {
    await expect(updateChunkStatus('nonexistent-run', 'c1', 'done', {})).rejects.toThrow(
      'does not exist'
    );
  });
});
