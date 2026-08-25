import { generateStructured } from "@/lib/ai/gemini-client";
import { PracticeGenerationResult } from "@/lib/ai/schemas/pipeline";
import type { Difficulty } from "./select-intervention";

const REPAIR_SYSTEM = `Generate ONE practice problem that isolates the exact
skill the student just got wrong, at the requested difficulty. Provide a
canonical correctAnswer in a form that can be checked deterministically
(e.g. "x = 4" for an equation). Keep the problem concise.`;

const TRANSFER_SYSTEM = `Generate ONE "transfer" problem that requires the SAME
underlying concept applied in a visibly different surface form or context than
the original problem (e.g. different variable names, a word problem instead of
symbolic, or a rearranged structure), so success indicates real understanding
rather than pattern-matching. Provide a canonical correctAnswer that can be
checked deterministically.`;

export async function generatePracticeProblem(params: {
  conceptName: string;
  conceptDescription: string;
  difficulty: Difficulty;
  mode: "repair" | "transfer";
  avoidPrompts?: string[];
  /** Links this call back to the originating analysis, for the AI Observability trace view. */
  analysisId?: string;
}) {
  const { data, cached } = await generateStructured({
    stage: params.mode === "transfer" ? "generate_transfer" : "generate_practice",
    schema: PracticeGenerationResult,
    systemInstruction: params.mode === "transfer" ? TRANSFER_SYSTEM : REPAIR_SYSTEM,
    prompt: JSON.stringify({
      concept: params.conceptName,
      description: params.conceptDescription,
      difficulty: params.difficulty,
      avoidPrompts: params.avoidPrompts ?? [],
    }),
    // Practice problems should vary across calls with the same concept, so we
    // skip the cache here — dedup/conservation instead comes from generating
    // one problem per gap rather than many.
    skipCache: true,
    analysisId: params.analysisId,
  });
  return { result: data, cached };
}
