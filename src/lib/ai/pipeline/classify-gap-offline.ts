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
 * loop. It runs whenever Gemini is unavailable, and its confidence is reported
 * honestly: "medium" when the error has an unambiguous algebraic signature,
 * "low" when the shape only narrows it down.
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
  const prev = parseLinearEquation(previousExpression);

  let classification = "invalid-transformation";
  let conceptSlug = pick("equations", "algebra");
  let underlyingGap = "This step changes the solution set, so it cannot follow from the step above it.";
  let confidence: "high" | "medium" | "low" = "low";

  if (written && shouldBe) {
    const constantGap = written.k - shouldBe.k;
    const coefficientChanged = Math.abs(written.m - shouldBe.m) > 1e-9;

    // The signature of a sign error: a term crossed the equals sign keeping the
    // sign it already had. Moving b correctly lands at c - b; repeating the sign
    // lands at c + b, so the two differ by exactly 2b. Nothing else produces
    // that gap, which is why this can be named with real confidence.
    const movedWithoutInverting =
      prev !== null &&
      prev.constant !== 0 &&
      Math.abs(Math.abs(constantGap) - 2 * Math.abs(prev.constant)) < 1e-6 &&
      !coefficientChanged;

    if (movedWithoutInverting) {
      classification = "sign-error";
      conceptSlug = pick("sign-handling", "inverse-operations", "equations");
      underlyingGap = `Moving ${prev.constantOp}${prev.constant} across the equals sign means applying its inverse to both sides. It was carried over with the sign it already had, so the two sides no longer describe the same value.`;
      confidence = "medium";
    } else if (coefficientChanged) {
      const ratio = Math.abs(shouldBe.m) > 1e-9 ? written.m / shouldBe.m : NaN;
      const dividedOneSideOnly = Number.isFinite(ratio) && Math.abs(ratio - Math.round(ratio)) < 1e-6;
      classification = "inverse-operation-misapplied";
      conceptSlug = pick("inverse-operations", "equations");
      underlyingGap = dividedOneSideOnly
        ? "The coefficient was divided out on one side but not the other. An operation has to reach both sides or the equation stops balancing."
        : "The coefficient on the variable changed in a way the operation doesn't justify.";
      confidence = "medium";
    } else if (Math.abs(constantGap) > 1e-9) {
      classification = "arithmetic-error";
      conceptSlug = pick("equations", "algebra");
      underlyingGap =
        "The move itself is the right one, but the arithmetic that produced the new value doesn't come out.";
      confidence = "medium";
    }
  }

  const surfaceError = corrected
    ? `Wrote "${divergence.expression}" where the step should read "${corrected}".`
    : `Wrote "${divergence.expression}", which isn't equivalent to "${previousExpression}".`;

  return {
    conceptSlug,
    classification,
    surfaceError,
    underlyingGap,
    evidence: [
      { stepOrder: divergence.order, note: divergence.verificationNote },
      ...(corrected
        ? [{ stepOrder: divergence.order, note: `Algebraically the step resolves to "${corrected}".` }]
        : []),
    ],
    confidence,
  };
}
