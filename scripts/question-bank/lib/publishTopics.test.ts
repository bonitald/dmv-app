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

describe('publishTopics', () => {
  beforeEach(async () => {
    const snap = await getDb().collection('questions').get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  });

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
    const runId = await seedRun([{ ...baseChunk, chunkId: 'row' }]);
    await seedQuestion('row', 'approved');
    await seedQuestion('row', 'approved');
    await seedQuestion('row', 'pending_review');

    const result = await publishTopics(runId);

    expect(result.topicsWritten).toBe(1);
    const topicSnap = await getDb().collection('topics').doc('row').get();
    expect(topicSnap.data()).toEqual({
      title: 'Right of Way',
      description: 'desc',
      order: 12,
      approvedQuestionCount: 2,
    });
  });

  it('is idempotent when re-run', async () => {
    const runId = await seedRun([{ ...baseChunk, chunkId: 'row' }]);
    await seedQuestion('row', 'approved');

    await publishTopics(runId);
    await seedQuestion('row', 'approved');
    await publishTopics(runId);

    const topicSnap = await getDb().collection('topics').doc('row').get();
    expect(topicSnap.data()?.approvedQuestionCount).toBe(2);
  });

  it('rejects an unknown runId', async () => {
    await expect(publishTopics('nonexistent-run')).rejects.toThrow('does not exist');
  });
});
