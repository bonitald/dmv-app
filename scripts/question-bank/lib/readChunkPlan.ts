import { getDb } from './adminApp';
import type { IngestionRunRecord } from './types';

export async function readChunkPlan(runId: string): Promise<IngestionRunRecord> {
  const snap = await getDb().collection('ingestionRuns').doc(runId).get();

  if (!snap.exists) {
    throw new Error(`ingestionRuns/${runId} does not exist`);
  }

  return snap.data() as IngestionRunRecord;
}
