import { describe, it, expect } from "vitest";
import { verifyAndFindDivergence } from "@/lib/ai/pipeline/verify-and-find-divergence";
import { checkStudentWork } from "@/lib/verification/check-student-work";
import { classifyGapOffline } from "@/lib/ai/pipeline/classify-gap-offline";

const steps = (...expressions: string[]) =>
  expressions.map((expression, i) => ({ order: i + 1, statement: expression, expression }));

describe("verifyAndFindDivergence", () => {
  it("marks the first invalid transition and nothing earlier", () => {
    const result = verifyAndFindDivergence(steps("2x + 7 = 15", "2x = 15 + 7", "2x = 22", "x = 11"));
    expect(result.filter((s) => s.isFirstGap)).toHaveLength(1);
    expect(result.find((s) => s.isFirstGap)?.order).toBe(2);
    expect(result[0]!.isValid).toBe(true);
  });

  it("attaches the algebraically derived correction to the divergence", () => {
    const result = verifyAndFindDivergence(steps("2x + 7 = 15", "2x = 15 + 7"));
    expect(result[1]!.correctedExpression).toBe("2x = 15 - 7");
  });

  it("finds no gap when every step follows", () => {
    const result = verifyAndFindDivergence(steps("4x - 9 = 27", "4x = 36", "x = 9"));
    expect(result.some((s) => s.isFirstGap)).toBe(false);
    expect(result.every((s) => s.isValid)).toBe(true);
  });

  it("marks only the FIRST break when a student makes two", () => {
    const result = verifyAndFindDivergence(steps("2x + 6 = 10", "2x = 16", "x = 3"));
    const gaps = result.filter((s) => s.isFirstGap);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]!.order).toBe(2);
  });

  it("treats the first step as the starting point, never a gap", () => {
    const result = verifyAndFindDivergence(steps("2x + 7 = 15"));
    expect(result[0]!.isFirstGap).toBe(false);
    expect(result[0]!.correctedExpression).toBeNull();
  });

  it("orders steps before verifying, so shuffled input still works", () => {
    const shuffled = [
      { order: 3, statement: "x = 11", expression: "x = 11" },
      { order: 1, statement: "2x + 7 = 15", expression: "2x + 7 = 15" },
      { order: 2, statement: "2x = 15 + 7", expression: "2x = 15 + 7" },
    ];
    expect(verifyAndFindDivergence(shuffled).find((s) => s.isFirstGap)?.order).toBe(2);
  });
});

describe("checkStudentWork", () => {
  const answer = "x = 9";
  const problem = "2x + 11 = 29";

  it("catches an error on the student's very first move", () => {
    const result = checkStudentWork("2x = 29 + 11\n2x = 40\nx = 20", answer, problem);
    expect(result.isCorrect).toBe(false);
    expect(result.firstErrorLine).toBe(1);
    expect(result.correctedExpression).toBe("2x = 29 - 11");
  });

  it("does not double-count a restated problem line", () => {
    const result = checkStudentWork("2x + 11 = 29\n2x = 29 + 11\nx = 20", answer, problem);
    expect(result.firstErrorLine).toBe(2);
  });

  it("accepts fully correct working", () => {
    const result = checkStudentWork("2x = 29 - 11\n2x = 18\nx = 9", answer, problem);
    expect(result.isCorrect).toBe(true);
    expect(result.firstErrorLine).toBeNull();
  });

  it("separates valid reasoning from a final arithmetic slip", () => {
    const result = checkStudentWork("2x = 29 - 11\n2x = 18\nx = 10", answer, problem);
    expect(result.isCorrect).toBe(false);
    expect(result.feedback).toMatch(/x = 9/);
  });

  it("accepts a bare correct answer but asks for working", () => {
    const result = checkStudentWork("x = 9", answer, problem);
    expect(result.isCorrect).toBe(true);
    expect(result.feedback).toMatch(/steps/i);
  });

  it("flags prose as unparseable instead of marking it wrong", () => {
    const result = checkStudentWork("I think it is nine", answer, problem);
    expect(result.unparseable).toBe(true);
  });
});

describe("classifyGapOffline", () => {
  const concepts = [
    { slug: "equations", name: "Equations" },
    { slug: "sign-handling", name: "Sign Handling" },
    { slug: "inverse-operations", name: "Inverse Operations" },
  ];

  it("names a sign error when a term crossed without inverting", () => {
    const verified = verifyAndFindDivergence(steps("2x + 7 = 15", "2x = 15 + 7"));
    const result = classifyGapOffline({
      divergence: verified[1]!,
      previousExpression: "2x + 7 = 15",
      availableConcepts: concepts,
    });
    expect(result.classification).toBe("sign-error");
    expect(result.conceptSlug).toBe("sign-handling");
    expect(result.confidence).toBe("medium");
  });

  it("names a misapplied inverse when only one side was divided", () => {
    const verified = verifyAndFindDivergence(steps("3x = 12", "x = 12"));
    const result = classifyGapOffline({
      divergence: verified[1]!,
      previousExpression: "3x = 12",
      availableConcepts: concepts,
    });
    expect(result.classification).toBe("inverse-operation-misapplied");
    expect(result.conceptSlug).toBe("inverse-operations");
  });

  it("never claims high confidence without a model in the loop", () => {
    const verified = verifyAndFindDivergence(steps("2x + 7 = 15", "2x = 15 + 7"));
    const result = classifyGapOffline({
      divergence: verified[1]!,
      previousExpression: "2x + 7 = 15",
      availableConcepts: concepts,
    });
    expect(result.confidence).not.toBe("high");
  });

  it("falls back to an available concept when its first choice isn't seeded", () => {
    const verified = verifyAndFindDivergence(steps("2x + 7 = 15", "2x = 15 + 7"));
    const result = classifyGapOffline({
      divergence: verified[1]!,
      previousExpression: "2x + 7 = 15",
      availableConcepts: [{ slug: "algebra", name: "Algebra" }],
    });
    expect(result.conceptSlug).toBe("algebra");
  });
});
