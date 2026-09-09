import { updateChunkStatus } from './lib/updateChunkStatus';
import { validateChunkStatusArg } from './lib/validate';

async function main() {
  const [, , runId, chunkId, status, ...rest] = process.argv;
  if (!runId || !chunkId || !status) {
    console.error(
      'Usage: update-chunk-status <runId> <chunkId> <pending|done|error> [--questionsGenerated N] [--error "message"]'
    );
    process.exit(1);
  }

  const validatedStatus = validateChunkStatusArg(status);

  const options: { questionsGenerated?: number; error?: string } = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (rest[i] === '--questionsGenerated') options.questionsGenerated = Number(rest[i + 1]);
    if (rest[i] === '--error') options.error = rest[i + 1];
  }

  if (options.questionsGenerated !== undefined && Number.isNaN(options.questionsGenerated)) {
    throw new Error('"--questionsGenerated" must be a valid number');
  }

  await updateChunkStatus(runId, chunkId, validatedStatus, options);
  console.log(`Updated ${chunkId} in ${runId} to ${validatedStatus}`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
