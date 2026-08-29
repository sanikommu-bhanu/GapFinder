import { describe, it, expect } from "vitest";
import {
  summariseEvidence,
  weightOf,
  deriveIndependence,
  evidenceFromAttempt,
  type Evidence,
} from "@/lib/learner/evidence";

const NOW = new Date("2026-01-01T00:00:00Z").getTime();

function ev(overrides: Partial<Evidence> = {}): Evidence {
  return {
    kind: "answer_result",
    source: "practice",
    concept: "inverse-operations",
    isPositive: true,
    independence: "independent",
    difficulty: "challenge",
    observedAt: new Date(NOW),
    note: "",
    ...overrides,
  };
}

describe("evidence weighting", () => {
  it("counts an independent transfer success above a plain right answer", () => {
    const transfer = weightOf(ev({ kind: "transfer", difficulty: "transfer" }));
    const answer = weightOf(ev({ kind: "answer_result", difficulty: "challenge" }));
    expect(transfer).toBeGreaterThan(answer);
  });

  it("discounts a success that needed hints", () => {
    const independent = weightOf(ev({ independence: "independent" }));
    const assisted = weightOf(ev({ independence: "assisted" }));
    const guided = weightOf(ev({ independence: "guided" }));
    expect(independent).toBeGreaterThan(assisted);
    expect(assisted).toBeGreaterThan(guided);
  });

  it("does NOT discount a failure for having had help", () => {
    // Struggling with heavy support is strong evidence of a problem, not weak
    // evidence. Discounting it would slow the model exactly when it matters.
    const guidedFailure = weightOf(ev({ isPositive: false, independence: "guided" }));
    const independentFailure = weightOf(ev({ isPositive: false, independence: "independent" }));
    expect(guidedFailure).toBe(independentFailure);
  });

  it("weights reasoning quality above the answer result", () => {
    expect(weightOf(ev({ kind: "reasoning_quality" }))).toBeGreaterThan(
      weightOf(ev({ kind: "answer_result" }))
    );
  });
});

describe("deriveIndependence", () => {
  it("reads a clean first attempt as independent", () => {
    expect(deriveIndependence({ attemptIndex: 1 })).toBe("independent");
  });

  it("reads a second attempt as assisted", () => {
    expect(deriveIndependence({ attemptIndex: 2 })).toBe("assisted");
  });

  it("reads a third attempt as guided", () => {
    expect(deriveIndependence({ attemptIndex: 3 })).toBe("guided");
  });

  it("treats hints as reducing independence even on a first attempt", () => {
    expect(deriveIndependence({ attemptIndex: 1, hintsUsed: 1 })).toBe("assisted");
    expect(deriveIndependence({ attemptIndex: 1, hintsUsed: 2 })).toBe("guided");
  });
});

describe("evidenceFromAttempt", () => {
  it("separates the answer result from the reasoning result", () => {
    // The case this whole model exists for: right answer, broken step.
    const out = evidenceFromAttempt({
      concept: "inverse-operations",
      source: "practice",
      isCorrect: true,
      reasoningValid: false,
      independence: "independent",
      difficulty: "challenge",
      observedAt: new Date(NOW),
    });

    expect(out).toHaveLength(2);
    const answer = out.find((e) => e.kind === "answer_result")!;
    const reasoning = out.find((e) => e.kind === "reasoning_quality")!;
    expect(answer.isPositive).toBe(true);
    expect(reasoning.isPositive).toBe(false);
  });

  it("emits no reasoning verdict when reasoning was not checked", () => {
    // An unverified step is not a wrong step.
    const out = evidenceFromAttempt({
      concept: "inverse-operations",
      source: "practice",
      isCorrect: false,
      reasoningValid: null,
      independence: "independent",
      difficulty: "repair",
    });
    expect(out.every((e) => e.kind !== "reasoning_quality")).toBe(true);
  });

  it("labels a transfer-sourced attempt as transfer evidence", () => {
    const out = evidenceFromAttempt({
      concept: "inverse-operations",
      source: "transfer",
      isCorrect: true,
      independence: "independent",
      difficulty: "transfer",
    });
    expect(out[0]!.kind).toBe("transfer");
  });
});

describe("summariseEvidence", () => {
  it("returns a zeroed, zero-confidence summary for no evidence", () => {
    const s = summariseEvidence([], NOW);
    expect(s.count).toBe(0);
    expect(s.confidence).toBe(0);
    expect(s.positiveShare).toBe(0);
  });

  it("grows confidence with the amount of evidence, and saturates", () => {
    const few = summariseEvidence([ev(), ev()], NOW);
    const many = summariseEvidence(Array.from({ length: 20 }, () => ev()), NOW);
    expect(many.confidence).toBeGreaterThan(few.confidence);
    expect(many.confidence).toBeLessThanOrEqual(1);
  });

  it("weights recent evidence above old evidence", () => {
    const oldPositive = ev({
      isPositive: true,
      observedAt: new Date(NOW - 90 * 86_400_000),
    });
    const recentNegative = ev({ isPositive: false, observedAt: new Date(NOW) });
    const s = summariseEvidence([oldPositive, recentNegative], NOW);
    // The stale success must not outvote today's failure.
    expect(s.positiveShare).toBeLessThan(0.5);
  });

  it("detects that a student has only ever succeeded with help", () => {
    const s = summariseEvidence(
      [ev({ independence: "assisted" }), ev({ independence: "guided" })],
      NOW
    );
    expect(s.onlySucceedsWithHelp).toBe(true);
  });

  it("clears that flag once there is one unaided success", () => {
    const s = summariseEvidence(
      [ev({ independence: "assisted" }), ev({ independence: "independent" })],
      NOW
    );
    expect(s.onlySucceedsWithHelp).toBe(false);
  });

  it("does not claim assisted-only success when there are no successes at all", () => {
    const s = summariseEvidence([ev({ isPositive: false, independence: "guided" })], NOW);
    expect(s.onlySucceedsWithHelp).toBe(false);
  });

  it("records an independent transfer success", () => {
    const s = summariseEvidence(
      [ev({ kind: "transfer", independence: "independent", difficulty: "transfer" })],
      NOW
    );
    expect(s.hasIndependentTransfer).toBe(true);
  });

  it("does not count an assisted transfer as independent transfer evidence", () => {
    const s = summariseEvidence(
      [ev({ kind: "transfer", independence: "assisted", difficulty: "transfer" })],
      NOW
    );
    expect(s.hasIndependentTransfer).toBe(false);
  });

  it("surfaces a gap between right answers and broken reasoning", () => {
    const s = summariseEvidence(
      [
        ev({ kind: "answer_result", isPositive: true }),
        ev({ kind: "answer_result", isPositive: true }),
        ev({ kind: "reasoning_quality", isPositive: false }),
        ev({ kind: "reasoning_quality", isPositive: false }),
      ],
      NOW
    );
    // Answers perfect, reasoning entirely wrong: the maximum disagreement.
    expect(s.answerReasoningGap).toBeCloseTo(1, 5);
  });

  it("claims no answer/reasoning gap when only one of the two was observed", () => {
    const s = summariseEvidence([ev({ kind: "answer_result", isPositive: true })], NOW);
    expect(s.answerReasoningGap).toBe(0);
  });
});
