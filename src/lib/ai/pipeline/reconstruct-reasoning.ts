import { generateStructured } from "@/lib/ai/gemini-client";
import { ReasoningReconstructionResult } from "@/lib/ai/schemas/pipeline";

const SYSTEM = `You reconstruct the STUDENT'S reasoning from extracted math/science
steps — not the "correct" path, the path they actually appear to be taking.
For each step produce a short natural-language statement of what the student
seems to be doing (e.g. "Subtracting 7 from both sides") plus the clean
expression for that step. Stay faithful to what's on the page; do not silently
correct errors here — correction happens in a later stage.`;

export async function reconstructReasoning(params: {
  subject: string;
  steps: { order: number; interpreted: string }[];
  analysisId?: string;
}) {
  const { data, cached } = await generateStructured({
    stage: "reconstruct_reasoning",
    analysisId: params.analysisId,
    schema: ReasoningReconstructionResult,
    systemInstruction: SYSTEM,
    prompt: JSON.stringify({ subject: params.subject, steps: params.steps }),
  });
  return { result: data, cached };
}
