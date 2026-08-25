import type { GapClassificationResult } from "@/lib/ai/schemas/pipeline";
import type { VerifiedStep } from "./verify-and-find-divergence";
import { toLinearForm } from "@/lib/math/solve-step";
import { parseLinearEquation } from "@/lib/math/linear-parse";

/**
 * Deterministic gap classification.
 *
 * The verifier has already proved *where* the reasoning broke. This decides
 * *what kind* of break it was, by comparing the algebraic structure of the step
 * the student wrote against the step they should have written — no model in the
 * loop. It runs whenever Gemini is unavailable, and its confidence is always
 * reported as "low" because structural evidence is weaker than a reading of the
 * student's full working. The UI shows that level rather than hiding it.
 */
export function classifyGapOffline(params: {
  divergence: VerifiedStep;
  previousExpression: string;
  availableConcepts: { slug: string; name: string }[];
}): GapClassificationResult {
  const { divergence, previousExpression } = params;
  const corrected = divergence.correctedExpression;
  const has = (slug: string) => params.availableConcepts.some((c) => c.slug === slug);
  const pick = (...preferred: string[]) =>
    preferred.find(has) ?? params.availableConcepts[0]?.slug ?? "equations";

  const written = toLinearForm(divergence.expression);
  const shouldBe = corrected ? toLinearForm(corrected) : null;
  const prevPretty = parseLinearEquation(previousExpression);

  let classification = "invalid-transformation";
  let conceptSlug = pick("equations", "algebra");
  let underlyingGap =
    "This step changes the solution set, so it cannot follow from the step above it.";

  if (written && shouldBe) {
    const sameMagnitudeConstant = Math.abs(Math.abs(written.k) - Math.abs(shouldBe.k)) < 1e-9;
    const flippedConstantSign = sameMagnitudeConstant && Math.sign(written.k) !== Math.sign(shouldBe.k);
    const coefficientChanged = Math.abs(written.m - shouldBe.m) > 1e-9;

    if (flippedConstantSign) {
      // The right number, the wrong direction: the classic inverse-operation slip.
      classification = "sign-error";
      conceptSlug = pick("sign-handling", "inverse-operations", "equations");
      underlyingGap = prevPretty
        ? `The constant was moved across the equals sign with the same sign it already had. Moving ${prevPretty.constantOp}${prevPretty.constant} to the other side requires applying its inverse, not repeating it.`
        : "The constant kept its sign when it crossed the equals sign, instead of being inverted.";
    } else if (coefficientChanged) {
      classification = "coefficient-error";
      conceptSlug = pick("inverse-operations", "equations");
      underlyingGap =
        "The coefficient on the variable changed in a way the operation does not justify — dividing or multiplying was applied to only part of the equation.";
    } else {
      classification = "arithmetic-error";
      conceptSlug = pick("equations", "algebra");
      underlyingGap =
        "The structure of the step is right, but the arithmetic that produced the new value does not check out.";
    }
  }

  const surfaceError = corrected
    ? `Wrote "${divergence.expression}" where the step should read "${corrected}".`
    : `Wrote "${divergence.expression}", which is not equivalent to "${previousExpression}".`;

  return {
    conceptSlug,
    classification,
    surfaceError,
    underlyingGap,
    evidence: [
      {
        stepOrder: divergence.order,
        note: divergence.verificationNote,
      },
    ],
    // Structural evidence only — deliberately not claimed as high confidence.
    confidence: "low",
  };
}
