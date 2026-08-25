import { z } from "zod";

export const ConfidenceLevel = z.enum(["high", "medium", "low"]);

// Reasoning reconstruction — restates each step as a reasoning claim.
// Only used on the typed-input path now; the photo path gets narration from
// the single combined call in analyze-work.ts.
// (Validity itself is computed deterministically afterward, not by the model.)
export const ReasoningReconstructionResult = z.object({
  reasoningSteps: z.array(
    z.object({
      order: z.number().int(),
      statement: z.string(),
      expression: z.string(),
    })
  ),
});
export type ReasoningReconstructionResult = z.infer<typeof ReasoningReconstructionResult>;

// Stage 6+7: Gap classification + evidence generation (combined).
export const GapClassificationResult = z.object({
  conceptSlug: z.string(),
  classification: z.string(),
  surfaceError: z.string(),
  underlyingGap: z.string(),
  evidence: z.array(z.object({ stepOrder: z.number().int(), note: z.string() })),
  confidence: ConfidenceLevel,
});
export type GapClassificationResult = z.infer<typeof GapClassificationResult>;

// Stage 9: Explanation generation (RAG-grounded — retrieved chunks are passed
// into the prompt and the model must ground its explanation in them).
export const ExplanationResult = z.object({
  whyThisIsAGap: z.string(),
  whatChangedBetweenSteps: z.string(),
  correctReasoning: z.array(z.string()),
  groundedInChunkIds: z.array(z.string()),
});
export type ExplanationResult = z.infer<typeof ExplanationResult>;

// Stage 11: Practice generation
export const PracticeGenerationResult = z.object({
  prompt: z.string(),
  correctAnswer: z.string(),
  difficulty: z.enum(["warmup", "repair", "challenge", "transfer", "mastery"]),
});
export type PracticeGenerationResult = z.infer<typeof PracticeGenerationResult>;

// Stage 13: Transfer generation (same shape, different framing requirement)
export const TransferGenerationResult = PracticeGenerationResult;
export type TransferGenerationResult = z.infer<typeof TransferGenerationResult>;

// Stage 15: Teach-back evaluation against a rubric
export const TeachBackEvalResult = z.object({
  rubricScore: z.number().int().min(0).max(100),
  criteriaMet: z.array(z.object({ criterion: z.string(), met: z.boolean(), note: z.string() })),
  feedback: z.string(),
});
export type TeachBackEvalResult = z.infer<typeof TeachBackEvalResult>;

// Stage 17: Next-best-step recommendation reasoning (grounded in memory/graph
// data passed into the prompt, not invented).
export const RecommendationResult = z.object({
  conceptSlug: z.string(),
  reason: z.string(),
  priority: z.number().int().min(0).max(100),
});
export type RecommendationResult = z.infer<typeof RecommendationResult>;

// AI Coach: free-form Q&A, still RAG-grounded and structured for citation display.
export const CoachReplyResult = z.object({
  reply: z.string(),
  groundedInChunkIds: z.array(z.string()),
  suggestedFollowUp: z.string().nullable(),
});
export type CoachReplyResult = z.infer<typeof CoachReplyResult>;
