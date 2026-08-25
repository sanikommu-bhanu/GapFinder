import { describe, it, expect } from "vitest";
import { verifyEquationStep, verifyFinalAnswer } from "@/lib/verification/math-verifier";

/**
 * The verifier decides whether a student made a mistake. A false positive here
 * accuses a student who was right; a false negative lets the product miss the
 * gap it exists to find. Both are covered.
 */
describe("verifyEquationStep", () => {
  it("accepts subtracting the same value from both sides", () => {
    expect(verifyEquationStep("2x + 7 = 15", "2x = 8").isValid).toBe(true);
  });

  it("accepts the un-simplified form of that same move", () => {
    expect(verifyEquationStep("2x + 7 = 15", "2x = 15 - 7").isValid).toBe(true);
  });

  it("rejects moving a term without inverting its sign", () => {
    expect(verifyEquationStep("2x + 7 = 15", "2x = 15 + 7").isValid).toBe(false);
  });

  it("accepts dividing both sides by the coefficient", () => {
    expect(verifyEquationStep("2x = 8", "x = 4").isValid).toBe(true);
  });

  it("rejects dividing only one side", () => {
    expect(verifyEquationStep("3x = 12", "x = 12").isValid).toBe(false);
  });

  it("accepts a valid distribution", () => {
    expect(verifyEquationStep("2(x + 3) = 14", "2x + 6 = 14").isValid).toBe(true);
  });

  it("rejects distributing to only the first term", () => {
    expect(verifyEquationStep("2(x + 3) = 14", "2x + 3 = 14").isValid).toBe(false);
  });

  it("accepts multiplying both sides by a constant", () => {
    expect(verifyEquationStep("x = 4", "3x = 12").isValid).toBe(true);
  });

  it("accepts an unchanged restatement", () => {
    expect(verifyEquationStep("2x + 7 = 15", "2x + 7 = 15").isValid).toBe(true);
  });

  it("accepts the sides being swapped", () => {
    expect(verifyEquationStep("2x = 8", "8 = 2x").isValid).toBe(true);
  });

  it("handles negative coefficients", () => {
    expect(verifyEquationStep("-2x + 6 = 0", "-2x = -6").isValid).toBe(true);
    expect(verifyEquationStep("-2x + 6 = 0", "-2x = 6").isValid).toBe(false);
  });

  it("reports rather than throws on unparseable input", () => {
    const result = verifyEquationStep("this is not math", "neither is this");
    expect(result.isValid).toBe(false);
    expect(typeof result.note).toBe("string");
  });

  it("rejects a line with no equals sign", () => {
    expect(verifyEquationStep("2x + 7 = 15", "2x + 7").isValid).toBe(false);
  });
});

describe("verifyFinalAnswer", () => {
  it("matches an identical answer", () => {
    expect(verifyFinalAnswer("x = 4", "x = 4").isValid).toBe(true);
  });

  it("matches an equivalent arithmetic form", () => {
    expect(verifyFinalAnswer("x = 8/2", "x = 4").isValid).toBe(true);
  });

  it("rejects a wrong value", () => {
    expect(verifyFinalAnswer("x = 11", "x = 4").isValid).toBe(false);
  });

  it("tolerates a different variable letter on the same value", () => {
    expect(verifyFinalAnswer("n = 6", "n = 6").isValid).toBe(true);
  });

  it("says so when the answer cannot be parsed", () => {
    expect(verifyFinalAnswer("I think it is four", "x = 4").note).toMatch(/could not parse/i);
  });
});
