import { getDb } from './adminApp';
import { validateBaseline } from './validateBaseline';

async function seedQuestion(id: string, status = 'approved') {
  await getDb()
    .collection('questions')
    .doc(id)
    .set({
      conceptId: 'c1',
      chunkId: 'validate-baseline-test',
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

// IDs are distinct from buildBaseline.test.ts's (which writes baselineTests/v1), since test
// files run in parallel against one emulator.
describe('validateBaseline', () => {
  it('returns no stale questions when every baseline question is still approved', async () => {
    await seedQuestion('vb-approved-q1', 'approved');
    await getDb()
      .collection('baselineTests')
      .doc('vb-all-approved')
      .set({ sections: [{ section: 1, questionIds: ['vb-approved-q1'] }], createdAt: new Date() });

    const result = await validateBaseline('vb-all-approved');
    expect(result.staleQuestionIds).toEqual([]);
  });

  it('flags a baseline question that is no longer approved', async () => {
    await seedQuestion('vb-rejected-q1', 'rejected');
    await getDb()
      .collection('baselineTests')
      .doc('vb-has-stale')
      .set({ sections: [{ section: 1, questionIds: ['vb-rejected-q1'] }], createdAt: new Date() });

    const result = await validateBaseline('vb-has-stale');
    expect(result.staleQuestionIds).toEqual(['vb-rejected-q1']);
  });

  it('rejects an unknown version', async () => {
    await expect(validateBaseline('nonexistent')).rejects.toThrow('does not exist');
  });
});
