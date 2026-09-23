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

async function seedQuestion(id: string, chunkId: string, status = 'approved', type = 'fact') {
  await getDb()
    .collection('questions')
    .doc(id)
    .set({
      conceptId: 'c1',
      chunkId,
      sourceRef: 'p.1',
      type,
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

  it('reports the fact/scenario mix overall and per section', async () => {
    const selection = buildSelection(45);
    for (const [chunkId, questionId] of Object.entries(selection)) {
      const order = Number(chunkId.split('-')[1]);
      await seedTopic(chunkId, order);
      // Every third topic gets a scenario question: 5 per section of 15.
      await seedQuestion(questionId, chunkId, 'approved', order % 3 === 0 ? 'scenario' : 'fact');
    }
    const filePath = writeTempSelection(selection);

    const result = await buildBaseline('v1', filePath);

    expect(result.typeCounts).toEqual({ fact: 30, scenario: 15 });
    expect(result.sectionTypeCounts).toEqual([
      { fact: 10, scenario: 5 },
      { fact: 10, scenario: 5 },
      { fact: 10, scenario: 5 },
    ]);
  });
});
