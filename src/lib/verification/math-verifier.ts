import { simplify, parse, equal, evaluate } from "mathjs";

export interface StepVerification {
  isValid: boolean;
  note: string;
}

/**
 * Verifies that `next` is a mathematically valid consequence of `prev` for a
 * single-variable linear/equation-style step. This is intentionally narrow
 * and deterministic: rather than asking an LLM "is this step correct?" (which
 * it can get wrong with confidence), we algebraically check equivalence.
 *
 * Strategy: an equation "A = B" transforms validly into "A' = B'" if, for the
 * solved variable, both equations share the same solution set. We check this
 * by moving everything to one side (A - B) and (A' - B') and testing whether
 * the two expressions are proportional (scalar multiples of one another),
 * which covers the legal moves: adding/subtracting the same value from both
 * sides, multiplying/dividing both sides by a nonzero constant, and
 * distributing. It intentionally rejects non-equivalent transformations
 * (e.g. inconsistent sign changes), which is exactly the class of error
 * GapFinder needs to catch.
 */
export function verifyEquationStep(prevExpr: string, nextExpr: string): StepVerification {
  try {
    const prevSides = splitEquation(prevExpr);
    const nextSides = splitEquation(nextExpr);
    if (!prevSides || !nextSides) {
      return { isValid: false, note: "Could not parse one of the steps as an equation." };
    }

    const prevDiff = simplify(`(${prevSides.lhs}) - (${prevSides.rhs})`);
    const nextDiff = simplify(`(${nextSides.lhs}) - (${nextSides.rhs})`);

    // Try a set of sample values for any free variable to test proportionality
    // robustly (handles symbolic simplification limits in mathjs).
    const variable = extractVariable(prevExpr) ?? extractVariable(nextExpr);
    if (!variable) {
      // No variable — pure arithmetic identity check.
      const isValid = Math.abs(Number(evaluate(prevDiff.toString())) ) < 1e-9
        ? Math.abs(Number(evaluate(nextDiff.toString()))) < 1e-9
        : ratiosConsistent(prevDiff.toString(), nextDiff.toString(), variable);
      return { isValid, note: isValid ? "Arithmetic identity holds." : "Arithmetic does not hold." };
    }

    const consistent = ratiosConsistent(prevDiff.toString(), nextDiff.toString(), variable);
    return {
      isValid: consistent,
      note: consistent
        ? "Equation-preserving transformation confirmed."
        : "The transformation changes the solution set — this is the divergence point.",
    };
  } catch (err) {
    return { isValid: false, note: `Could not verify step: ${String(err)}` };
  }
}

function ratiosConsistent(prevDiffExpr: string, nextDiffExpr: string, variable: string): boolean {
  const samples = [1, 2, -3, 5.5, -0.5];
  const ratios: number[] = [];
  for (const v of samples) {
    try {
      const scope = { [variable]: v };
      const a = Number(evaluate(prevDiffExpr, scope));
      const b = Number(evaluate(nextDiffExpr, scope));
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      if (Math.abs(a) < 1e-9 && Math.abs(b) < 1e-9) continue; // both zero, uninformative
      if (Math.abs(a) < 1e-9 || Math.abs(b) < 1e-9) return false; // one zero, other not => not proportional
      ratios.push(b / a);
    } catch {
      continue;
    }
  }
  if (ratios.length === 0) return false;
  const first = ratios[0]!;
  return ratios.every((r) => Math.abs(r - first) < 1e-6) && Math.abs(first) > 1e-9;
}

function splitEquation(expr: string): { lhs: string; rhs: string } | null {
  const parts = expr.split("=");
  if (parts.length !== 2) return null;
  return { lhs: parts[0]!.trim(), rhs: parts[1]!.trim() };
}

function extractVariable(expr: string): string | null {
  const match = expr.match(/[a-zA-Z]+/);
  return match ? match[0] : null;
}

/** Checks a final numeric/symbolic answer against a canonical answer string. */
export function verifyFinalAnswer(studentAnswer: string, canonicalAnswer: string): StepVerification {
  try {
    const eqMatchStudent = splitEquation(studentAnswer);
    const eqMatchCanonical = splitEquation(canonicalAnswer);
    if (eqMatchStudent && eqMatchCanonical) {
      const variable = extractVariable(canonicalAnswer) ?? "x";
      const studentVal = evaluate(eqMatchStudent.rhs);
      const canonicalVal = evaluate(eqMatchCanonical.rhs);
      const isValid = Math.abs(Number(studentVal) - Number(canonicalVal)) < 1e-6;
      return { isValid, note: isValid ? "Matches expected value." : `Expected ${variable} = ${canonicalVal}.` };
    }
    // Fall back to direct numeric/symbolic equality.
    const isValid = equal(parse(studentAnswer).compile().evaluate(), parse(canonicalAnswer).compile().evaluate()) as boolean;
    return { isValid, note: isValid ? "Correct." : "Does not match expected answer." };
  } catch (err) {
    return { isValid: false, note: `Could not parse answer: ${String(err)}` };
  }
}
