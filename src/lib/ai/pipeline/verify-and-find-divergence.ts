import { auditSolution, type StepVerdict } from "@/lib/verification/solution-audit";

export interface VerifiedStep {
  order: number;
  statement: string;
  expression: string;
  isValid: boolean;
  isFirstGap: boolean;
  verificationNote: string;
  /**
   * What this step should have read, derived algebraically from the previous
   * step. Null when the shape isn't recognised — in which case the UI shows
   * nothing rather than an unverified correction.
   */
  correctedExpression: string | null;
  /**
   * The complete-audit verdict for this step: whether it is correct, the first
   * divergence, a consequence carried from that divergence, a separate mistake,
   * or something we could not evaluate.
   */
  verdict: StepVerdict;
}

export interface VerificationResult {
  steps: VerifiedStep[];
  /** The full correct path, derived from the student's opening line. */
  correctedSolution: string[];
  correctFinalAnswer: string | null;
  independentErrorOrders: number[];
  downstreamCount: number;
}

/**
 * Runs the Complete Solution Audit over the reconstructed steps and adapts it
 * to the shape the pipeline persists.
 *
 * The audit is what distinguishes a root misconception from the errors it
 * causes: `isValid` still means "this line follows from the one above it", but
 * `verdict` carries the richer judgement the UI needs to show one red step and
 * a chain of amber ones rather than four equal-looking failures.
 */
export function verifyAndFindDivergenceDetailed(
  steps: { order: number; statement: string; expression: string }[]
): VerificationResult {
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  const audit = auditSolution(sorted.map((s) => ({ order: s.order, expression: s.expression })));
  const statementByOrder = new Map(sorted.map((s) => [s.order, s.statement]));

  return {
    steps: audit.steps.map((s) => ({
      order: s.order,
      statement: statementByOrder.get(s.order) ?? s.expression,
      expression: s.expression,
      isValid: s.verdict === "correct" || s.verdict === "downstream_consequence",
      isFirstGap: s.isFirstGap,
      verificationNote: s.note,
      correctedExpression: s.correctedExpression,
      verdict: s.verdict,
    })),
    correctedSolution: audit.correctedSolution,
    correctFinalAnswer: audit.correctFinalAnswer,
    independentErrorOrders: audit.independentErrorOrders,
    downstreamCount: audit.downstreamCount,
  };
}

/** Back-compatible entry point returning just the step list. */
export function verifyAndFindDivergence(
  steps: { order: number; statement: string; expression: string }[]
): VerifiedStep[] {
  return verifyAndFindDivergenceDetailed(steps).steps;
}
