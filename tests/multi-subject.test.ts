import { describe, it, expect } from "vitest";
import { countAtoms, checkChemicalBalance, verifyChemicalStep } from "@/lib/verification/domains/chemistry";
import { verifyQuantitativeStep, compareUnits } from "@/lib/verification/domains/quantitative";
import { verifyStep, detectDomain } from "@/lib/verification/verify-step";
import { auditSolution } from "@/lib/verification/solution-audit";

const audit = (...expressions: string[]) =>
  auditSolution(expressions.map((expression, i) => ({ order: i + 1, expression })));

describe("chemistry — atom counting", () => {
  it("counts a simple formula", () => {
    expect(countAtoms("H2O")).toEqual({ H: 2, O: 1 });
  });

  it("applies a leading coefficient to every atom", () => {
    expect(countAtoms("2H2O")).toEqual({ H: 4, O: 2 });
  });

  it("resolves nested groups", () => {
    expect(countAtoms("Ca(OH)2")).toEqual({ Ca: 1, O: 2, H: 2 });
    expect(countAtoms("Al2(SO4)3")).toEqual({ Al: 2, S: 3, O: 12 });
  });

  it("handles two-letter element symbols", () => {
    expect(countAtoms("NaCl")).toEqual({ Na: 1, Cl: 1 });
  });

  it("rejects an unclosed bracket rather than guessing", () => {
    expect(countAtoms("Ca(OH2")).toBeNull();
  });
});

describe("chemistry — balancing", () => {
  it("accepts a balanced equation", () => {
    const result = checkChemicalBalance("2H2 + O2 -> 2H2O");
    expect(result?.isBalanced).toBe(true);
  });

  it("rejects an unbalanced one and names the element", () => {
    const result = checkChemicalBalance("H2 + O2 -> H2O");
    expect(result?.isBalanced).toBe(false);
    expect(result?.mismatches.map((m) => m.element)).toContain("O");
    expect(result?.note).toMatch(/O \(2 on the left, 1 on the right\)/);
  });

  it("balances combustion correctly", () => {
    expect(checkChemicalBalance("CH4 + 2O2 -> CO2 + 2H2O")?.isBalanced).toBe(true);
    expect(checkChemicalBalance("CH4 + O2 -> CO2 + H2O")?.isBalanced).toBe(false);
  });

  it("ignores state symbols", () => {
    expect(checkChemicalBalance("2Na(s) + Cl2(g) -> 2NaCl(s)")?.isBalanced).toBe(true);
  });

  it("catches an element appearing from nowhere between steps", () => {
    const result = verifyChemicalStep("H2 + O2 -> H2O", "H2 + O2 -> H2O + NaCl");
    expect(result.isValid).toBe(false);
    expect(result.note).toMatch(/created or destroyed/);
  });

  it("accepts progress toward balance", () => {
    expect(verifyChemicalStep("H2 + O2 -> H2O", "2H2 + O2 -> 2H2O").isValid).toBe(true);
  });
});

describe("physics — quantitative steps", () => {
  it("accepts arithmetic that comes out right", () => {
    expect(verifyQuantitativeStep("v = 0 + 9.8 * 2", "v = 19.6")?.isValid).toBe(true);
  });

  it("catches arithmetic that doesn't", () => {
    const result = verifyQuantitativeStep("v = 0 + 9.8 * 2", "v = 18.6");
    expect(result?.isValid).toBe(false);
    expect(result?.note).toMatch(/19\.6/);
  });

  it("tolerates sensible rounding", () => {
    expect(verifyQuantitativeStep("v = 2 / 3", "v = 0.667")?.isValid).toBe(true);
  });

  it("evaluates a kinetic-energy substitution", () => {
    expect(verifyQuantitativeStep("KE = 0.5 * 4 * 3^2", "KE = 18")?.isValid).toBe(true);
  });
});

describe("physics — units", () => {
  it("passes units that measure the same thing", () => {
    expect(compareUnits("v = 19.6 m/s", "v = 19.6 m/s")).toBeNull();
  });

  it("flags a unit that changed dimension", () => {
    expect(compareUnits("d = 20 m", "d = 20 s")).toMatch(/units don't match/i);
  });

  it("stays quiet when units appear for the first time", () => {
    expect(compareUnits("v = 19.6", "v = 19.6 m/s")).toBeNull();
  });
});

describe("domain routing", () => {
  it("sends algebra to the algebra verifier", () => {
    expect(detectDomain("2x + 7 = 15", "2x = 8")).toBe("algebra");
  });

  it("sends a chemical equation to the chemistry verifier", () => {
    expect(detectDomain("H2 + O2 -> H2O", "2H2 + O2 -> 2H2O")).toBe("chemical");
  });

  it("sends a pure computation to the quantitative verifier", () => {
    expect(detectDomain("E = 5 * 4", "E = 20")).toBe("quantitative");
  });

  it("returns none for prose rather than forcing a verdict", () => {
    expect(detectDomain("photosynthesis happens", "in the chloroplast")).toBe("none");
  });

  it("never reports a mistake on something it cannot read", () => {
    expect(verifyStep("mitochondria make ATP", "this happens in respiration")).toBeNull();
  });
});

describe("audit across subjects", () => {
  it("finds the first divergence in a physics calculation", () => {
    // v = u + at with u=0, a=9.8, t=3 -> 29.4, not 27.4
    const result = audit("v = u + a*t", "v = 0 + 9.8 * 3", "v = 27.4", "v = 27.4 m/s");
    expect(result.firstDivergenceOrder).toBe(3);
    expect(result.steps[2]!.domain).toBe("quantitative");
  });

  it("finds the first divergence in a balancing problem", () => {
    const result = audit("CH4 + O2 -> CO2 + H2O", "CH4 + O2 -> CO2 + 2H2O", "CH4 + 2O2 -> CO2 + 2H2O");
    // Step 2 still isn't balanced; step 3 is.
    expect(result.steps[1]!.verdict).toBe("first_divergence");
    expect(result.steps[1]!.domain).toBe("chemical");
  });

  it("accepts a fully balanced chemistry solution", () => {
    const result = audit("2H2 + O2 -> 2H2O", "2H2 + O2 -> 2H2O");
    expect(result.isFullyCorrect).toBe(true);
  });

  it("marks written biology reasoning uncertain, never wrong", () => {
    const result = audit(
      "Photosynthesis converts light energy into chemical energy",
      "It takes place in the chloroplast",
      "The products are glucose and oxygen"
    );
    expect(result.steps.every((s) => s.verdict === "uncertain" || s.verdict === "correct")).toBe(true);
    expect(result.firstDivergenceOrder).toBeNull();
    expect(result.independentErrorOrders).toEqual([]);
  });

  it("still handles the algebra case unchanged", () => {
    const result = audit("2x + 7 = 15", "2x = 15 + 7", "2x = 22", "x = 11");
    expect(result.firstDivergenceOrder).toBe(2);
    expect(result.steps[1]!.correctedExpression).toBe("2x = 15 - 7");
    expect(result.steps[2]!.verdict).toBe("downstream_consequence");
  });
});
