import type { ChunkPlanInput, QuestionInput } from './types';

export function validateChunkPlan(data: unknown): ChunkPlanInput {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Chunk plan must be a JSON object');
  }
  const { sourceDoc, chunks } = data as Record<string, unknown>;

  if (typeof sourceDoc !== 'string' || sourceDoc.trim() === '') {
    throw new Error('Chunk plan "sourceDoc" must be a non-empty string');
  }
  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error('Chunk plan "chunks" must be a non-empty array');
  }

  const seenIds = new Set<string>();
  chunks.forEach((chunk, index) => {
    if (typeof chunk !== 'object' || chunk === null) {
      throw new Error(`Chunk at index ${index} must be an object`);
    }
    const { chunkId, title, description, pageStart, pageEnd } = chunk as Record<string, unknown>;

    if (typeof chunkId !== 'string' || chunkId.trim() === '') {
      throw new Error(`Chunk at index ${index} is missing a valid "chunkId"`);
    }
    if (seenIds.has(chunkId)) {
      throw new Error(`Duplicate chunkId "${chunkId}" in chunk plan`);
    }
    seenIds.add(chunkId);

    if (typeof title !== 'string' || title.trim() === '') {
      throw new Error(`Chunk "${chunkId}" is missing a valid "title"`);
    }
    if (typeof description !== 'string' || description.trim() === '') {
      throw new Error(`Chunk "${chunkId}" is missing a valid "description"`);
    }
    if (
      typeof pageStart !== 'number' ||
      typeof pageEnd !== 'number' ||
      pageStart < 1 ||
      pageEnd < pageStart
    ) {
      throw new Error(`Chunk "${chunkId}" has an invalid page range (${pageStart}-${pageEnd})`);
    }
  });

  return data as ChunkPlanInput;
}

export function validateQuestions(data: unknown): QuestionInput[] {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Questions payload must be a non-empty array');
  }

  const validTypes = new Set(['fact', 'scenario']);

  data.forEach((question, index) => {
    if (typeof question !== 'object' || question === null) {
      throw new Error(`Question at index ${index} must be an object`);
    }
    const q = question as Record<string, unknown>;

    for (const field of ['conceptId', 'chunkId', 'sourceRef', 'text', 'correctAnswer']) {
      if (typeof q[field] !== 'string' || (q[field] as string).trim() === '') {
        throw new Error(`Question at index ${index} is missing a valid "${field}"`);
      }
    }

    if (!validTypes.has(q.type as string)) {
      throw new Error(`Question at index ${index} has invalid "type": ${String(q.type)}`);
    }

    if (
      !Array.isArray(q.choices) ||
      q.choices.length < 2 ||
      !q.choices.every((c) => typeof c === 'string')
    ) {
      throw new Error(`Question at index ${index} must have at least 2 string "choices"`);
    }

    if (!(q.choices as string[]).includes(q.correctAnswer as string)) {
      throw new Error(`Question at index ${index}'s "correctAnswer" is not present in its "choices"`);
    }

    const selfCheck = q.selfCheck as Record<string, unknown> | undefined;
    if (typeof selfCheck !== 'object' || selfCheck === null || typeof selfCheck.passed !== 'boolean') {
      throw new Error(`Question at index ${index} is missing a valid "selfCheck.passed" boolean`);
    }
    if (
      selfCheck.passed === false &&
      (typeof selfCheck.notes !== 'string' || selfCheck.notes.trim() === '')
    ) {
      throw new Error(`Question at index ${index} failed selfCheck but has no "selfCheck.notes"`);
    }
  });

  return data as QuestionInput[];
}
