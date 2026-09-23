import { publishTopics } from './lib/publishTopics';

async function main() {
  const [, , runId] = process.argv;
  if (!runId) {
    console.error('Usage: publish-topics <runId>');
    process.exit(1);
  }

  const result = await publishTopics(runId);
  console.log(`Published ${result.topicsWritten} topic(s) from ${result.runId}`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
