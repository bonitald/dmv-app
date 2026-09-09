import { readChunkPlan } from './lib/readChunkPlan';

async function main() {
  const [, , runId] = process.argv;
  if (!runId) {
    console.error('Usage: read-chunk-plan <runId>');
    process.exit(1);
  }

  const record = await readChunkPlan(runId);
  console.log(JSON.stringify(record, null, 2));
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
