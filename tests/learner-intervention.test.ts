import { describe, it, expect } from "vitest";
import { selectIntervention, type InterventionInput } from "@/lib/learner/intervention";
import { summariseEvidence, type Evidence } from "@/lib/learner/evidence";

const NOW = new Date("2026-01-01T00:00:00Z").getTime();

function evidence(items: Partial<Evidence>[] = []) {
  return summariseEvidence(
    items.map((o) => ({
      kind: "answer_result",
      source: "practice",
      concept: "inverse-operations",
      isPositive: true,
      independence: "independent",
      difficulty: "challenge",
      observedAt: new Date(NOW),
      note: "",
      ...o,
    })) as Evidence[],
    NOW
  );
}

function input(overrides: Partial<InterventionInput> = {}): InterventionInput {
  return {
    masteryScore: 50,
    evidence: evidence(),
    recurrenceCount: 1,
    weakestPrerequisiteScore: null,
    weakestPrerequisiteName: null,
    isArithmeticSlip: false,
    lastAttemptWasCorrect: false,
    interventionHistory: [],
    ...overrides,
  };
}

describe("intervention precedence", () => {
  it("sends the student to the prerequisite when one is not met", () => {
    const d = selectIntervention(
      input({ weakestPrerequisiteScore: 30, weakestPrerequisiteName: "Fractions" })
    );
    expect(d.action).toBe("prerequisite_review");
    expect(d.rule).toBe("prerequisite_not_met");
    expect(d.reason).toContain("Fractions");
  });

  it("puts a missing prerequisite above a recurring misconception", () => {
    // Ordering is the design: teaching on top of a hole cannot land.
    const d = selectIntervention(
      input({ weakestPrerequisiteScore: 20, recurrenceCount: 5, weakestPrerequisiteName: "Fractions" })
    );
    expect(d.rule).toBe("prerequisite_not_met");
  });

  it("does not send a mastered student backwards over a weak prerequisite", () => {
    const d = selectIntervention(
      input({ masteryScore: 95, weakestPrerequisiteScore: 30, lastAttemptWasCorrect: true })
    );
    expect(d.action).not.toBe("prerequisite_review");
  });

  it("changes strategy once a misconception is persistent", () => {
    const d = selectIntervention(input({ recurrenceCount: 3 }));
    expect(d.action).toBe("prerequisite_review");
    expect(d.rule).toBe("persistent_misconception");
  });

  it("shows a worked example on the second occurrence rather than re-explaining", () => {
    const d = selectIntervention(input({ recurrenceCount: 2 }));
    expect(d.action).toBe("worked_example");
    expect(d.rule).toBe("recurring_misconception");
  });

  it("explains once on a first conceptual error", () => {
    const d = selectIntervention(input({ recurrenceCount: 1 }));
    expect(d.action).toBe("concise_explanation");
    expect(d.rule).toBe("first_conceptual_error");
  });

  it("does not explain the same concept twice", () => {
    const d = selectIntervention(
      input({ recurrenceCount: 1, interventionHistory: ["concise_explanation"] })
    );
    expect(d.action).toBe("worked_example");
    expect(d.rule).toBe("explanation_already_tried");
  });

  it("gives a hint, not a lesson, for an arithmetic slip", () => {
    const d = selectIntervention(input({ isArithmeticSlip: true }));
    expect(d.action).toBe("targeted_hint");
    expect(d.rule).toBe("arithmetic_slip");
  });

  it("steps down to an easier diagnostic after repeated failure on a fragile concept", () => {
    const d = selectIntervention(
      input({
        masteryScore: 20,
        isArithmeticSlip: false,
        evidence: evidence([{ isPositive: false }, { isPositive: false }, { isPositive: false }]),
      })
    );
    expect(d.action).toBe("easier_diagnostic");
    expect(d.rule).toBe("repeated_failure");
  });
});

describe("intervention when nothing is wrong", () => {
  it("demands transfer evidence before calling a run of right answers mastery", () => {
    // Section 10: repeating the same pattern is not mastery.
    const d = selectIntervention(
      input({ masteryScore: 75, lastAttemptWasCorrect: true, evidence: evidence([{}, {}]) })
    );
    expect(d.action).toBe("transfer_problem");
    expect(d.rule).toBe("needs_transfer_evidence");
  });

  it("confirms mastery only once an independent transfer has landed", () => {
    const d = selectIntervention(
      input({
        masteryScore: 95,
        lastAttemptWasCorrect: true,
        evidence: evidence([
          { kind: "transfer", independence: "independent", difficulty: "transfer" },
        ]),
      })
    );
    expect(d.action).toBe("mastery_check");
    expect(d.rule).toBe("mastery_candidate");
  });

  it("does not confirm mastery on a high score alone", () => {
    const d = selectIntervention(
      input({ masteryScore: 95, lastAttemptWasCorrect: true, evidence: evidence([{}]) })
    );
    expect(d.action).not.toBe("mastery_check");
  });

  it("prescribes independent practice when every success so far involved help", () => {
    const d = selectIntervention(
      input({
        masteryScore: 45,
        lastAttemptWasCorrect: true,
        evidence: evidence([{ independence: "assisted" }, { independence: "guided" }]),
      })
    );
    expect(d.action).toBe("targeted_practice");
    expect(d.rule).toBe("assisted_success_only");
  });
});

describe("intervention determinism and totality", () => {
  it("returns the same decision for the same input", () => {
    const i = input({ recurrenceCount: 2 });
    expect(selectIntervention(i)).toEqual(selectIntervention(i));
  });

  it("always produces an action, a rule and a reason", () => {
    const matrix: Partial<InterventionInput>[] = [
      {},
      { masteryScore: 0 },
      { masteryScore: 100, lastAttemptWasCorrect: true },
      { recurrenceCount: 0 },
      { recurrenceCount: 9 },
      { isArithmeticSlip: true, lastAttemptWasCorrect: true },
      { weakestPrerequisiteScore: 59 },
      { weakestPrerequisiteScore: 60 },
    ];
    for (const m of matrix) {
      const d = selectIntervention(input(m));
      expect(d.action).toBeTruthy();
      expect(d.rule).toBeTruthy();
      expect(d.reason.length).toBeGreaterThan(0);
      expect(d.confidence).toBeGreaterThanOrEqual(0);
      expect(d.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("raises confidence as evidence accumulates", () => {
    const thin = selectIntervention(input({ evidence: evidence([{}]) }));
    const thick = selectIntervention(
      input({ evidence: evidence(Array.from({ length: 15 }, () => ({}))) })
    );
    expect(thick.confidence).toBeGreaterThan(thin.confidence);
  });

  it("treats the prerequisite threshold as exclusive at the boundary", () => {
    expect(selectIntervention(input({ weakestPrerequisiteScore: 60 })).rule).not.toBe(
      "prerequisite_not_met"
    );
    expect(selectIntervention(input({ weakestPrerequisiteScore: 59 })).rule).toBe(
      "prerequisite_not_met"
    );
  });
});
