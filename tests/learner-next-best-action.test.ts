import { describe, it, expect } from "vitest";
import {
  decideNextBestAction,
  type ConceptSnapshot,
  type LearnerSnapshot,
} from "@/lib/learner/next-best-action";
import type { Evidence } from "@/lib/learner/evidence";

const NOW = new Date("2026-01-01T00:00:00Z").getTime();

function concept(overrides: Partial<ConceptSnapshot> = {}): ConceptSnapshot {
  return {
    conceptId: "c1",
    slug: "inverse-operations",
    name: "Inverse Operations",
    masteryScore: 50,
    prerequisiteIds: [],
    hasOpenGap: false,
    recurrenceCount: 0,
    isArithmeticSlip: false,
    lastAttemptWasCorrect: false,
    interventionHistory: [],
    evidence: [],
    recentAttempts: [],
    ...overrides,
  };
}

function positive(n: number): Evidence[] {
  return Array.from({ length: n }, () => ({
    kind: "answer_result" as const,
    source: "practice" as const,
    concept: "inverse-operations",
    isPositive: true,
    independence: "independent" as const,
    difficulty: "challenge" as const,
    observedAt: new Date(NOW),
    note: "",
  }));
}

function snapshot(concepts: ConceptSnapshot[], unlocked?: string[]): LearnerSnapshot {
  return {
    concepts,
    unlockedConceptIds: unlocked ?? concepts.map((c) => c.conceptId),
  };
}

describe("concept selection", () => {
  it("returns an honest empty result when nothing is unlocked", () => {
    const out = decideNextBestAction(snapshot([concept()], []), NOW);
    expect(out.action).toBe("choose_concept");
    expect(out.targetConcept).toBeNull();
    expect(out.confidence).toBe(0);
  });

  it("prioritises a concept with an open gap over a merely weak one", () => {
    const out = decideNextBestAction(
      snapshot([
        concept({ conceptId: "weak", name: "Weak", masteryScore: 20 }),
        concept({ conceptId: "gap", name: "Gap", masteryScore: 65, hasOpenGap: true }),
      ]),
      NOW
    );
    expect(out.targetConcept?.conceptId).toBe("gap");
  });

  it("prioritises the recurring gap among several open gaps", () => {
    const out = decideNextBestAction(
      snapshot([
        concept({ conceptId: "once", name: "Once", hasOpenGap: true, recurrenceCount: 1 }),
        concept({ conceptId: "again", name: "Again", hasOpenGap: true, recurrenceCount: 4 }),
      ]),
      NOW
    );
    expect(out.targetConcept?.conceptId).toBe("again");
  });

  it("never recommends a locked concept", () => {
    const out = decideNextBestAction(
      snapshot(
        [
          concept({ conceptId: "locked", name: "Locked", masteryScore: 0, hasOpenGap: true }),
          concept({ conceptId: "open", name: "Open", masteryScore: 55 }),
        ],
        ["open"]
      ),
      NOW
    );
    expect(out.targetConcept?.conceptId).toBe("open");
  });

  it("deprioritises a concept already at mastery", () => {
    const out = decideNextBestAction(
      snapshot([
        concept({ conceptId: "done", name: "Done", masteryScore: 95 }),
        concept({ conceptId: "todo", name: "Todo", masteryScore: 55 }),
      ]),
      NOW
    );
    expect(out.targetConcept?.conceptId).toBe("todo");
  });
});

describe("prerequisite retargeting", () => {
  it("points the student at the prerequisite, not the concept that surfaced it", () => {
    const out = decideNextBestAction(
      snapshot([
        concept({
          conceptId: "solving",
          name: "Solving Equations",
          masteryScore: 40,
          hasOpenGap: true,
          prerequisiteIds: ["fractions"],
        }),
        concept({
          conceptId: "fractions",
          name: "Fractions",
          masteryScore: 25,
          evidence: positive(1),
        }),
      ]),
      NOW
    );
    expect(out.action).toBe("prerequisite_review");
    // The actionable part: the recommendation names Fractions to work on.
    expect(out.targetConcept?.conceptId).toBe("fractions");
    expect(out.difficulty).toBe("repair");
  });

  it("does not treat an unassessed prerequisite as a hole", () => {
    // A brand-new student has zero mastery everywhere. Reading that as a gap
    // would send every newcomer backwards on their first submission.
    const out = decideNextBestAction(
      snapshot([
        concept({
          conceptId: "solving",
          name: "Solving Equations",
          masteryScore: 45,
          hasOpenGap: true,
          prerequisiteIds: ["fractions"],
        }),
        concept({ conceptId: "fractions", name: "Fractions", masteryScore: 0, evidence: [] }),
      ]),
      NOW
    );
    expect(out.action).not.toBe("prerequisite_review");
  });
});

describe("action-implied difficulty", () => {
  it("uses transfer difficulty for a transfer problem", () => {
    const out = decideNextBestAction(
      snapshot([
        concept({
          masteryScore: 75,
          lastAttemptWasCorrect: true,
          evidence: positive(3),
          recentAttempts: [{ isCorrect: true }, { isCorrect: true }],
        }),
      ]),
      NOW
    );
    expect(out.action).toBe("transfer_problem");
    expect(out.difficulty).toBe("transfer");
  });

  it("uses warmup difficulty for an easier diagnostic", () => {
    const negatives: Evidence[] = positive(3).map((e) => ({ ...e, isPositive: false }));
    const out = decideNextBestAction(
      snapshot([concept({ masteryScore: 15, hasOpenGap: true, evidence: negatives })]),
      NOW
    );
    expect(out.action).toBe("easier_diagnostic");
    expect(out.difficulty).toBe("warmup");
  });
});

describe("output contract", () => {
  it("always returns a structured, explainable decision", () => {
    const out = decideNextBestAction(
      snapshot([concept({ hasOpenGap: true, recurrenceCount: 2 })]),
      NOW
    );
    expect(out.action).toBeTruthy();
    expect(out.rule).toBeTruthy();
    expect(out.reason.length).toBeGreaterThan(0);
    expect(out.evidence.length).toBeGreaterThan(0);
    expect(out.difficulty).toBeTruthy();
    expect(out.confidence).toBeGreaterThanOrEqual(0);
    expect(out.confidence).toBeLessThanOrEqual(1);
  });

  it("is deterministic across repeated runs", () => {
    const s = snapshot([concept({ hasOpenGap: true, recurrenceCount: 2, evidence: positive(2) })]);
    expect(decideNextBestAction(s, NOW)).toEqual(decideNextBestAction(s, NOW));
  });

  it("states plainly when there are no observations yet", () => {
    const out = decideNextBestAction(snapshot([concept({ hasOpenGap: true })]), NOW);
    expect(out.evidence.join(" ")).toContain("No prior observations");
  });
});
