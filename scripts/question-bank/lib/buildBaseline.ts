import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from './adminApp';
import { readJsonFile } from './readJsonFile';

const SECTION_SIZE = 15;
const SECTION_COUNT = 3;
const EXPECTED_TOPIC_COUNT = SECTION_SIZE * SECTION_COUNT;

export interface BuildBaselineResult {
  version: string;
  sectionsWritten: number;
  questionsWritten: number;
}

/** chunkId -> the one approved questionId hand-picked for that topic's baseline slot. */
type BaselineSelectionInput = Record<string, string>;

export async function buildBaseline(
  version: string,
  selectionPath: string
): Promise<BuildBaselineResult> {
  const selection = readJsonFile(selectionPath) as BaselineSelectionInput;
  const db = getDb();

  const chunkIds = Object.keys(selection);
  if (chunkIds.length !== EXPECTED_TOPIC_COUNT) {
    throw new Error(
      `Expected exactly ${EXPECTED_TOPIC_COUNT} topics in the selection, got ${chunkIds.length}.`
    );
  }

  const ordered: { questionId: string; order: number }[] = [];
  for (const chunkId of chunkIds) {
    const questionId = selection[chunkId];

    const questionSnap = await db.collection('questions').doc(questionId).get();
    if (!questionSnap.exists) {
      throw new Error(`Question "${questionId}" (topic "${chunkId}") does not exist.`);
    }
    const question = questionSnap.data()!;
    if (question.status !== 'approved') {
      throw new Error(`Question "${questionId}" (topic "${chunkId}") is not approved.`);
    }
    if (question.chunkId !== chunkId) {
      throw new Error(
        `Question "${questionId}" belongs to chunkId "${question.chunkId}", not "${chunkId}".`
      );
    }

    const topicSnap = await db.collection('topics').doc(chunkId).get();
    if (!topicSnap.exists) {
      throw new Error(`Topic "${chunkId}" does not exist in the topics collection — run publish-topics first.`);
    }

    ordered.push({ questionId, order: topicSnap.data()!.order });
  }

  ordered.sort((a, b) => a.order - b.order);

  const sections = [];
  for (let i = 0; i < SECTION_COUNT; i++) {
    sections.push({
      section: i + 1,
      questionIds: ordered.slice(i * SECTION_SIZE, (i + 1) * SECTION_SIZE).map((q) => q.questionId),
    });
  }

  await db.collection('baselineTests').doc(version).set({
    sections,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { version, sectionsWritten: sections.length, questionsWritten: ordered.length };
}
