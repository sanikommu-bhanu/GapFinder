import type { VerifiedStep } from "@/lib/ai/pipeline/verify-and-find-divergence";
import { toLinearForm } from "@/lib/math/solve-step";
import { parseLinearEquation } from "@/lib/math/linear-parse";
import { getMisconception, UNCLASSIFIED, type Misconception } from "./misconceptions";

export interface MisconceptionMatch {
  misconception: Misconception;
  /** How the code was arrived at — surfaced so the diagnosis is auditable. */
  evidence: string;
  /**
   * "proved" means an algebraic signature identified it with no model involved.
   * "matched" means a model chose the code from the catalogue.
   */
  basis: "proved" | "matched";
}

/**
 * Identifies the misconception behind a verified error from its algebraic
 * signature alone.
 *
 * Each signature below is a fact about the numbers, not a judgement: moving a
 * term without inverting it leaves the two sides differing by exactly twice
 * that term, and nothing else produces that gap. Where a signature fires, the
 * code is *proved* rather than guessed, and the same student error always
 * yields the same code — which is what makes these countable across students.
 *
 * Returns null when no signature matches, leaving the choice to the model
 * (still constrained to the catalogue) rather than forcing a label.
 */
export function detectMisconception(params: {
  divergence: VerifiedStep;
  previousExpression: string;
  subject: string;
}): MisconceptionMatch | null {
  const { divergence, previousExpression, subject } = params;
  const note = divergence.verificationNote;

  // Checked before the domain dispatch below, because this signature is a proof
  // about the numbers themselves rather than a judgement any one verifier makes.
  // A fraction sum can be routed to the quantitative verifier, whose branch
  // would return a generic arithmetic slip and never reach the algebra
  // signatures — so the specific, provable diagnosis has to come first.
  //
  // The distinction it preserves matters: a slip is a one-off to be pointed at,
  // whereas this is a rule the student is applying consistently and will keep
  // applying until it is named.
  const fractionSum = detectFractionDenominatorAddition(previousExpression, divergence.expression);
  if (fractionSum) {
    return {
      misconception: getMisconception("M-FRACTION-ADD-DENOMINATORS"),
      evidence: fractionSum,
      basis: "proved",
    };
  }

  // ------------------------------------------------------------- Chemistry
  if (divergence.domain === "chemical") {
    if (/never the formula itself/.test(note)) {
      return {
        misconception: getMisconception("C-SUBSCRIPT-CHANGED"),
        evidence: note,
        basis: "proved",
      };
    }
    if (/final line/.test(note) || /Not balanced/.test(note)) {
      return {
        misconception: getMisconception("C-UNBALANCED-FINAL"),
        evidence: note,
        basis: "proved",
      };
    }
    return null;
  }

  // --------------------------------------------------------------- Physics
  if (divergence.domain === "quantitative") {
    if (/units don't match/i.test(note)) {
      return {
        misconception: getMisconception("P-UNIT-MISMATCH"),
        evidence: note,
        basis: "proved",
      };
    }
    if (/should come to/.test(note)) {
      return {
        misconception: getMisconception(
          subject.toLowerCase() === "physics" ? "P-ARITHMETIC-SLIP" : "M-ARITHMETIC-SLIP"
        ),
        evidence: note,
        basis: "proved",
      };
    }
    return null;
  }

  // ------------------------------------------------------------------ Math
  if (divergence.domain !== "algebra") return null;

  const written = toLinearForm(divergence.expression);
  const corrected = divergence.correctedExpression ? toLinearForm(divergence.correctedExpression) : null;
  const previous = toLinearForm(previousExpression);
  const previousPretty = parseLinearEquation(previousExpression);

  if (!written || !corrected) return null;

  // Signature: a term crossed the equals sign keeping its sign. Moving b
  // correctly lands at c - b; repeating the sign lands at c + b, so the two
  // differ by exactly 2b. Nothing else produces that gap.
  const constantGap = written.k - corrected.k;
  if (
    previousPretty &&
    previousPretty.constant !== 0 &&
    Math.abs(Math.abs(constantGap) - 2 * Math.abs(previousPretty.constant)) < 1e-6
  ) {
    return {
      misconception: getMisconception("M-TRANSPOSE-SIGN"),
      evidence: `Moving ${previousPretty.constantOp}${previousPretty.constant} across the equals sign changes the constant by 2 x ${previousPretty.constant}; here it changed by ${Math.abs(constantGap)}, which is the signature of carrying it over unchanged.`,
      basis: "proved",
    };
  }

  // Signature: the coefficient changed while the other side did not — an
  // operation reached one side only.
  if (
    previous &&
    Math.abs(previous.m - written.m) > 1e-9 &&
    Math.abs(previous.k - written.k) < 1e-9
  ) {
    return {
      misconception: getMisconception("M-ONE-SIDED-OPERATION"),
      evidence: `The coefficient went from ${previous.m} to ${written.m} while the constant stayed at ${written.k}, so the division reached only one side.`,
      basis: "proved",
    };
  }

  // Signature: brackets in the previous line, and the expansion is short by
  // exactly one term's contribution.
  if (/\([^)]*\)/.test(previousExpression)) {
    const negativeMultiplier = /[-−]\s*\d*\s*\(/.test(previousExpression);
    return {
      misconception: getMisconception(
        negativeMultiplier ? "M-DISTRIBUTE-NEGATIVE" : "M-DISTRIBUTE-FIRST-ONLY"
      ),
      evidence: `The previous line contains a bracket and the expansion does not match its correct expansion.`,
      basis: "proved",
    };
  }

  // Structure preserved from the previous line, value wrong: the method was
  // right, the arithmetic was not.
  if (previous && Math.abs(previous.m - written.m) < 1e-9) {
    return {
      misconception: getMisconception("M-ARITHMETIC-SLIP"),
      evidence: `The shape of the step is correct; the value it produced is not.`,
      basis: "proved",
    };
  }

  // Signature: the line has the same SHAPE as the correct next line — the same
  // coefficient on x — but a different value.
  //
  // This is the case where the student picked the right operation and then
  // mis-computed it: dividing 3x = 15 and writing x = 6 rather than x = 5. The
  // check above cannot see it, because that one compares against the PREVIOUS
  // line, whose coefficient the division has legitimately changed. Comparing
  // against the correct next line instead is what makes it visible.
  //
  // Safe to run only here, at the end: every more specific signature above
  // returns first, so a transpose error is never mislabelled as arithmetic even
  // though it too preserves the coefficient.
  if (Math.abs(written.m - corrected.m) < 1e-9 && Math.abs(written.k - corrected.k) > 1e-9) {
    return {
      misconception: getMisconception("M-ARITHMETIC-SLIP"),
      evidence: `The operation chosen was the right one and produced the right form; the value it landed on was not the one that operation gives.`,
      basis: "proved",
    };
  }

  return null;
}

