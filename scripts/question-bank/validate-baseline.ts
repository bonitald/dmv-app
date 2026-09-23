import { validateBaseline } from './lib/validateBaseline';

async function main() {
  const [, , version] = process.argv;
  if (!version) {
    console.error('Usage: validate-baseline <version>');
    process.exit(1);
  }

  const result = await validateBaseline(version);
  if (result.staleQuestionIds.length === 0) {
    console.log(`baselineTests/${result.version}: all questions still approved.`);
  } else {
    console.error(
      `baselineTests/${result.version}: ${result.staleQuestionIds.length} stale question(s) need replacement: ${result.staleQuestionIds.join(', ')}`
    );
    process.exit(1);
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
