import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDb } from './adminApp';
import { buildBaseline } from './buildBaseline';

function writeTempSelection(selection: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'baseline-test-'));
  const filePath = join(dir, 'selection.json');
  writeFileSync(filePath, JSON.stringify(selection));
  return filePath;
}

async function seedTopic(chunkId: string, order: number) {
  await getDb().collection('topics').doc(chunkId).set({
    title: chunkId,
    description: 'd',
    order,
    approvedQuestionCount: 1,
  });
}

async function seedQuestion(id: string, chunkId: string, status = 'approved') {
  await getDb()
    .collection('questions')
    .doc(id)
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

function buildSelection(n: number): Record<string, string> {
  const selection: Record<string, string> = {};
  for (let i = 0; i < n; i++) selection[`topic-${i}`] = `q-${i}`;
  return selection;
}

describe('buildBaseline', () => {
  it('rejects a selection that is not exactly 45 topics', async () => {
    const filePath = writeTempSelection({ 'topic-0': 'q-0' });
    await expect(buildBaseline('v1', filePath)).rejects.toThrow('Expected exactly 45');
  });

  it('rejects a question that is not approved', async () => {
    const selection = buildSelection(45);
    for (const [chunkId, questionId] of Object.entries(selection)) {
      await seedTopic(chunkId, Number(chunkId.split('-')[1]));
      await seedQuestion(questionId, chunkId, chunkId === 'topic-0' ? 'pending_review' : 'approved');
    }
    const filePath = writeTempSelection(selection);

    await expect(buildBaseline('v1', filePath)).rejects.toThrow('not approved');
  });

  it('builds 3 sections of 15 in topic order and writes baselineTests/{version}', async () => {
    const selection = buildSelection(45);
    for (const [chunkId, questionId] of Object.entries(selection)) {
      const order = Number(chunkId.split('-')[1]);
      await seedTopic(chunkId, order);
      await seedQuestion(questionId, chunkId);
    }
    const filePath = writeTempSelection(selection);

    const result = await buildBaseline('v1', filePath);

    expect(result.sectionsWritten).toBe(3);
    expect(result.questionsWritten).toBe(45);

    const snap = await getDb().collection('baselineTests').doc('v1').get();
    const data = snap.data()!;
    expect(data.sections).toHaveLength(3);
    expect(data.sections[0].questionIds).toHaveLength(15);
    expect(data.sections[0].questionIds[0]).toBe('q-0');
    expect(data.sections[2].questionIds[14]).toBe('q-44');
  });
});
