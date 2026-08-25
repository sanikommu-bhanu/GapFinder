import { describe, it, expect } from "vitest";
import { judgeConcept, examScore } from "@/lib/exam/verdict";

const q = (isCorrect: boolean, reasoningValid = isCorrect, misconceptionCode: string | null = null) => ({
  conceptId: "c1",
  isCorrect,
  reasoningValid,
  misconceptionCode,
});

const judge = (outcomes: ReturnType<typeof q>[], prior: string[] = []) =>
  judgeConcept({ conceptId: "c1", conceptName: "Distribution", outcomes, priorMisconceptionCodes: prior });

/**
 * The single property worth protecting here: mastery is a claim about a
 * student, and claiming it on thin evidence is the fastest way to make the
 * whole product untrustworthy.
 */
describe("judgeConcept", () => {
  it("refuses to call one correct answer mastery", () => {
    const result = judge([q(true)]);
    expect(result.verdict).toBe("uncertain");
    expect(result.because).toMatch(/lucky guess/i);
  });

  it("says nothing at all when nothing was answered", () => {
    expect(judge([]).verdict).toBe("uncertain");
  });

  it("awards mastery only when every answer is right AND soundly reasoned", () => {
    const result = judge([q(true), q(true)]);
    expect(result.verdict).toBe("mastered");
    expect(result.because).toMatch(/no help available/i);
  });

  it("does not award mastery for right answers reached through broken reasoning", () => {
    // Correct destination, invalid route — that is not a repaired gap.
    const result = judge([q(true, false), q(true, false)]);
    expect(result.verdict).not.toBe("mastered");
  });

  it("treats a returning misconception as decisive, whatever the score", () => {
    const result = judge([q(true), q(false, false, "M-DISTRIBUTE-NEGATIVE")], ["M-DISTRIBUTE-NEGATIVE"]);
    expect(result.verdict).toBe("needs_reinforcement");
    expect(result.recurringCodes).toContain("M-DISTRIBUTE-NEGATIVE");
    expect(result.because).toMatch(/came back/i);
  });

  it("ignores a misconception the student has no history of", () => {
    // New error, not a relapse — it shouldn't be reported as one.
    const result = judge([q(true), q(false, false, "M-ARITHMETIC-SLIP")], ["M-TRANSPOSE-SIGN"]);
    expect(result.recurringCodes).toHaveLength(0);
  });

  it("separates an arithmetic slip from a misconception", () => {
    // Reasoning held throughout; only the numbers came out wrong. That is a
    // different problem from the one that was repaired.
    const result = judge([q(true, true), q(false, true)]);
    expect(result.verdict).toBe("uncertain");
    expect(result.because).toMatch(/arithmetic slipped/i);
  });

  it("calls consistent failure what it is", () => {
    const result = judge([q(false, false), q(false, false)]);
    expect(result.verdict).toBe("needs_reinforcement");
  });

  it("never reports UNCLASSIFIED as a recurring misconception", () => {
    const result = judge([q(false, false, "UNCLASSIFIED"), q(false, false, "UNCLASSIFIED")], ["UNCLASSIFIED"]);
    expect(result.recurringCodes).toHaveLength(0);
  });
});

describe("examScore", () => {
  it("counts only answers that were both right and soundly reasoned", () => {
    const results = [
      judge([q(true), q(true)]),
      judge([q(true, false), q(false, false)]),
    ];
    // Two fully sound out of four answered.
    expect(examScore(results)).toBe(50);
  });

  it("is zero rather than NaN when nothing was answered", () => {
    expect(examScore([judge([])])).toBe(0);
  });
});
