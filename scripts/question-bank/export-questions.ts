import { writeFileSync } from 'fs';
import { exportQuestions } from './lib/exportQuestions';

async function main() {
  const [, , chunkId, outPath] = process.argv;
  if (!chunkId || !outPath) {
    console.error('Usage: export-questions <chunkId> <out-path.json>');
    process.exit(1);
  }

  const questions = await exportQuestions(chunkId);
  writeFileSync(outPath, JSON.stringify(questions, null, 2));
  console.log(`Exported ${questions.length} question(s) for chunk "${chunkId}" to ${outPath}`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
