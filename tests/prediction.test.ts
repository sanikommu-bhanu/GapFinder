import { describe, it, expect } from "vitest";
import { evaluatePrediction } from "@/lib/services/misconception-history";

/**
 * The prediction is a claim GapFinder makes *before* the student writes
 * anything. These tests pin the one property that gives it any value: the
 * verdict must reflect what actually happened, and "you broke the pattern"
 * must never be reported unless a real prediction existed to break.
 */
describe("evaluatePrediction", () => {
  it("reports a broken pattern when the predicted slip did not happen", () => {
    const result = evaluatePrediction({
      predictedCode: "M-TRANSPOSE-SIGN",
      actualCode: null,
      wasCorrect: true,
    });
    expect(result.outcome).toBe("broke-pattern");
    expect(result.message).toMatch(/didn't happen/i);
  });

  it("reports a repeat when the same misconception recurred", () => {
    const result = evaluatePrediction({
      predictedCode: "M-TRANSPOSE-SIGN",
      actualCode: "M-TRANSPOSE-SIGN",
      wasCorrect: false,
    });
    expect(result.outcome).toBe("repeated");
    // The point of naming it: this is a rule being applied, not carelessness.
    expect(result.message).toMatch(/rule you're applying/i);
  });

  it("distinguishes a different mistake from the predicted one", () => {
    const result = evaluatePrediction({
      predictedCode: "M-TRANSPOSE-SIGN",
      actualCode: "M-ARITHMETIC-SLIP",
      wasCorrect: false,
    });
    expect(result.outcome).toBe("different-slip");
  });

  it("stays silent when no prediction was made", () => {
    // Without a prior claim there is nothing to have broken, and saying so
    // anyway would turn an ordinary correct answer into a fake achievement.
    const result = evaluatePrediction({ predictedCode: null, actualCode: null, wasCorrect: true });
    expect(result.outcome).toBe("none");
    expect(result.message).toBe("");
  });

  it("never claims a broken pattern from a correct answer alone", () => {
    const noPrediction = evaluatePrediction({ predictedCode: null, actualCode: null, wasCorrect: true });
    expect(noPrediction.outcome).not.toBe("broke-pattern");
  });
});
