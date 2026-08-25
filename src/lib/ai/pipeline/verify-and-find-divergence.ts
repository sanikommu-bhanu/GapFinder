import { verifyEquationStep } from "@/lib/verification/math-verifier";

export interface VerifiedStep {
  order: number;
  statement: string;
  expression: string;
  isValid: boolean;
  isFirstGap: boolean;
  verificationNote: string;
}

/**
 * Walks the reconstructed reasoning steps in order and deterministically
 * verifies each transition against the previous one. The FIRST invalid
 * transition is marked isFirstGap — this is the "first divergence" the whole
 * product is built around, and it is computed with math, not an LLM guess.
 */
export function verifyAndFindDivergence(
  steps: { order: number; statement: string; expression: string }[]
): VerifiedStep[] {
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  const results: VerifiedStep[] = [];
  let firstGapFound = false;

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]!;
    if (i === 0) {
      results.push({
        ...current,
        isValid: true,
        isFirstGap: false,
        verificationNote: "Starting point.",
      });
      continue;
    }
    const prev = sorted[i - 1]!;
    const verification = verifyEquationStep(prev.expression, current.expression);
    const isFirstGap = !verification.isValid && !firstGapFound;
    if (isFirstGap) firstGapFound = true;

    results.push({
      ...current,
      isValid: verification.isValid,
      isFirstGap,
      verificationNote: verification.note,
    });
  }

  return results;
}
