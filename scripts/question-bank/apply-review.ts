import { readJsonFile } from './lib/readJsonFile';
import { applyReviews, type ReviewResult } from './lib/applyReviews';

async function main() {
  const [, , jsonPath] = process.argv;
  if (!jsonPath) {
    console.error('Usage: apply-review <path-to-review-results.json>');
    process.exit(1);
  }

  const results = readJsonFile(jsonPath) as ReviewResult[];
  const { updated } = await applyReviews(results);
  console.log(`Applied review verdicts to ${updated} question(s)`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
