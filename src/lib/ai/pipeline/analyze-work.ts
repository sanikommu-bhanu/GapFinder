import { z } from "zod";
import { generateStructured } from "@/lib/ai/ai-client";
import { ConfidenceLevel } from "@/lib/ai/schemas/pipeline";
import { codesForSubject } from "@/lib/diagnosis/misconceptions";

/**
 * One multimodal call that does the reading, the reconstruction and the
 * classification together.
 *
 * These used to be three sequential requests plus a fourth for the explanation.
 * That was four round-trips of latency and four charges against a free-tier
 * quota for a single photo — enough that a normal session could exhaust the
 * day's allowance. They were also artificially separated: the model needs the
 * same image and the same context for all three, so splitting them meant
 * re-establishing that context three times.
 *
 * Combining them is safe precisely because the model's answer is not trusted.
 * The divergence is still located by the deterministic verifier afterwards, the
 * correction is still derived algebraically, and the misconception code is
 * still proved from the algebra where a signature exists. The model reads and
 * narrates; the arithmetic decides. Fewer calls, same guarantees.
 */

export const WorkAnalysisResult = z.object({
  /** True when the page is a question with no working to diagnose. */
  isQuestionOnly: z.boolean(),
  overallConfidence: ConfidenceLevel,
  needsConfirmation: z.boolean(),
  confirmationQuestion: z.string().nullable(),
  steps: z.array(
    z.object({
      order: z.number().int(),
      /** As read from the page. */
      rawLine: z.string(),
      /** Normalised notation — never corrected, only tidied. */
      interpreted: z.string(),
      /** What the student appears to be doing at this step. */
      statement: z.string(),
      confidence: ConfidenceLevel,
      needsConfirm: z.boolean(),
    })
  ),
  /** Best guess at the concept, chosen from the slugs offered. */
  conceptSlug: z.string(),
  /** A code from the offered catalogue, or "UNCLASSIFIED". */
  misconceptionCode: z.string(),
  surfaceError: z.string(),
  underlyingGap: z.string(),
});
export type WorkAnalysisResult = z.infer<typeof WorkAnalysisResult>;

const SYSTEM = `You read a student's handwritten or typed work and describe it
faithfully. You do NOT decide whether they are right — that is checked
separately by an algebra engine, and your job is to report what is on the page.

Rules:
- Transcribe every line of working, in order. Never merge, drop or reorder.
- "interpreted" is the line in clean notation. NEVER correct a mistake there —
  a wrong line must stay wrong, or the diagnosis is meaningless.
- "statement" says what the student appears to be doing at that step.
- If a line is genuinely ambiguous, set needsConfirm on it and set
  needsConfirmation true with a specific confirmationQuestion. Prefer asking
  over guessing.
- If the page is only a question with no attempt at working, set
  isQuestionOnly true and return an empty steps array.
- Choose conceptSlug from the provided list only.
- Choose misconceptionCode from the provided catalogue only, or
  "UNCLASSIFIED" if none fits. Never invent a code.
- surfaceError describes what they literally did; underlyingGap describes the
  belief behind it. If there is no error, leave both as empty strings.`;

export async function analyzeWork(params: {
  imageBase64?: string;
  imageMimeType?: string;
  typedSteps?: string[];
  subject: string;
  availableConceptSlugs: string[];
  textContext?: string | null;
  analysisId?: string;
}) {
  const catalogue = codesForSubject(params.subject).map((m) => ({
    code: m.code,
    name: m.name,
    studentRule: m.studentRule,
  }));

  const prompt = JSON.stringify({
    subject: params.subject,
    availableConceptSlugs: params.availableConceptSlugs,
    misconceptionCatalogue: catalogue,
    studentContext: params.textContext ?? null,
    // When the student typed their working there is nothing to transcribe;
    // the model only narrates and classifies.
    typedSteps: params.typedSteps ?? null,
  });

  const { data, cached } = await generateStructured({
    stage: "analyze_work",
    analysisId: params.analysisId,
    schema: WorkAnalysisResult,
    systemInstruction: SYSTEM,
    imageBase64: params.imageBase64,
    imageMimeType: params.imageMimeType,
    useVisionModel: Boolean(params.imageBase64),
    prompt,
  });

  return { result: data, cached };
}
