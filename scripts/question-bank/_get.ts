import { getDb } from './lib/adminApp';
(async () => { const db = getDb(); for (const id of process.argv.slice(2)) { const d = await db.collection('questions').doc(id).get(); const q: any = d.data(); console.log(JSON.stringify({id, conceptId: q.conceptId, sourceRef: q.sourceRef, type: q.type, text: q.text, choices: q.choices, correctAnswer: q.correctAnswer}, null, 1)); } })();
