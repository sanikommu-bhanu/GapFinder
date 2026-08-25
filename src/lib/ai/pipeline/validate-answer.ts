import { generateStructured } from "@/lib/ai/gemini-client";
import { hasGeminiKey } from "@/lib/env";
import { checkStudentWork } from "@/lib/verification/check-student-work";
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
  /** 1-based line of the first invalid step, when the checker found one. */
  firstErrorLine?: number | null;
  /** What that line should have read — derived algebraically, never generated. */
  correctedExpression?: string | null;
}

/**
 * Grades a student's practice work.
 *
 * The deterministic checker runs first and handles anything written as
 * equations: it verifies every step against the one before it (the same
 * first-divergence engine used on their homework) and then checks the final
 * answer. Only genuinely unparseable submissions — a word-problem answer in
 * prose, say — fall through to a single Gemini call.
 */
export async function validateAnswer(params: {
  studentAnswer: string;
  canonicalAnswer: string;
  /** The problem as posed, so the student's first move is checked too. */
  problemPrompt?: string;
  /** Links this call back to the originating analysis, for the AI Observability trace view. */
  analysisId?: string;
}): Promise<ValidationResult> {
  const check = checkStudentWork(params.studentAnswer, params.canonicalAnswer, params.problemPrompt);

  if (!check.unparseable) {
    return {
      isCorrect: check.isCorrect,
      verifiedBy: "deterministic",
      feedback: check.feedback,
      firstErrorLine: check.firstErrorLine,
      correctedExpression: check.correctedExpression,
    };
  }

  if (!hasGeminiKey()) {
    return {
      isCorrect: false,
      verifiedBy: "deterministic",
      feedback: check.feedback,
      firstErrorLine: null,
      correctedExpression: null,
    };
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
    // Cannot verify — say so rather than marking a student wrong on a guess.
    return {
      isCorrect: false,
      verifiedBy: "deterministic",
      feedback: "We couldn't automatically verify that answer — try writing your working as equations, one per line.",
      firstErrorLine: null,
      correctedExpression: null,
    };
  }
}
