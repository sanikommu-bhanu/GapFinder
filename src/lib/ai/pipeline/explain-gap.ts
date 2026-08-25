import { generateStructured } from "@/lib/ai/gemini-client";
import { ExplanationResult } from "@/lib/ai/schemas/pipeline";
import { retrieveKnowledge, type RetrievedChunk } from "@/lib/ai/rag/retrieve";

const SYSTEM = `You explain a student's learning gap warmly and precisely, for a
student audience. You MUST ground your explanation only in the provided
knowledge chunks and the student's actual steps — do not introduce facts not
present in either. Reference chunk IDs you actually used in groundedInChunkIds.
Keep whyThisIsAGap and whatChangedBetweenSteps each to 1-2 sentences. List 2-4
short correctReasoning steps showing the fixed reasoning.`;

export async function explainGap(params: {
  conceptId: string;
  surfaceError: string;
  underlyingGap: string;
  divergingStep: { statement: string; expression: string };
  previousStep: { statement: string; expression: string };
  analysisId?: string;
}): Promise<{ explanation: ExplanationResult; chunks: RetrievedChunk[]; cached: boolean }> {
  const chunks = await retrieveKnowledge(
    params.conceptId,
    `${params.underlyingGap} ${params.surfaceError}`,
    { kinds: ["explanation", "misconception", "teaching_strategy"], limit: 4 }
  );

  const { data, cached } = await generateStructured({
    stage: "explain_gap",
    analysisId: params.analysisId,
    retrievedChunkIds: chunks.map((c) => c.id),
    schema: ExplanationResult,
    systemInstruction: SYSTEM,
    prompt: JSON.stringify({
      surfaceError: params.surfaceError,
      underlyingGap: params.underlyingGap,
      previousStep: params.previousStep,
      divergingStep: params.divergingStep,
      knowledgeChunks: chunks.map((c) => ({ id: c.id, title: c.title, content: c.content })),
    }),
  });

  return { explanation: data, chunks, cached };
}
