import { verifyEquationStep } from "@/lib/verification/math-verifier";
import { verifyChemicalStep, looksLikeChemicalEquation } from "@/lib/verification/domains/chemistry";
import { verifyQuantitativeStep, looksQuantitative } from "@/lib/verification/domains/quantitative";

/**
 * Routes each step to the verifier that can actually judge it.
 *
 * Real working mixes forms: a physics problem states a formula (symbolic),
 * substitutes values (quantitative), then computes (arithmetic with units). A
 * single verifier would have to reject two thirds of that as unparseable. So
 * the domain is decided per step-pair from the shape of the lines themselves,
 * not from the subject the student picked — a student solving algebra inside a
 * chemistry question still gets the algebra verifier.
 *
 * When no verifier recognises the shape, the result is `null`, which the audit
 * treats as *uncertain* — never as an error. Silence is the correct output when
 * we cannot check something.
 */

export type VerificationDomain = "algebra" | "quantitative" | "chemical" | "none";

export interface StepVerification {
  isValid: boolean;
  note: string;
  domain: VerificationDomain;
}

const KNOWN_CONSTANTS = new Set(["e", "pi", "sqrt", "abs", "sin", "cos", "tan", "log", "ln"]);

/** Distinct free symbols in an expression. */
function freeVariables(expression: string): Set<string> {
  const names = new Set<string>();
  for (const match of expression.matchAll(/[a-zA-Z][a-zA-Z0-9_]*/g)) {
    if (!KNOWN_CONSTANTS.has(match[0]!)) names.add(match[0]!);
  }
  return names;
}

/** True for "v = ..." — a named quantity being computed, not an unknown solved for. */
function isNamedQuantity(line: string): boolean {
  const [lhs, rhs] = line.split("=");
  if (!lhs || !rhs) return false;
  const lhsIsBareName = /^\s*[a-zA-Z][a-zA-Z0-9_]*\s*$/.test(lhs);
  const rhsHasNoUnknowns = freeVariables(rhs).size === 0;
  return lhsIsBareName && rhsHasNoUnknowns && /\d/.test(rhs);
}

/**
 * Which verifier, if any, can judge this transition.
 *
 * Decided from the shape of the lines, not the subject the student picked —
 * algebra inside a chemistry question still gets the algebra verifier, and a
 * numeric substitution inside an algebra question still gets the quantitative
 * one.
 */
export function detectDomain(prevExpression: string, nextExpression: string): VerificationDomain {
  if (looksLikeChemicalEquation(prevExpression) || looksLikeChemicalEquation(nextExpression)) {
    return "chemical";
  }

  const bothAreEquations = prevExpression.includes("=") && nextExpression.includes("=");
  if (!bothAreEquations) return "none";

  // "E = 5 * 4" then "E = 20" is a computation being carried out, not an
  // equation being solved. Both lines naming the same quantity settles it.
  if (isNamedQuantity(prevExpression) && isNamedQuantity(nextExpression)) {
    return "quantitative";
  }

  // More than one unknown across the pair (v = u + a*t) is beyond the
  // single-variable algebra verifier; only the arithmetic can be judged.
  const unknowns = new Set([...freeVariables(prevExpression), ...freeVariables(nextExpression)]);
  if (unknowns.size > 1) {
    return looksQuantitative(prevExpression) || looksQuantitative(nextExpression) ? "quantitative" : "none";
  }

  if (unknowns.size === 1) return "algebra";

  return looksQuantitative(prevExpression) ? "quantitative" : "none";
}

export function verifyStep(prevExpression: string, nextExpression: string): StepVerification | null {
  const domain = detectDomain(prevExpression, nextExpression);

  if (domain === "chemical") {
    const result = verifyChemicalStep(prevExpression, nextExpression);
    return { ...result, domain };
  }

  if (domain === "algebra") {
    const result = verifyEquationStep(prevExpression, nextExpression);
    // The algebraic verifier reports "could not parse" for shapes it doesn't
    // handle. That is uncertainty, not a student mistake, so fall through to
    // the quantitative verifier before giving up.
    if (result.note.startsWith("Could not parse") || result.note.startsWith("Could not verify")) {
      const quantitative = verifyQuantitativeStep(prevExpression, nextExpression);
      if (quantitative) return { ...quantitative, domain: "quantitative" };
      return null;
    }
    return { ...result, domain };
  }

  if (domain === "quantitative") {
    const result = verifyQuantitativeStep(prevExpression, nextExpression);
    if (result) return { ...result, domain };
    return null;
  }

  return null;
}
