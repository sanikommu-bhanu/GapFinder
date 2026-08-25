import { generateStructured } from "@/lib/ai/ai-client";
import { GapClassificationResult } from "@/lib/ai/schemas/pipeline";

const SYSTEM = `You classify a student's math/science error at its point of first
divergence. Identify: (1) the surface error — literally what they wrote wrong,
(2) the underlying conceptual gap — the misunderstanding that caused it, (3)
which known concept slug from the provided list it maps to, (4) evidence:
specific step numbers and notes that support your diagnosis, (5) your
confidence. Only choose a conceptSlug from the provided list. Ground every
claim in the actual steps provided — do not speculate beyond the evidence.`;

export async function classifyGap(params: {
  subject: string;
  steps: VerifiedStepInput[];
  divergenceStepOrder: number;
  availableConceptSlugs: string[];
  analysisId?: string;
}) {
  const { data, cached } = await generateStructured({
    stage: "classify_gap",
    analysisId: params.analysisId,
    schema: GapClassificationResult,
    systemInstruction: SYSTEM,
    prompt: JSON.stringify({
      subject: params.subject,
      steps: params.steps,
      divergenceStepOrder: params.divergenceStepOrder,
      availableConceptSlugs: params.availableConceptSlugs,
    }),
  });
  return { result: data, cached };
}

interface VerifiedStepInput {
  order: number;
  statement: string;
  expression: string;
  isValid: boolean;
}
