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

/** Which verifier, if any, can judge this transition. */
export function detectDomain(prevExpression: string, nextExpression: string): VerificationDomain {
  if (looksLikeChemicalEquation(prevExpression) || looksLikeChemicalEquation(nextExpression)) {
    return "chemical";
  }
  // Symbolic algebra takes precedence: "2x = 15 - 7" is arithmetic on the right
  // but the claim being made is an algebraic one.
  const hasVariable = /[a-zA-Z]/.test(prevExpression.replace(/\s/g, ""));
  const bothSidesAlgebraic = prevExpression.includes("=") && nextExpression.includes("=");
  if (hasVariable && bothSidesAlgebraic) {
    return "algebra";
  }
  if (looksQuantitative(prevExpression) && looksQuantitative(nextExpression)) {
    return "quantitative";
  }
  return "none";
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
