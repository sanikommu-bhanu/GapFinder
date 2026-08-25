import { prisma } from "@/lib/db/prisma";

export interface RetrievedChunk {
  id: string;
  title: string;
  content: string;
  kind: string;
  score: number;
}

/**
 * Retrieves the most relevant curated knowledge chunks for a concept + query,
 * using local TF-IDF-style keyword scoring. This intentionally avoids a paid
 * vector database: the knowledge base is small and curated (per-concept
 * explanations, misconceptions, worked examples, teaching strategies), so
 * keyword overlap scoring is both sufficient and fully free/local.
 *
 * Every explanation/coach reply the AI pipeline produces must ground its
 * output in the chunk IDs returned here, so retrieval is traceable end to end.
 */
export async function retrieveKnowledge(
  conceptId: string,
  query: string,
  opts: { kinds?: string[]; limit?: number } = {}
): Promise<RetrievedChunk[]> {
  const chunks = await prisma.knowledgeChunk.findMany({
    where: {
      conceptId,
      ...(opts.kinds ? { kind: { in: opts.kinds } } : {}),
    },
  });
  if (chunks.length === 0) return [];

  const queryTerms = tokenize(query);
  const docFreq = new Map<string, number>();
  const docTerms = chunks.map((c) => {
    const terms = tokenize(`${c.title} ${c.content} ${JSON.parse(c.keywords).join(" ")}`);
    const unique = new Set(terms);
    unique.forEach((t) => docFreq.set(t, (docFreq.get(t) ?? 0) + 1));
    return terms;
  });

  const scored = chunks.map((chunk, i) => {
    const terms = docTerms[i]!;
    const termCounts = new Map<string, number>();
    terms.forEach((t) => termCounts.set(t, (termCounts.get(t) ?? 0) + 1));

    let score = 0;
    for (const qt of queryTerms) {
      const tf = termCounts.get(qt) ?? 0;
      if (tf === 0) continue;
      const df = docFreq.get(qt) ?? 1;
      const idf = Math.log((chunks.length + 1) / df) + 1;
      score += tf * idf;
    }
    return { id: chunk.id, title: chunk.title, content: chunk.content, kind: chunk.kind, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 4);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "your", "with", "this",
  "that", "was", "were", "from", "have", "has", "had", "why", "how", "what",
]);
