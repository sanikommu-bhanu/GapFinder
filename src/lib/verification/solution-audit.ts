import { verifyStep, type VerificationDomain } from "@/lib/verification/verify-step";
import { checkChemicalBalance, looksLikeChemicalEquation } from "@/lib/verification/domains/chemistry";
import { correctQuantitativeStep } from "@/lib/verification/domains/quantitative";
import { correctNextStep, correctSolutionChain, solveLinear } from "@/lib/math/solve-step";

/**
 * The Complete Solution Audit.
 *
 * Finding the first divergence is necessary but not sufficient. A student who
 * makes one wrong move and then reasons flawlessly from it has made ONE
 * mistake, not four — and telling them otherwise buries the thing they actually
 * need to fix under noise. Conversely, a student who makes a second, unrelated
 * slip later has two problems, and only naming the first would leave them
 * failing the next question for a reason nobody mentioned.
 *
 * So every step is classified against two references at once:
 *
 *   - the student's OWN previous line (does this follow from where they were?)
 *   - the CORRECT solution path (are they still on it?)
 *
 * A step that follows from their own previous line but has drifted from the
 * correct path is a downstream consequence — carried error, not new error. A
 * step that does not even follow from their own previous line is a fresh,
 * independent mistake.
 */

export type StepVerdict =
  | "correct"
  | "first_divergence"
  | "downstream_consequence"
  | "independent_error"
  | "uncertain";

export interface AuditedStep {
  order: number;
  expression: string;
  verdict: StepVerdict;
  /** Which verifier judged this step — surfaced so the claim is auditable. */
  domain: VerificationDomain;
  /** Why this verdict, in words a student can read. */
  note: string;
  /** What this line should have said, derived algebraically. Null when unknown. */
  correctedExpression: string | null;
  /** Kept for the existing pipeline: true only on the first divergence. */
  isFirstGap: boolean;
  /** True when the step follows from the student's own previous line. */
  followsFromPrevious: boolean;
}

export interface SolutionAudit {
  steps: AuditedStep[];
  /** The full correct path, derived from the student's opening line. */
  correctedSolution: string[];
  /** The answer the student should have reached, when it can be derived. */
  correctFinalAnswer: string | null;
  firstDivergenceOrder: number | null;
  independentErrorOrders: number[];
  downstreamCount: number;
  /** True when no step diverged at all. */
  isFullyCorrect: boolean;
}

/**
 * A step is "uncertain" rather than wrong when no verifier can evaluate it.
 * Marking unparseable work as an error would accuse students of mistakes they
 * did not make — the single worst failure this product could have.
 */
function isEvaluable(expression: string): boolean {
  return /[=→]|->/.test(expression);
}

export function auditSolution(
  steps: { order: number; expression: string }[]
): SolutionAudit {
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  const audited: AuditedStep[] = [];

  const opening = sorted[0]?.expression ?? "";
  const correctedSolution = correctSolutionChain(opening) ?? [];
  const trueSolution = solveLinear(opening);

  let firstDivergenceOrder: number | null = null;
  const independentErrorOrders: number[] = [];
  let downstreamCount = 0;

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]!;
    const previous = i > 0 ? sorted[i - 1]! : null;

    if (!isEvaluable(current.expression)) {
      audited.push({
        order: current.order,
        expression: current.expression,
        verdict: "uncertain",
        domain: "none",
        note: "We couldn't evaluate this line, so we're not judging it either way.",
        correctedExpression: null,
        isFirstGap: false,
        followsFromPrevious: false,
      });
      continue;
    }

    if (!previous) {
      audited.push({
        order: current.order,
        expression: current.expression,
        verdict: "correct",
        domain: "none",
        note: "The problem as given.",
        correctedExpression: null,
        isFirstGap: false,
        followsFromPrevious: true,
      });
      continue;
    }

    const verification = verifyStep(previous.expression, current.expression);

    // No verifier recognised this transition. Say so rather than guess.
    if (!verification) {
      audited.push({
        order: current.order,
        expression: current.expression,
        verdict: "uncertain",
        domain: "none",
        note: "We couldn't check this step against the one above it.",
        correctedExpression: null,
        isFirstGap: false,
        followsFromPrevious: false,
      });
      continue;
    }

    const followsFromPrevious = verification.isValid;
    // Has the student drifted from the true answer, regardless of whether this
    // particular line was a legal move from the line above it?
    const stepSolution = solveLinear(current.expression);
    const onCorrectPath =
      trueSolution !== null && stepSolution !== null && Math.abs(stepSolution - trueSolution) < 1e-9;

    // A chemical or quantitative step has no "solution set" to stay on — for
    // those, following from the previous line IS being correct.
    const pathIsMeaningful = verification.domain === "algebra" && trueSolution !== null;

    if (followsFromPrevious && (onCorrectPath || !pathIsMeaningful)) {
      audited.push({
        order: current.order,
        expression: current.expression,
        verdict: "correct",
        domain: verification.domain,
        note: verification.note,
        correctedExpression: null,
        isFirstGap: false,
        followsFromPrevious: true,
      });
      continue;
    }

    if (!followsFromPrevious) {
      // A genuinely new mistake: this doesn't even follow from the student's own
      // working, so it isn't inherited from the earlier error.
      // The correction has to come from the same domain that judged the step:
      // an algebraic fraction is the wrong answer to a physics arithmetic slip.
      const corrected =
        verification.domain === "quantitative"
          ? correctQuantitativeStep(previous.expression, current.expression)
          : verification.domain === "chemical"
            ? null
            : correctNextStep(previous.expression, current.expression);
      const isFirst = firstDivergenceOrder === null;
      if (isFirst) firstDivergenceOrder = current.order;
      else independentErrorOrders.push(current.order);

      audited.push({
        order: current.order,
        expression: current.expression,
        verdict: isFirst ? "first_divergence" : "independent_error",
        domain: verification.domain,
        note: verification.note,
        correctedExpression: corrected,
        isFirstGap: isFirst,
        followsFromPrevious: false,
      });
      continue;
    }

    // Follows from their own previous line, but that line was already off the
    // correct path — so this is carried error, not a new one.
    downstreamCount += 1;
    audited.push({
      order: current.order,
      expression: current.expression,
      verdict: "downstream_consequence",
      domain: verification.domain,
      note: "Correctly worked from the line above — but that line already carried the earlier error.",
      correctedExpression: null,
      isFirstGap: false,
      followsFromPrevious: true,
    });
  }

  // A balancing problem is judged on where it ends up: intermediate lines are
  // allowed to be unbalanced, but the last one is the answer.
  const last = sorted[sorted.length - 1];
  if (
    last &&
    firstDivergenceOrder === null &&
    looksLikeChemicalEquation(last.expression) &&
    checkChemicalBalance(last.expression)?.isBalanced === false
  ) {
    const finalStep = audited.find((a) => a.order === last.order);
    if (finalStep) {
      finalStep.verdict = "first_divergence";
      finalStep.isFirstGap = true;
      finalStep.note = `${checkChemicalBalance(last.expression)?.note ?? ""} This is your final line, so it needs to balance.`;
      firstDivergenceOrder = last.order;
    }
  }

  return {
    steps: audited,
    correctedSolution,
    correctFinalAnswer: correctedSolution.length ? correctedSolution[correctedSolution.length - 1]! : null,
    firstDivergenceOrder,
    independentErrorOrders,
    downstreamCount,
    isFullyCorrect: firstDivergenceOrder === null && independentErrorOrders.length === 0,
  };
}
