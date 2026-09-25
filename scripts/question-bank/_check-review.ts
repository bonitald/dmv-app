// Temporary orchestrator helper (not committed): validates an agent's review file against its
// export before it is applied to Firestore.
import { readFileSync } from 'fs';

const [, , exportPath, reviewPath] = process.argv;
const exported = JSON.parse(readFileSync(exportPath, 'utf8')) as any[];
const reviews = JSON.parse(readFileSync(reviewPath, 'utf8')) as any[];
const errors: string[] = [];
const byId = new Map(exported.map((q) => [q.id, q]));
const seen = new Set<string>();
const counts: Record<string, number> = {};

for (const r of reviews) {
  const q = byId.get(r.id);
  if (!q) { errors.push(`${r.id}: not in export`); continue; }
  if (seen.has(r.id)) errors.push(`${r.id}: duplicate`);
  seen.add(r.id);
  if (!['approved', 'flagged'].includes(r.verdict)) errors.push(`${r.id}: bad verdict ${r.verdict}`);
  if (r.reviewedBy !== 'claude-agent-review-pilot') errors.push(`${r.id}: bad reviewedBy`);
  if (!r.reviewNotes) errors.push(`${r.id}: missing reviewNotes`);
  const choices: string[] = r.choices ?? q.choices;
  const answer: string = r.correctAnswer ?? q.correctAnswer;
  if (choices.length !== 4) errors.push(`${r.id}: ${choices.length} choices`);
  if (new Set(choices).size !== choices.length) errors.push(`${r.id}: duplicate choices`);
  if (!choices.includes(answer)) errors.push(`${r.id}: correctAnswer not in choices`);
  if (r.choices && q.choices.indexOf(q.correctAnswer) !== choices.indexOf(answer)) {
    errors.push(`${r.id}: correct answer moved position`);
  }
  if (r.sourceRef && !/^p\.\d+(-\d+)?$/.test(r.sourceRef)) errors.push(`${r.id}: bad sourceRef ${r.sourceRef}`);
  if (r.verdict === 'flagged' && (r.text || r.choices || r.correctAnswer)) {
    errors.push(`${r.id}: flagged question has content edits`);
  }
  const kind = r.verdict === 'flagged' ? 'flagged' : r.text || r.choices || r.correctAnswer ? 'edited' : 'as-is';
  counts[kind] = (counts[kind] ?? 0) + 1;
  if (r.sourceRef && r.sourceRef !== q.sourceRef) counts.sourceRefFixed = (counts.sourceRefFixed ?? 0) + 1;
}
for (const q of exported) if (!seen.has(q.id)) errors.push(`${q.id}: missing from review`);

console.log(JSON.stringify({ exported: exported.length, reviewed: reviews.length, ...counts }));
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('OK');
