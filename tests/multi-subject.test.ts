import { describe, it, expect } from "vitest";
import { countAtoms, checkChemicalBalance, verifyChemicalStep } from "@/lib/verification/domains/chemistry";
import { verifyQuantitativeStep, compareUnits } from "@/lib/verification/domains/quantitative";
import { verifyStep, detectDomain } from "@/lib/verification/verify-step";
import { auditSolution } from "@/lib/verification/solution-audit";
import { detectMisconception } from "@/lib/diagnosis/detect-misconception";
import { MISCONCEPTIONS } from "@/lib/diagnosis/misconceptions";
import { selectConceptVisual } from "@/lib/ai/visuals/select-visual";

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

  it("catches a substance appearing from nowhere between steps", () => {
    const result = verifyChemicalStep("H2 + O2 -> H2O", "H2 + O2 -> H2O + NaCl");
    expect(result.isValid).toBe(false);
    expect(result.note).toMatch(/NaCl/);
  });

  it("catches the classic subscript change that fakes a balance", () => {
    // H2O -> H2O2 makes the oxygen count work and silently swaps water for
    // hydrogen peroxide. This is the error that matters most in balancing.
    const result = verifyChemicalStep("H2 + O2 -> H2O", "H2 + O2 -> H2O2");
    expect(result.isValid).toBe(false);
    expect(result.note).toMatch(/H2O became H2O2/);
    expect(result.note).toMatch(/never the formula itself/);
  });

  it("accepts progress toward balance", () => {
    expect(verifyChemicalStep("H2 + O2 -> H2O", "2H2 + O2 -> 2H2O").isValid).toBe(true);
  });

  it("allows an intermediate line to still be unbalanced", () => {
    // Balancing carbon before hydrogen passes through unbalanced lines.
    const result = verifyChemicalStep("CH4 + O2 -> CO2 + H2O", "CH4 + O2 -> CO2 + 2H2O");
    expect(result.isValid).toBe(true);
    expect(result.note).toMatch(/Keep going/);
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
    // A measured value keeps its decimal form; "147/5" is not how anyone
    // writes 29.4 m/s.
    expect(result.steps[2]!.correctedExpression).toBe("v = 29.4");
  });

  it("keeps an exact quotient exact rather than rounding it", () => {
    // All-integer inputs mean the answer is a fraction, not a decimal
    // approximation the student would then be marked against.
    const result = audit("t = 5 / 6", "t = 0.8");
    expect(result.steps[1]!.correctedExpression).toBe("t = 5/6");
  });

  it("accepts correct balancing working, including unbalanced middle steps", () => {
    const result = audit("CH4 + O2 -> CO2 + H2O", "CH4 + O2 -> CO2 + 2H2O", "CH4 + 2O2 -> CO2 + 2H2O");
    expect(result.firstDivergenceOrder).toBeNull();
    expect(result.isFullyCorrect).toBe(true);
  });

  it("flags a final line that is still unbalanced", () => {
    const result = audit("CH4 + O2 -> CO2 + H2O", "CH4 + O2 -> CO2 + 2H2O");
    expect(result.firstDivergenceOrder).toBe(2);
    expect(result.steps[1]!.note).toMatch(/final line/);
  });

  it("flags a subscript change as the divergence", () => {
    const result = audit("H2 + O2 -> H2O", "H2 + O2 -> H2O2");
    expect(result.firstDivergenceOrder).toBe(2);
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

describe("misconception catalogue", () => {
  it("proves the transpose-sign misconception from its algebraic signature", () => {
    const result = audit("2x + 7 = 15", "2x = 15 + 7");
    const divergence = result.steps[1]!;
    const match = detectMisconception({
      divergence: {
        ...divergence,
        statement: divergence.expression,
        isValid: false,
        verificationNote: divergence.note,
      },
      previousExpression: "2x + 7 = 15",
      subject: "Math",
    });
    expect(match?.misconception.code).toBe("M-TRANSPOSE-SIGN");
    // Proved by arithmetic, not chosen by a model.
    expect(match?.basis).toBe("proved");
    expect(match?.evidence).toMatch(/2 x 7/);
  });

  it("proves the subscript-change misconception in chemistry", () => {
    const result = audit("H2 + O2 -> H2O", "H2 + O2 -> H2O2");
    const divergence = result.steps[1]!;
    const match = detectMisconception({
      divergence: {
        ...divergence,
        statement: divergence.expression,
        isValid: false,
        verificationNote: divergence.note,
      },
      previousExpression: "H2 + O2 -> H2O",
      subject: "Chemistry",
    });
    expect(match?.misconception.code).toBe("C-SUBSCRIPT-CHANGED");
    expect(match?.basis).toBe("proved");
  });

  it("proves a unit mismatch in physics", () => {
    const match = detectMisconception({
      divergence: {
        order: 2,
        expression: "d = 20 s",
        statement: "d = 20 s",
        isValid: false,
        isFirstGap: true,
        verificationNote: "The units don't match: m became s, which measures a different quantity.",
        correctedExpression: null,
        verdict: "first_divergence",
        domain: "quantitative",
      },
      previousExpression: "d = 20 m",
      subject: "Physics",
    });
    expect(match?.misconception.code).toBe("P-UNIT-MISMATCH");
  });

  it("gives every catalogue entry a question that asks rather than tells", () => {
    for (const m of MISCONCEPTIONS) {
      expect(m.socraticPrompt.length).toBeGreaterThan(15);
      expect(m.socraticPrompt).toMatch(/\?/);
      expect(m.code).toMatch(/^[MPCB]-[A-Z-]+$/);
    }
  });

  it("keeps codes unique so they can be counted across students", () => {
    const codes = MISCONCEPTIONS.map((m) => m.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("visuals across subjects", () => {
  it("draws atom counts for a chemistry gap, from the verifier's own numbers", () => {
    const v = selectConceptVisual({
      conceptSlug: "balancing-equations",
      originalExpression: "H2 + O2 -> H2O",
    });
    expect(v.kind).toBe("atom-balance");
    if (v.kind !== "atom-balance") throw new Error("expected atom-balance");
    expect(v.left).toEqual({ H: 2, O: 2 });
    expect(v.right).toEqual({ H: 2, O: 1 });
  });

  it("builds a Punnett square from a monohybrid cross", () => {
    const v = selectConceptVisual({
      conceptSlug: "genetics-inheritance",
      originalExpression: "Aa x Aa",
    });
    expect(v.kind).toBe("punnett");
    if (v.kind !== "punnett") throw new Error("expected punnett");
    expect(v.parentA).toEqual(["A", "a"]);
    expect(v.dominant).toBe("A");
  });

  it("refuses a cross it can't read rather than guessing alleles", () => {
    // Two different genes is a dihybrid cross — a different square entirely.
    expect(selectConceptVisual({ conceptSlug: "genetics-inheritance", originalExpression: "Aa x Bb" }).kind).toBe(
      "none"
    );
    expect(selectConceptVisual({ conceptSlug: "genetics-inheritance", originalExpression: "no cross here" }).kind).toBe(
      "none"
    );
  });

  it("shows the direction of photosynthesis, the usual confusion", () => {
    const v = selectConceptVisual({ conceptSlug: "photosynthesis", originalExpression: "" });
    expect(v.kind).toBe("process-flow");
    if (v.kind !== "process-flow") throw new Error("expected process-flow");
    expect(v.inputs).toContain("Carbon dioxide");
    expect(v.outputs).toContain("Glucose");
    expect(v.energy?.direction).toBe("stores");
  });

  it("shows respiration as the opposite direction", () => {
    const v = selectConceptVisual({ conceptSlug: "respiration", originalExpression: "" });
    if (v.kind !== "process-flow") throw new Error("expected process-flow");
    expect(v.inputs).toContain("Glucose");
    expect(v.energy?.direction).toBe("releases");
  });

  it("still returns none for a concept with no safe deterministic diagram", () => {
    expect(selectConceptVisual({ conceptSlug: "atomic-structure", originalExpression: "x" }).kind).toBe("none");
  });
});
