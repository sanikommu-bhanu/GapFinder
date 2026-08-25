/**
 * Deterministic mastery scoring. Mastery is evidence-driven, not LLM-judged:
 * each event (practice/transfer/teach-back outcome) nudges a 0-100 EMA score.
 * Weighted so transfer success counts more than repair success (transfer is
 * stronger evidence of real understanding), matching the product's emphasis
 * on transfer over rote repair.
 */

export type MasteryEventType =
  | "gap_found"
  | "practice_correct"
  | "practice_incorrect"
  | "transfer_correct"
  | "transfer_incorrect"
  | "teach_back";

const EVENT_DELTA: Record<MasteryEventType, number> = {
  gap_found: -8,
  practice_correct: 6,
  practice_incorrect: -4,
  transfer_correct: 12,
  transfer_incorrect: -3,
  teach_back: 0, // computed separately from rubric score
};

const EMA_ALPHA = 0.35;

export function computeMasteryUpdate(params: {
  currentScore: number;
  event: MasteryEventType;
  teachBackRubricScore?: number;
}): { newScore: number; trend: "up" | "down" | "stable" } {
  let target: number;
  if (params.event === "teach_back" && typeof params.teachBackRubricScore === "number") {
    target = params.teachBackRubricScore;
  } else {
    target = clamp(params.currentScore + EVENT_DELTA[params.event]);
  }

  const newScore = clamp(Math.round(params.currentScore * (1 - EMA_ALPHA) + target * EMA_ALPHA));
  const trend = newScore > params.currentScore ? "up" : newScore < params.currentScore ? "down" : "stable";
  return { newScore, trend };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}
