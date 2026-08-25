import { describe, it, expect } from "vitest";
import { auditSolution } from "@/lib/verification/solution-audit";

const audit = (...expressions: string[]) =>
  auditSolution(expressions.map((expression, i) => ({ order: i + 1, expression })));

describe("auditSolution", () => {
  it("passes a fully correct solution", () => {
    const result = audit("4x - 9 = 27", "4x = 36", "x = 9");
    expect(result.isFullyCorrect).toBe(true);
    expect(result.steps.every((s) => s.verdict === "correct")).toBe(true);
    expect(result.firstDivergenceOrder).toBeNull();
  });

  it("separates one root mistake from the steps that inherit it", () => {
    // Sign error at step 2; steps 3 and 4 are worked correctly FROM that error.
    const result = audit("2x + 7 = 15", "2x = 15 + 7", "2x = 22", "x = 11");

    expect(result.firstDivergenceOrder).toBe(2);
    expect(result.steps[1]!.verdict).toBe("first_divergence");
    expect(result.steps[1]!.correctedExpression).toBe("2x = 15 - 7");
    expect(result.steps[2]!.verdict).toBe("downstream_consequence");
    expect(result.steps[3]!.verdict).toBe("downstream_consequence");
    // One mistake, not three.
    expect(result.independentErrorOrders).toEqual([]);
    expect(result.downstreamCount).toBe(2);
  });

  it("names a second, unrelated mistake as independent", () => {
    // Sign error at step 2, then a fresh arithmetic slip at step 4 that does
    // not follow even from the student's own step 3.
    const result = audit("2x + 7 = 15", "2x = 15 + 7", "2x = 22", "x = 5");

    expect(result.firstDivergenceOrder).toBe(2);
    expect(result.steps[2]!.verdict).toBe("downstream_consequence");
    expect(result.steps[3]!.verdict).toBe("independent_error");
    expect(result.independentErrorOrders).toEqual([4]);
  });

  it("derives the complete correct solution alongside the audit", () => {
    const result = audit("2x + 7 = 15", "2x = 15 + 7", "x = 11");
    expect(result.correctedSolution).toEqual(["2x + 7 = 15", "2x = 15 - 7", "2x = 8", "x = 4"]);
    expect(result.correctFinalAnswer).toBe("x = 4");
  });

  it("marks work it cannot evaluate as uncertain, never as wrong", () => {
    const result = audit("2x + 7 = 15", "some prose the OCR could not read", "x = 4");
    expect(result.steps[1]!.verdict).toBe("uncertain");
    expect(result.independentErrorOrders).not.toContain(2);
  });

  it("audits the distribution error from the reference worksheet", () => {
    // 2(3x-5) - 4(x+2) = 3(x-1) + 7. The student expanded -4(x+2) as -4x + 8
    // and 3(x-1) as 3x - 1; both should be -4x - 8 and 3x - 3.
    //
    // Their own note blames "combining like terms in the 3rd step". It doesn't:
    // the divergence is one line earlier, in the distribution, and every line
    // after it is worked correctly from that bad line. This is exactly the case
    // the product exists for — the student was looking in the wrong place.
    const result = audit(
      "2(3x-5) - 4(x+2) = 3(x-1) + 7",
      "6x - 10 - 4x + 8 = 3x - 1 + 7",
      "2x - 2 = 3x + 6",
      "2x - 3x = 6 + 2",
      "-x = 8",
      "x = -8"
    );

    expect(result.firstDivergenceOrder).toBe(2);
    expect(result.steps[1]!.verdict).toBe("first_divergence");
    // Everything after it follows from their own working — one mistake, not five.
    expect(result.steps.slice(2).every((s) => s.verdict === "downstream_consequence")).toBe(true);
    expect(result.independentErrorOrders).toEqual([]);
    expect(result.correctFinalAnswer).toBe("x = -22");
  });

  it("handles a single-line submission without crashing", () => {
    const result = audit("x = 4");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]!.verdict).toBe("correct");
  });
});
