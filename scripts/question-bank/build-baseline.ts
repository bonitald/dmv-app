import { buildBaseline } from './lib/buildBaseline';

async function main() {
  const [, , version, selectionPath] = process.argv;
  if (!version || !selectionPath) {
    console.error('Usage: build-baseline <version> /path/to/baseline-selection.json');
    process.exit(1);
  }

  const result = await buildBaseline(version, selectionPath);
  const formatMix = (counts: Record<string, number>) =>
    Object.entries(counts)
      .map(([type, n]) => `${n} ${type}`)
      .join(', ');
  console.log(
    `Wrote baselineTests/${result.version}: ${result.sectionsWritten} section(s), ${result.questionsWritten} question(s).`
  );
  console.log(`Mix: ${formatMix(result.typeCounts)}`);
  result.sectionTypeCounts.forEach((counts, i) => console.log(`  Section ${i + 1}: ${formatMix(counts)}`));
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
