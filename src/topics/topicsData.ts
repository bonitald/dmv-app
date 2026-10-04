// ph-1-us-9 topics as the app sees them: title, summary, handbook order and how many approved
// questions each has, per chunkId. No Firebase imports, so it runs under plain-Node Jest.

export interface Topic {
  chunkId: string;
  title: string;
  /** One-line summary for the concept list (ph-2-us-7). Empty when missing. */
  description: string;
  /** Handbook page the topic starts on; sorts topics in handbook order. */
  order: number;
  /** Approved questions in the topic. 0 shows as "coming soon" (ph-2-us-7). */
  approvedQuestionCount: number;
}

export function toTopics(docs: { id: string; data: Record<string, unknown> }[]): Topic[] {
  return docs
    .map(({ id, data }) => ({
      chunkId: id,
      title: typeof data.title === 'string' && data.title.trim() !== '' ? data.title : id,
      description: typeof data.description === 'string' ? data.description : '',
      order: typeof data.order === 'number' ? data.order : Number.MAX_SAFE_INTEGER,
      // publish-topics always writes this; a doc without it is treated as having nothing yet.
      approvedQuestionCount:
        typeof data.approvedQuestionCount === 'number' ? data.approvedQuestionCount : 0,
    }))
    .sort((a, b) => a.order - b.order);
}
