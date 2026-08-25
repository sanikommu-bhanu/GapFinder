import type { ExplanationResult } from "@/lib/ai/schemas/pipeline";
import type { RetrievedChunk } from "@/lib/ai/rag/retrieve";
import { correctSolutionChain } from "@/lib/math/solve-step";

/**
 * Offline gap explanation, assembled from two sources that are both already
 * trustworthy: the retrieved knowledge chunks (human-curated) and the
 * deterministic verifier's own output (algebraic). Nothing here is generated
 * text pretending to be reasoning — the wording is fixed, and the *content*
 * comes from retrieval plus math.
 *
 * Used when Gemini is unavailable. Surfaces label it as "grounded, AI
 * offline" so a reader is never misled about what produced it.
 */
export function explainGapOffline(params: {
  conceptName: string;
  surfaceError: string;
  underlyingGap: string;
  previousExpression: string;
  divergingExpression: string;
  correctedExpression: string | null;
  chunks: RetrievedChunk[];
}): ExplanationResult {
  const misconception = params.chunks.find((c) => c.kind === "misconception");
  const explanation = params.chunks.find((c) => c.kind === "explanation");

  const whyThisIsAGap =
    misconception?.content ??
    explanation?.content ??
    `${params.underlyingGap} Until that is solid, the same slip will reappear in any problem that needs ${params.conceptName.toLowerCase()}.`;

  const whatChangedBetweenSteps = params.correctedExpression
    ? `Going from "${params.previousExpression}" you wrote "${params.divergingExpression}". Checked algebraically, that step should read "${params.correctedExpression}" — the two have different solutions, so this is where the reasoning first left the correct path.`
    : `Going from "${params.previousExpression}" to "${params.divergingExpression}", the solution set changed — the two equations are no longer equivalent, so this is the first step that cannot follow from the one before it.`;

  const chain = correctSolutionChain(params.previousExpression);

  return {
    whyThisIsAGap,
    whatChangedBetweenSteps,
    correctReasoning: chain ?? (params.correctedExpression ? [params.correctedExpression] : []),
    groundedInChunkIds: params.chunks.map((c) => c.id),
  };
}
