import { getDb } from './adminApp';

export interface ValidateBaselineResult {
  version: string;
  staleQuestionIds: string[];
}

/**
 * Reports baseline question IDs that are no longer `approved`. Flags only, never auto-swaps:
 * the baseline is a hand-picked set (ph-1-us-8 AC: "flagged for replacement").
 */
export async function validateBaseline(version: string): Promise<ValidateBaselineResult> {
  const db = getDb();
  const snap = await db.collection('baselineTests').doc(version).get();
  if (!snap.exists) {
    throw new Error(`baselineTests/${version} does not exist`);
  }

  const data = snap.data()!;
  const questionIds: string[] = data.sections.flatMap((s: { questionIds: string[] }) => s.questionIds);

  const staleQuestionIds: string[] = [];
  for (const id of questionIds) {
    const questionSnap = await db.collection('questions').doc(id).get();
    const status = questionSnap.exists ? questionSnap.data()!.status : 'missing';
    if (status !== 'approved') {
      staleQuestionIds.push(id);
    }
  }

  return { version, staleQuestionIds };
}
