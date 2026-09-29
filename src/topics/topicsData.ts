// ph-1-us-9 topics as the app sees them: title and handbook order per chunkId. No Firebase
// imports, so it runs under plain-Node Jest.

export interface Topic {
  chunkId: string;
  title: string;
  /** Handbook page the topic starts on; sorts topics in handbook order. */
  order: number;
}

export function toTopics(docs: { id: string; data: Record<string, unknown> }[]): Topic[] {
  return docs
    .map(({ id, data }) => ({
      chunkId: id,
      title: typeof data.title === 'string' && data.title.trim() !== '' ? data.title : id,
      order: typeof data.order === 'number' ? data.order : Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => a.order - b.order);
}
