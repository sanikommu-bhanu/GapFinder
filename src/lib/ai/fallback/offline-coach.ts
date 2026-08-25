import type { RetrievedChunk } from "@/lib/ai/rag/retrieve";

/**
 * Offline AI Coach reply.
 *
 * Rather than fabricate an answer when Gemini is unreachable, the coach reads
 * back what the retrieval layer actually found for the student's question, plus
 * what their own learning memory says. Every sentence is either a curated
 * knowledge chunk or a fact from the student's record — so the reply is
 * genuinely grounded even with no model in the loop, and it says plainly that
 * live AI is offline instead of pretending otherwise.
 */
export function coachReplyOffline(params: {
  question: string;
  chunks: RetrievedChunk[];
  focusConceptName?: string;
  recurringGapCount?: number;
}): { reply: string; groundedInChunkIds: string[]; suggestedFollowUp: string | null; offline: true } {
  if (params.chunks.length === 0) {
    return {
      reply:
        "Live AI is offline right now, so I can only answer from your curated knowledge base — and I don't have a note that covers that question yet. Try asking about a concept from your gaps list, like inverse operations or sign handling.",
      groundedInChunkIds: [],
      suggestedFollowUp: "Why do I keep making sign errors?",
      offline: true,
    };
  }

  const primary = params.chunks[0]!;
  const supporting = params.chunks[1];

  const memoryLine =
    params.focusConceptName && params.recurringGapCount && params.recurringGapCount > 1
      ? ` Your record shows ${params.conceptRepeatPhrase ?? `this has come up ${params.recurringGapCount} times in ${params.focusConceptName.toLowerCase()}`}, which is why it's worth slowing down on.`
      : "";

  return {
    reply: `${primary.content}${supporting ? ` ${supporting.content}` : ""}${memoryLine}`,
    groundedInChunkIds: params.chunks.map((c) => c.id),
    suggestedFollowUp: supporting ? `Can you show me an example of ${primary.title.toLowerCase()}?` : null,
    offline: true,
  };
}
