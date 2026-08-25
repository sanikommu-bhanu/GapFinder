import { describe, it, expect } from "vitest";
import {
  buildDeterministicProblem,
  validateGeneratedProblem,
  extractEquation,
} from "@/lib/ai/fallback/practice-templates";
import { selectDifficulty } from "@/lib/ai/pipeline/select-intervention";
import { computeMasteryUpdate } from "@/lib/ai/pipeline/update-mastery";
import { scoreTeachBackOffline } from "@/lib/ai/fallback/offline-rubric";
import { solveLinear } from "@/lib/math/solve-step";

/**
 * The validator is the guarantee that a student is never shown a problem whose
 * stated answer is wrong — including one a language model invented.
 */
describe("validateGeneratedProblem", () => {
  it("accepts a problem whose answer is genuinely its answer", () => {
    expect(validateGeneratedProblem("3x + 8 = 26", "x = 6")).toBe(true);
  });

  it("rejects a problem whose stated answer is wrong", () => {
    expect(validateGeneratedProblem("3x + 8 = 26", "x = 7")).toBe(false);
  });

  it("rejects a problem it cannot solve, rather than trusting it", () => {
    expect(validateGeneratedProblem("Two trains leave a station", "x = 5")).toBe(false);
  });

  it("accepts an equation wrapped in framing words", () => {
    expect(validateGeneratedProblem("Solve for n: 5n + 7 = 47", "n = 8")).toBe(true);
  });
});

describe("extractEquation", () => {
  it("returns a bare equation unchanged", () => {
    expect(solveLinear(extractEquation("2x + 7 = 15")!)).toBe(4);
  });

  it("finds the equation inside a framed prompt", () => {
    expect(solveLinear(extractEquation("Solve for x: 4x - 8 = 16")!)).toBe(6);
  });

  it("returns null when there is no equation at all", () => {
    expect(extractEquation("Explain why this works")).toBeNull();
  });
});

describe("buildDeterministicProblem", () => {
  it("produces a problem whose answer validates", () => {
    const problem = buildDeterministicProblem({
      conceptSlug: "sign-handling",
      difficulty: "repair",
      mode: "repair",
      seed: "gap-1",
    });
    expect(problem).not.toBeNull();
    expect(validateGeneratedProblem(problem!.prompt, problem!.correctAnswer)).toBe(true);
  });

  it("changes the surface form for transfer, not the reasoning", () => {
    const repair = buildDeterministicProblem({
      conceptSlug: "sign-handling",
      difficulty: "repair",
      mode: "repair",
      seed: "gap-1",
    });
    const transfer = buildDeterministicProblem({
      conceptSlug: "sign-handling",
      difficulty: "transfer",
      mode: "transfer",
      seed: "gap-1",
    });
    expect(transfer!.prompt).not.toBe(repair!.prompt);
    // A different variable letter is the visible difference that stops a
    // student pattern-matching the original layout.
    expect(transfer!.prompt).not.toMatch(/x/);
  });

  it("avoids handing back a problem the student just saw", () => {
    const first = buildDeterministicProblem({
      conceptSlug: "sign-handling",
      difficulty: "repair",
      mode: "repair",
      seed: "gap-1",
    })!;
    const second = buildDeterministicProblem({
      conceptSlug: "sign-handling",
      difficulty: "repair",
      mode: "repair",
      seed: "gap-1",
      avoidPrompts: [first.prompt],
    })!;
    expect(second.prompt).not.toBe(first.prompt);
  });

  it("is stable for the same seed, so a refresh doesn't shuffle the problem", () => {
    const args = { conceptSlug: "equations", difficulty: "repair", mode: "repair", seed: "gap-9" } as const;
    expect(buildDeterministicProblem(args)!.prompt).toBe(buildDeterministicProblem(args)!.prompt);
  });

  it("labels its own output as locally generated", () => {
    const problem = buildDeterministicProblem({
      conceptSlug: "equations",
      difficulty: "repair",
      mode: "repair",
      seed: "s",
    });
    expect(problem!.source).toBe("deterministic");
  });
});

describe("selectDifficulty", () => {
  it("starts at repair for a first encounter", () => {
    expect(selectDifficulty({ currentMasteryScore: 0, recentAttempts: [], isFirstEncounter: true })).toBe("repair");
  });

  it("stays at repair while the student keeps missing", () => {
    expect(
      selectDifficulty({
        currentMasteryScore: 30,
        recentAttempts: [{ isCorrect: false }, { isCorrect: false }, { isCorrect: false }],
        isFirstEncounter: false,
      })
    ).toBe("repair");
  });

  it("climbs to mastery once the evidence supports it", () => {
    expect(
      selectDifficulty({
        currentMasteryScore: 95,
        recentAttempts: [{ isCorrect: true }, { isCorrect: true }, { isCorrect: true }],
        isFirstEncounter: false,
      })
    ).toBe("mastery");
  });
});

describe("computeMasteryUpdate", () => {
  it("weights a transfer success above a practice success", () => {
    const practice = computeMasteryUpdate({ currentScore: 50, event: "practice_correct" });
    const transfer = computeMasteryUpdate({ currentScore: 50, event: "transfer_correct" });
    expect(transfer.newScore).toBeGreaterThan(practice.newScore);
  });

  it("drops the score when a gap is found", () => {
    expect(computeMasteryUpdate({ currentScore: 60, event: "gap_found" }).trend).toBe("down");
  });

  it("stays inside 0-100 at both extremes", () => {
    expect(computeMasteryUpdate({ currentScore: 0, event: "gap_found" }).newScore).toBeGreaterThanOrEqual(0);
    expect(computeMasteryUpdate({ currentScore: 100, event: "transfer_correct" }).newScore).toBeLessThanOrEqual(100);
  });

  it("moves toward the rubric score on a teach-back", () => {
    const result = computeMasteryUpdate({ currentScore: 40, event: "teach_back", teachBackRubricScore: 90 });
    expect(result.newScore).toBeGreaterThan(40);
    expect(result.newScore).toBeLessThan(90);
  });
});

describe("scoreTeachBackOffline", () => {
  it("scores a complete explanation highly", () => {
    const result = scoreTeachBackOffline({
      studentExplanation:
        "I subtracted 7 from both sides because whatever I do to one side I have to do to the other to keep it balanced. Last time I added instead, which broke that.",
      conceptName: "Sign Handling",
    });
    expect(result.rubricScore).toBeGreaterThanOrEqual(75);
  });

  it("caps a two-word answer no matter what words they are", () => {
    const result = scoreTeachBackOffline({ studentExplanation: "subtract both", conceptName: "Sign Handling" });
    expect(result.rubricScore).toBeLessThanOrEqual(40);
  });

  it("always labels itself as the offline rubric", () => {
    expect(scoreTeachBackOffline({ studentExplanation: "because", conceptName: "Equations" }).offline).toBe(true);
  });

  it("reports every rubric criterion, met or not", () => {
    const result = scoreTeachBackOffline({ studentExplanation: "you subtract it", conceptName: "Equations" });
    expect(result.criteriaMet).toHaveLength(4);
    expect(result.criteriaMet.every((c) => typeof c.note === "string" && c.note.length > 0)).toBe(true);
  });
});
