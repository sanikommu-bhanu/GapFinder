import { verifyAndFindDivergence } from "@/lib/ai/pipeline/verify-and-find-divergence";
import { verifyFinalAnswer } from "@/lib/verification/math-verifier";
import { solveLinear } from "@/lib/math/solve-step";

export interface WorkCheck {
  isCorrect: boolean;
  verifiedBy: "deterministic";
  feedback: string;
  /** 1-based index of the first line that doesn't follow, when there is one. */
  firstErrorLine: number | null;
  /** What that line should have read, derived algebraically. Never invented. */
  correctedExpression: string | null;
  /** True when nothing in the submission could be parsed as math. */
  unparseable: boolean;
}

/** Keeps only the lines that look like an equation we can reason about. */
function equationLines(raw: string): string[] {
  return raw
    .split(/[\n;]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l.includes("=") && /[0-9]/.test(l));
}

/**
 * Checks a student's practice work the same way GapFinder checks their
 * homework: every line must follow from the one before it, and the last line
 * must be the right answer.
 *
 * This matters more than a right/wrong verdict. A student who reaches the
 * correct answer through an invalid step has not repaired the gap, and a
 * student who reasons correctly but slips on the final arithmetic should be
 * told that — not marked simply "wrong".
 */
export function checkStudentWork(
  studentSteps: string,
  canonicalAnswer: string,
  /**
   * The problem as posed. Without it the first line a student writes has
   * nothing to be checked against — so working that starts by mangling the
   * given equation would sail through as "all steps valid", which is precisely
   * the error this product exists to catch.
   */
  problemPrompt?: string
): WorkCheck {
  const written = equationLines(studentSteps);
  const promptLine = problemPrompt ? equationLines(problemPrompt)[0] : undefined;

  // If the student restated the problem as their first line, don't double it.
  const restatedProblem =
    promptLine !== undefined &&
    written[0] !== undefined &&
    written[0].replace(/\s/g, "") === promptLine.replace(/\s/g, "");

  const lines = promptLine && !restatedProblem ? [promptLine, ...written] : written;
  /** Offset so reported line numbers refer to what the student actually typed. */
  const lineOffset = promptLine && !restatedProblem ? 1 : 0;

  if (written.length === 0) {
    return {
      isCorrect: false,
      verifiedBy: "deterministic",
      feedback: "Write out your working as equations, one line each — for example \"2x = 8\" then \"x = 4\".",
      firstErrorLine: null,
      correctedExpression: null,
      unparseable: true,
    };
  }

  const lastLine = written[written.length - 1] ?? "";
  const finalCheck = verifyFinalAnswer(lastLine, canonicalAnswer);
  const finalParsed = !finalCheck.note.startsWith("Could not parse");

  // A single written line is an answer, not working — judge it as an answer.
  if (written.length === 1) {
    if (!finalParsed) {
      return {
        isCorrect: false,
        verifiedBy: "deterministic",
        feedback: "We couldn't read that as an answer. Try writing it as \"x = 4\".",
        firstErrorLine: null,
        correctedExpression: null,
        unparseable: true,
      };
    }
    return {
      isCorrect: finalCheck.isValid,
      verifiedBy: "deterministic",
      feedback: finalCheck.isValid
        ? "Correct. Next time show your steps too — that's what lets us verify the reasoning, not just the result."
        : `Not quite. ${finalCheck.note}`,
      firstErrorLine: finalCheck.isValid ? null : 1,
      correctedExpression: null,
      unparseable: false,
    };
  }

  const verified = verifyAndFindDivergence(
    lines.map((expression, i) => ({ order: i + 1, statement: expression, expression }))
  );
  const divergence = verified.find((v) => v.isFirstGap);

  if (divergence) {
    const studentLine = divergence.order - lineOffset;
    const brokeOnFirstMove = studentLine === 1 && lineOffset === 1;
    return {
      isCorrect: false,
      verifiedBy: "deterministic",
      feedback: divergence.correctedExpression
        ? brokeOnFirstMove
          ? `Your very first move is where it breaks: from "${promptLine}" you wrote "${divergence.expression}", but it should be "${divergence.correctedExpression}".`
          : `Line ${studentLine} is where it breaks: you wrote "${divergence.expression}", but it should be "${divergence.correctedExpression}".`
        : `Line ${studentLine} doesn't follow from what came before it — the two have different solutions.`,
      firstErrorLine: Math.max(1, studentLine),
      correctedExpression: divergence.correctedExpression,
      unparseable: false,
    };
  }

  // Every step is valid. The remaining question is whether they finished.
  if (!finalParsed) {
    const solution = solveLinear(lines[0] ?? "");
    return {
      isCorrect: false,
      verifiedBy: "deterministic",
      feedback:
        solution === null
          ? "Every step checks out, but we couldn't read your final answer. Write the last line as \"x = …\"."
          : "Every step checks out — now finish it by writing the final line as \"x = …\".",
      firstErrorLine: null,
      correctedExpression: null,
      unparseable: false,
    };
  }

  return {
    isCorrect: finalCheck.isValid,
    verifiedBy: "deterministic",
    feedback: finalCheck.isValid
      ? "Every step follows from the one before it, and the answer is right. That's the gap closed properly."
      : `Your steps are all valid, but the final answer is off. ${finalCheck.note}`,
    firstErrorLine: finalCheck.isValid ? null : lines.length,
    correctedExpression: null,
    unparseable: false,
  };
}
