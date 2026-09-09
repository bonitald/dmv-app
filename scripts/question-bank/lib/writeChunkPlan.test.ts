import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDb } from './adminApp';
import { writeChunkPlan } from './writeChunkPlan';

function writeTempJson(data: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'question-bank-test-'));
  const filePath = join(dir, 'plan.json');
  writeFileSync(filePath, JSON.stringify(data));
  return filePath;
}

describe('writeChunkPlan', () => {
  it('writes an ingestionRuns doc with all chunks pending', async () => {
    const filePath = writeTempJson({
      sourceDoc: 'DR_2337_Jan2025.pdf',
      chunks: [
        { chunkId: 'c1', title: 'Right of Way', description: 'desc', pageStart: 5, pageEnd: 6 },
        { chunkId: 'c2', title: 'Speed Limits', description: 'desc 2', pageStart: 7, pageEnd: 7 },
      ],
    });

    const runId = await writeChunkPlan(filePath);

    const snap = await getDb().collection('ingestionRuns').doc(runId).get();
    const data = snap.data();

    expect(data?.sourceDoc).toBe('DR_2337_Jan2025.pdf');
    expect(data?.status).toBe('processing');
    expect(data?.chunks).toEqual([
      {
        chunkId: 'c1',
        title: 'Right of Way',
        description: 'desc',
        pageStart: 5,
        pageEnd: 6,
        status: 'pending',
        questionsGenerated: 0,
        error: null,
      },
      {
        chunkId: 'c2',
        title: 'Speed Limits',
        description: 'desc 2',
        pageStart: 7,
        pageEnd: 7,
        status: 'pending',
        questionsGenerated: 0,
        error: null,
      },
    ]);
  });

  it('rejects an invalid plan file without writing anything', async () => {
    const filePath = writeTempJson({ sourceDoc: 'x.pdf', chunks: [] });

    await expect(writeChunkPlan(filePath)).rejects.toThrow('non-empty array');
  });
});
