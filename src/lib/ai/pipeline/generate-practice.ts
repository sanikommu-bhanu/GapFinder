import { generateStructured } from "@/lib/ai/gemini-client";
import { PracticeGenerationResult } from "@/lib/ai/schemas/pipeline";
import type { Difficulty } from "./select-intervention";

const REPAIR_SYSTEM = `Generate ONE practice problem that isolates the exact
skill the student just got wrong, at the requested difficulty.

Requirements:
- "prompt" must be a single solvable equation and nothing else — no framing
  words, no "Solve for x:" prefix. Example: "3x + 8 = 26".
- Use exactly one variable, and keep it linear.
- "correctAnswer" must be that equation's exact solution written as
  "<variable> = <value>", e.g. "x = 6". Solve it yourself and double-check.
- Choose numbers whose solution is a whole number.
- Do not repeat any problem listed in avoidPrompts.`;

const TRANSFER_SYSTEM = `Generate ONE "transfer" problem: the SAME underlying
concept in a visibly different surface form, so solving it means understanding
rather than pattern-matching.

Vary the surface — a different variable letter, the constant written before the
variable term, or the sides swapped. Keep the underlying reasoning identical.

Requirements:
- "prompt" must be a single solvable equation and nothing else — no framing
  words. Example: "9 + 4n = 33".
- Use exactly one variable, and keep it linear.
- "correctAnswer" must be that equation's exact solution written as
  "<variable> = <value>", e.g. "n = 6". Solve it yourself and double-check.
- Choose numbers whose solution is a whole number.
- Do not repeat any problem listed in avoidPrompts.`;

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
      // Nudges variety across calls without spending a second request on it.
      nonce: Math.random().toString(36).slice(2, 8),
    }),
    // Practice problems should vary across calls with the same concept, so we
    // skip the cache here — dedup/conservation instead comes from generating
    // one problem per gap rather than many.
    skipCache: true,
    analysisId: params.analysisId,
  });
  return { result: data, cached };
}
