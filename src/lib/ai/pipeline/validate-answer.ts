import { verifyFinalAnswer } from "@/lib/verification/math-verifier";
import { generateStructured } from "@/lib/ai/gemini-client";
import { z } from "zod";

const AiAssistedCheck = z.object({
  isCorrect: z.boolean(),
  feedback: z.string(),
});

const SYSTEM = `You check whether a student's free-text answer is mathematically
or conceptually equivalent to the canonical answer. Be strict about
correctness but lenient about phrasing/formatting. Give brief, specific
feedback (1-2 sentences) either confirming why it's right or pointing to
exactly where it diverges.`;

export interface ValidationResult {
  isCorrect: boolean;
  verifiedBy: "deterministic" | "ai_assisted";
  feedback: string;
}

/**
 * Deterministic verification is attempted first (fast, free, reliable for
 * symbolic/numeric answers). Only when the deterministic parser cannot
 * confidently evaluate the student's answer (e.g. it's a word-problem style
 * free-text response) do we fall back to a single Gemini call.
 */
export async function validateAnswer(params: {
  studentAnswer: string;
  canonicalAnswer: string;
  /** Links this call back to the originating analysis, for the AI Observability trace view. */
  analysisId?: string;
}): Promise<ValidationResult> {
  const deterministic = verifyFinalAnswer(params.studentAnswer, params.canonicalAnswer);
  const deterministicallyParseable = !deterministic.note.startsWith("Could not parse");

  if (deterministicallyParseable) {
    return { isCorrect: deterministic.isValid, verifiedBy: "deterministic", feedback: deterministic.note };
  }

  try {
    const { data } = await generateStructured({
      stage: "validate_answer_ai_assisted",
      schema: AiAssistedCheck,
      systemInstruction: SYSTEM,
      prompt: JSON.stringify({ studentAnswer: params.studentAnswer, canonicalAnswer: params.canonicalAnswer }),
      analysisId: params.analysisId,
    });
    return { isCorrect: data.isCorrect, verifiedBy: "ai_assisted", feedback: data.feedback };
  } catch {
    // Total fallback: cannot verify, mark for manual/ungated review rather than
    // silently failing the student.
    return {
      isCorrect: false,
      verifiedBy: "deterministic",
      feedback: "Couldn't automatically verify this answer — try restating it more precisely.",
    };
  }
}
