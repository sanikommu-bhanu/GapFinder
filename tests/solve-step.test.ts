import { describe, it, expect } from "vitest";
import { correctNextStep, correctSolutionChain, solveLinear, toLinearForm, fmt } from "@/lib/math/solve-step";

/**
 * `correctNextStep` produces the single most load-bearing string in the whole
 * product — the "but it should be" a student is asked to trust. It must be
 * derived, correct, and absent rather than guessed.
 */
describe("correctNextStep", () => {
  it("shows the inverse operation the student skipped", () => {
    expect(correctNextStep("2x + 7 = 15", "2x = 15 + 7")).toBe("2x = 15 - 7");
  });

  it("keeps the sign when the original constant was negative", () => {
    expect(correctNextStep("4x - 9 = 27", "4x = 27 - 9")).toBe("4x = 27 + 9");
  });

  it("corrects the final answer when the student jumped to one", () => {
    expect(correctNextStep("2x = 22", "x = 12")).toBe("x = 11");
  });

  it("drops the coefficient when it is 1", () => {
    expect(correctNextStep("x + 5 = 12", "x = 12 + 5")).toBe("x = 12 - 5");
  });

  it("returns null when the previous step is not linear", () => {
    expect(correctNextStep("not an equation", "x = 4")).toBeNull();
  });

  it("returns null rather than guessing on a zero coefficient", () => {
    expect(correctNextStep("7 = 7", "x = 1")).toBeNull();
  });
});

describe("solveLinear", () => {
  it("solves a standard linear equation", () => {
    expect(solveLinear("2x + 7 = 15")).toBe(4);
  });

  it("solves with the constant written first", () => {
    expect(solveLinear("7 + 3x = 25")).toBe(6);
  });

  it("solves with a negative solution", () => {
    expect(solveLinear("2x + 10 = 4")).toBe(-3);
  });

  it("returns null for a non-linear equation", () => {
    expect(solveLinear("x^2 = 4")).toBeNull();
  });

  it("returns null when the variable cancels out", () => {
    expect(solveLinear("x = x")).toBeNull();
  });
});

describe("toLinearForm", () => {
  it("reduces to m*x + k = 0", () => {
    expect(toLinearForm("2x + 7 = 15")).toEqual({ m: 2, k: -8, variable: "x" });
  });

  it("refuses a quadratic rather than linearising it", () => {
    expect(toLinearForm("x^2 + 1 = 5")).toBeNull();
  });
});

describe("correctSolutionChain", () => {
  it("lays out every step from the equation to the answer", () => {
    expect(correctSolutionChain("2x + 7 = 15")).toEqual(["2x + 7 = 15", "2x = 15 - 7", "2x = 8", "x = 4"]);
  });

  it("skips the division line when the coefficient is 1", () => {
    expect(correctSolutionChain("x + 5 = 12")).toEqual(["x + 5 = 12", "x = 12 - 5", "x = 7"]);
  });

  it("expands brackets and gathers variables from both sides", () => {
    // The reference worksheet: the student botched both distributions.
    const chain = correctSolutionChain("2(3x-5) - 4(x+2) = 3(x-1) + 7");
    expect(chain).not.toBeNull();
    expect(chain![0]).toBe("2(3x-5) - 4(x+2) = 3(x-1) + 7");
    // Expanded and collected, before anything is moved across.
    expect(chain).toContain("2x - 18 = 3x + 4");
    expect(chain![chain!.length - 1]).toBe("x = -22");
  });

  it("corrects a bracket expansion with the properly expanded line", () => {
    const corrected = correctNextStep("2(3x-5) - 4(x+2) = 3(x-1) + 7", "6x - 10 - 4x + 8 = 3x - 1 + 7");
    expect(corrected).toBe("2x - 18 = 3x + 4");
  });
});

describe("fmt", () => {
  it("keeps whole numbers whole", () => {
    expect(fmt(4)).toBe("4");
    expect(fmt(-3)).toBe("-3");
  });

  it("writes simple rationals as fractions rather than long decimals", () => {
    expect(fmt(25 / 3)).toBe("25/3");
    expect(fmt(1 / 2)).toBe("1/2");
    expect(fmt(-2 / 3)).toBe("-2/3");
  });

  it("reduces fractions to lowest terms", () => {
    expect(fmt(2 / 4)).toBe("1/2");
  });

  it("falls back to a bounded decimal for awkward values", () => {
    expect(fmt(Math.PI)).toBe("3.1416");
  });
});