/**
 * Proves the add-the-denominators error, or returns null.
 *
 * The test is exact rather than approximate: the written result has to be
 * precisely (a+c)/(b+d), the number that rule produces and that no correct
 * method produces. A fraction that is merely wrong fails this check and falls
 * through to the arithmetic-slip signature, which is the honest outcome — we
 * only name the rule when the numbers show the rule.
 */
function detectFractionDenominatorAddition(
  previousExpression: string,
  writtenExpression: string
): string | null {
  const sum = /(-?\d+)\s*\/\s*(\d+)\s*\+\s*(-?\d+)\s*\/\s*(\d+)/.exec(previousExpression);
  if (!sum) return null;

  const [, aRaw, bRaw, cRaw, dRaw] = sum;
  const a = Number(aRaw);
  const b = Number(bRaw);
  const c = Number(cRaw);
  const d = Number(dRaw);
  if (!b || !d) return null;

  // The result the student actually wrote — the last fraction on the line.
  const results = [...writtenExpression.matchAll(/(-?\d+)\s*\/\s*(\d+)/g)];
  const last = results[results.length - 1];
  if (!last) return null;

  const writtenNumerator = Number(last[1]);
  const writtenDenominator = Number(last[2]);

  if (writtenNumerator === a + c && writtenDenominator === b + d) {
    return `${a}/${b} + ${c}/${d} was written as ${writtenNumerator}/${writtenDenominator}, which is exactly (${a}+${c})/(${b}+${d}) — the tops and the bottoms each added. The correct sum is ${a * d + c * b}/${b * d}.`;
  }
  return null;
}

/** Used when neither a signature nor the model produced a usable code. */
export function unclassified(reason: string): MisconceptionMatch {
  return { misconception: UNCLASSIFIED, evidence: reason, basis: "matched" };
}
