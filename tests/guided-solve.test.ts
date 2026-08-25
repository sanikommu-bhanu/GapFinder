import { describe, it, expect } from "vitest";
import { buildGuidedPlan, checkGuidedAttempt } from "@/lib/solving/guided-solve";

/**
 * Guided solving must teach, not answer. These pin the two properties that
 * make that true: the plan says what to do without writing the line, and a
 * student's own valid route is accepted even when it isn't the predicted one.
 */
describe("buildGuidedPlan", () => {
  it("breaks a linear equation into ordered moves", () => {
    const plan = buildGuidedPlan("2x + 7 = 15");
    expect(plan.solvable).toBe(true);
    expect(plan.steps.length).toBeGreaterThanOrEqual(2);
    expect(plan.finalAnswer).toBe("x = 4");
  });

  it("names the move without giving away the line", () => {
    const plan = buildGuidedPlan("2x + 7 = 15");
    const first = plan.steps[0]!;
    // The instruction describes the operation; it must not contain the answer.
    expect(first.instruction).toMatch(/move the constant/i);
    expect(first.instruction).not.toContain("2x = 15 - 7");
    expect(first.reason).toMatch(/inverse|sign/i);
  });

  it("recognises brackets and says to expand first", () => {
    const plan = buildGuidedPlan("2(3x-5) - 4(x+2) = 3(x-1) + 7");
    expect(plan.steps[0]!.kind).toBe("expand");
    expect(plan.finalAnswer).toBe("x = -22");
  });

  it("guides a chemical equation element by element", () => {
    const plan = buildGuidedPlan("CH4 + O2 -> CO2 + H2O");
    expect(plan.solvable).toBe(true);
    expect(plan.steps.every((s) => s.kind === "balance")).toBe(true);
    // Carbon is already 1 on each side, so it isn't listed — only elements
    // that actually differ get a step.
    const elements = plan.steps.map((s) => s.instruction.match(/Balance ([A-Z][a-z]?)/)?.[1]);
    expect(elements).not.toContain("C");

    // Oxygen last: it appears in the most compounds, so fixing it early tends
    // to unbalance whatever was just balanced.
    expect(elements[elements.length - 1]).toBe("O");
    expect(plan.steps[0]!.reason).toMatch(/never change a subscript/i);
  });

  it("recognises an already-balanced equation", () => {
    const plan = buildGuidedPlan("2H2 + O2 -> 2H2O");
    expect(plan.steps[0]!.kind).toBe("done");
  });

  it("says plainly when it can't guide a shape", () => {
    const plan = buildGuidedPlan("integrate x^2 dx");
    expect(plan.solvable).toBe(false);
    expect(plan.reason).toBeTruthy();
    expect(plan.steps).toHaveLength(0);
  });
});

describe("checkGuidedAttempt", () => {
  it("accepts the predicted line", () => {
    const result = checkGuidedAttempt({
      previousLine: "2x + 7 = 15",
      attempt: "2x = 15 - 7",
      expected: "2x = 15 - 7",
    });
    expect(result.accepted).toBe(true);
    expect(result.matchedExpected).toBe(true);
  });

  it("accepts a different but valid route", () => {
    // "2x = 8" is the same move already simplified — correct, just not the
    // line the plan happened to predict.
    const result = checkGuidedAttempt({
      previousLine: "2x + 7 = 15",
      attempt: "2x = 8",
      expected: "2x = 15 - 7",
    });
    expect(result.accepted).toBe(true);
    expect(result.matchedExpected).toBe(false);
    expect(result.note).toMatch(/works too/i);
  });

  it("rejects a line that doesn't follow, and says why", () => {
    const result = checkGuidedAttempt({
      previousLine: "2x + 7 = 15",
      attempt: "2x = 15 + 7",
      expected: "2x = 15 - 7",
    });
    expect(result.accepted).toBe(false);
    expect(result.note.length).toBeGreaterThan(10);
  });

  it("asks for working rather than rejecting an empty attempt", () => {
    const result = checkGuidedAttempt({ previousLine: "2x + 7 = 15", attempt: "   ", expected: "2x = 8" });
    expect(result.accepted).toBe(false);
    expect(result.note).toMatch(/write the next line/i);
  });

  it("says it couldn't check prose rather than calling it wrong", () => {
    const result = checkGuidedAttempt({
      previousLine: "2x + 7 = 15",
      attempt: "you subtract seven",
      expected: "2x = 8",
    });
    expect(result.accepted).toBe(false);
    expect(result.note).toMatch(/couldn't check/i);
  });
});
