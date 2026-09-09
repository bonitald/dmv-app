import type { FieldValue } from 'firebase-admin/firestore';

export type ChunkStatus = 'pending' | 'done' | 'error';

export interface ChunkPlanChunkInput {
  chunkId: string;
  title: string;
  description: string;
  pageStart: number;
  pageEnd: number;
}

export interface ChunkPlanInput {
  sourceDoc: string;
  chunks: ChunkPlanChunkInput[];
}

export interface ChunkRecord {
  chunkId: string;
  title: string;
  description: string;
  pageStart: number;
  pageEnd: number;
  status: ChunkStatus;
  questionsGenerated: number;
  error: string | null;
}

export type IngestionRunStatus = 'processing' | 'complete';

export interface IngestionRunRecord {
  sourceDoc: string;
  createdAt: FieldValue;
  status: IngestionRunStatus;
  chunks: ChunkRecord[];
}

export type QuestionType = 'fact' | 'scenario';
export type QuestionStatus = 'pending_review' | 'flagged' | 'approved' | 'rejected';

export interface QuestionSelfCheck {
  passed: boolean;
  notes?: string;
}

export interface QuestionInput {
  conceptId: string;
  chunkId: string;
  sourceRef: string;
  type: QuestionType;
  text: string;
  choices: string[];
  correctAnswer: string;
  selfCheck: QuestionSelfCheck;
}

export interface QuestionRecord extends QuestionInput {
  status: QuestionStatus;
  reviewedBy: null;
  reviewedAt: null;
  reviewNotes: null;
  createdAt: FieldValue;
}
