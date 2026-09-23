import { getDb } from './adminApp';
import { publishTopics } from './publishTopics';
import type { IngestionRunRecord } from './types';

async function seedRun(chunks: IngestionRunRecord['chunks']): Promise<string> {
  const ref = getDb().collection('ingestionRuns').doc();
  await ref.set({ sourceDoc: 'x.pdf', createdAt: new Date(), status: 'complete', chunks });
  return ref.id;
}

async function seedQuestion(chunkId: string, status: string) {
  await getDb()
    .collection('questions')
    .doc()
    .set({
      conceptId: 'c1',
      chunkId,
      sourceRef: 'p.1',
      type: 'fact',
      text: 'x',
      choices: ['a', 'b'],
      correctAnswer: 'a',
      status,
      selfCheck: { passed: true },
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null,
    });
}

// Test files share one emulator and run in parallel, so each test scopes its data to a unique
// chunkId instead of wiping collections other files are using.
function uniqueChunkId(): string {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

describe('publishTopics', () => {
  const baseChunk = {
    title: 'Right of Way',
    description: 'desc',
    pageStart: 12,
    pageEnd: 13,
    status: 'done' as const,
    questionsGenerated: 2,
    error: null,
  };

  it('writes a topics doc per chunk with the approved question count', async () => {
    const chunkId = uniqueChunkId();
    const runId = await seedRun([{ ...baseChunk, chunkId }]);
    await seedQuestion(chunkId, 'approved');
    await seedQuestion(chunkId, 'approved');
    await seedQuestion(chunkId, 'pending_review');

    const result = await publishTopics(runId);

    expect(result.topicsWritten).toBe(1);
    const topicSnap = await getDb().collection('topics').doc(chunkId).get();
    expect(topicSnap.data()).toEqual({
      title: 'Right of Way',
      description: 'desc',
      order: 12,
      approvedQuestionCount: 2,
    });
  });

  it('is idempotent when re-run', async () => {
    const chunkId = uniqueChunkId();
    const runId = await seedRun([{ ...baseChunk, chunkId }]);
    await seedQuestion(chunkId, 'approved');

    await publishTopics(runId);
    await seedQuestion(chunkId, 'approved');
    await publishTopics(runId);

    const topicSnap = await getDb().collection('topics').doc(chunkId).get();
    expect(topicSnap.data()?.approvedQuestionCount).toBe(2);
  });

  it('rejects an unknown runId', async () => {
    await expect(publishTopics('nonexistent-run')).rejects.toThrow('does not exist');
  });
});
