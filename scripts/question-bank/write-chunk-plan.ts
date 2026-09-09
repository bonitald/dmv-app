import { writeChunkPlan } from './lib/writeChunkPlan';

async function main() {
  const [, , jsonPath] = process.argv;
  if (!jsonPath) {
    console.error('Usage: write-chunk-plan <path-to-chunk-plan.json>');
    process.exit(1);
  }

  const runId = await writeChunkPlan(jsonPath);
  console.log(runId);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
