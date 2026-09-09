import { randomUUID } from 'node:crypto';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDb } from './adminApp';
import { writeQuestions } from './writeQuestions';

function writeTempJson(data: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'question-bank-test-'));
  const filePath = join(dir, 'questions.json');
  writeFileSync(filePath, JSON.stringify(data));
  return filePath;
}

function uniqueConceptId(): string {
  return `concept-${randomUUID()}`;
}

describe('writeQuestions', () => {
  it('writes questions with status derived from selfCheck.passed', async () => {
    const conceptId = uniqueConceptId();
    const filePath = writeTempJson([
      {
        conceptId,
        chunkId: 'c1',
        sourceRef: 'p.5',
        type: 'fact',
        text: 'What color is a stop sign?',
        choices: ['Red', 'Yellow', 'Blue'],
        correctAnswer: 'Red',
        selfCheck: { passed: true, notes: '' },
      },
      {
        conceptId,
        chunkId: 'c1',
        sourceRef: 'p.5',
        type: 'scenario',
        text: "You're at an intersection with a red octagonal sign — what do you do?",
        choices: ['Stop completely', 'Slow down only', 'Proceed if clear'],
        correctAnswer: 'Stop completely',
        selfCheck: { passed: false, notes: 'distractor "Proceed if clear" is ambiguous' },
      },
    ]);

    const result = await writeQuestions(filePath);
    expect(result.written).toBe(2);

    const snap = await getDb().collection('questions').where('conceptId', '==', conceptId).get();
    const statuses = snap.docs.map((d) => d.data().status).sort();
    expect(statuses).toEqual(['flagged', 'pending_review']);

    const flagged = snap.docs.find((d) => d.data().status === 'flagged')?.data();
    expect(flagged?.reviewedBy).toBeNull();
    expect(flagged?.reviewedAt).toBeNull();
    expect(flagged?.reviewNotes).toBeNull();
    expect(flagged?.createdAt).toBeDefined();
  });

  it('rejects an invalid questions file without writing anything', async () => {
    const conceptId = uniqueConceptId();
    const filePath = writeTempJson([{ conceptId }]);

    await expect(writeQuestions(filePath)).rejects.toThrow();

    const snap = await getDb().collection('questions').where('conceptId', '==', conceptId).get();
    expect(snap.empty).toBe(true);
  });
});
