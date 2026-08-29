import { describe, it, expect } from "vitest";
import { computeMasteryUpdate, NO_TRANSFER_CEILING } from "@/lib/ai/pipeline/update-mastery";

describe("mastery is discounted by how much help was involved", () => {
  it("gives an unaided success more credit than an assisted one", () => {
    const independent = computeMasteryUpdate({
      currentScore: 50,
      event: "practice_correct",
      independence: "independent",
    });
    const assisted = computeMasteryUpdate({
      currentScore: 50,
      event: "practice_correct",
      independence: "assisted",
    });
    const guided = computeMasteryUpdate({
      currentScore: 50,
      event: "practice_correct",
      independence: "guided",
    });

    expect(independent.newScore).toBeGreaterThan(assisted.newScore);
    expect(assisted.newScore).toBeGreaterThanOrEqual(guided.newScore);
  });

  it("does NOT soften a failure because the student had help", () => {
    const guided = computeMasteryUpdate({
      currentScore: 50,
      event: "practice_incorrect",
      independence: "guided",
    });
    const independent = computeMasteryUpdate({
      currentScore: 50,
      event: "practice_incorrect",
      independence: "independent",
    });
    expect(guided.newScore).toBe(independent.newScore);
  });

  it("gives a harder task more credit than an easier one", () => {
    const warmup = computeMasteryUpdate({
      currentScore: 50,
      event: "practice_correct",
      difficulty: "warmup",
    });
    const challenge = computeMasteryUpdate({
      currentScore: 50,
      event: "practice_correct",
      difficulty: "challenge",
    });
    expect(challenge.newScore).toBeGreaterThan(warmup.newScore);
  });
});

describe("the transfer ceiling", () => {
  it("holds mastery below the ceiling until the concept has transferred", () => {
    // Drilling one pattern repeatedly must not reach the mastered band.
    let score = 85;
    for (let i = 0; i < 25; i++) {
      score = computeMasteryUpdate({
        currentScore: score,
        event: "practice_correct",
        independence: "independent",
        hasIndependentTransfer: false,
      }).newScore;
    }
    expect(score).toBeLessThanOrEqual(NO_TRANSFER_CEILING);
  });

  it("reports when the ceiling actually bound the score", () => {
    const r = computeMasteryUpdate({
      currentScore: 95,
      event: "practice_correct",
      hasIndependentTransfer: false,
    });
    expect(r.cappedPendingTransfer).toBe(true);
    expect(r.newScore).toBe(NO_TRANSFER_CEILING);
  });

  it("releases the ceiling once transfer is demonstrated", () => {
    let score = 88;
    for (let i = 0; i < 25; i++) {
      score = computeMasteryUpdate({
        currentScore: score,
        event: "transfer_correct",
        independence: "independent",
        hasIndependentTransfer: true,
      }).newScore;
    }
    expect(score).toBeGreaterThan(NO_TRANSFER_CEILING);
  });

  it("does not apply the ceiling when the caller did not supply transfer state", () => {
    // Backward compatibility: existing callers keep the original behaviour.
    const r = computeMasteryUpdate({ currentScore: 95, event: "practice_correct" });
    expect(r.cappedPendingTransfer).toBe(false);
    expect(r.newScore).toBeGreaterThan(NO_TRANSFER_CEILING);
  });
});

describe("mastery remains reproducible and bounded", () => {
  it("is deterministic for identical input", () => {
    const args = {
      currentScore: 42,
      event: "practice_correct" as const,
      independence: "assisted" as const,
      difficulty: "challenge" as const,
    };
    expect(computeMasteryUpdate(args)).toEqual(computeMasteryUpdate(args));
  });

  it("stays within 0-100 at the extremes", () => {
    expect(
      computeMasteryUpdate({ currentScore: 0, event: "gap_found" }).newScore
    ).toBeGreaterThanOrEqual(0);
    expect(
      computeMasteryUpdate({
        currentScore: 100,
        event: "transfer_correct",
        hasIndependentTransfer: true,
      }).newScore
    ).toBeLessThanOrEqual(100);
  });

  it("clamps an out-of-range teach-back rubric score rather than trusting it", () => {
    // The rubric score can come from a model. It is not trusted blindly.
    const high = computeMasteryUpdate({
      currentScore: 50,
      event: "teach_back",
      teachBackRubricScore: 500,
    });
    const low = computeMasteryUpdate({
      currentScore: 50,
      event: "teach_back",
      teachBackRubricScore: -500,
    });
    expect(high.newScore).toBeLessThanOrEqual(100);
    expect(low.newScore).toBeGreaterThanOrEqual(0);
  });

  it("matches the documented formula exactly", () => {
    // current 50, practice_correct (+6), independent, challenge -> target 56
    // newScore = round(50 * 0.65 + 56 * 0.35) = round(32.5 + 19.6) = 52
    const r = computeMasteryUpdate({
      currentScore: 50,
      event: "practice_correct",
      independence: "independent",
      difficulty: "challenge",
    });
    expect(r.newScore).toBe(52);
  });
});
