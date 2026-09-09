import { writeQuestions } from './lib/writeQuestions';

async function main() {
  const [, , jsonPath] = process.argv;
  if (!jsonPath) {
    console.error('Usage: write-questions <path-to-questions.json>');
    process.exit(1);
  }

  const { written } = await writeQuestions(jsonPath);
  console.log(`Wrote ${written} question(s)`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
