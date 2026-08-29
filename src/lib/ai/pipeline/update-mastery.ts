/**
 * Deterministic mastery scoring. Mastery is evidence-driven, not LLM-judged:
 * each event (practice/transfer/teach-back outcome) nudges a 0-100 EMA score.
 * Weighted so transfer success counts more than repair success (transfer is
 * stronger evidence of real understanding), matching the product's emphasis on
 * transfer over rote repair.
 *
 * The score is computed here and nowhere else. A model is never asked "what is
 * this student's mastery?", because a model cannot count and would produce a
 * number that looks precise and cannot be reproduced.
 *
 * ---------------------------------------------------------------------------
 * HOW A SCORE IS ARRIVED AT
 *
 *   target   = current + delta(event), scaled by how much help was involved
 *   newScore = round( current * (1 - 0.35) + target * 0.35 )
 *
 * then, if the transfer rule applies, capped at 89.
 *
 * Every term is a constant in this file. Given a starting score and an event
 * log, the final number can be recomputed by hand, which is the only reason we
 * are willing to display it to a student.
 * ---------------------------------------------------------------------------
 */

import type { EvidenceDifficulty, Independence } from "@/lib/learner/evidence";

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

/**
 * How much of a positive delta survives the help the student had.
 *
 * A right answer produced after two hints is not the same evidence as a right
 * answer produced cold, and scoring them identically is how a learner model
 * ends up confidently overstating what someone can do alone.
 */
const INDEPENDENCE_SCALE: Record<Independence, number> = {
  independent: 1.0,
  assisted: 0.6,
  guided: 0.3,
};

/** Succeeding at something harder is worth more than succeeding at something easy. */
const DIFFICULTY_SCALE: Record<EvidenceDifficulty, number> = {
  warmup: 0.6,
  repair: 0.85,
  challenge: 1.0,
  transfer: 1.2,
  mastery: 1.3,
};

/**
 * Mastery is capped here until the concept has survived an unfamiliar problem.
 *
 * Repeating one pattern accurately is not mastery, it is recall of a pattern.
 * Without this, a student who drills the same shape twenty times reaches 100
 * and gets told they have mastered something they have never had to transfer.
 */
export const NO_TRANSFER_CEILING = 89;

export interface MasteryUpdate {
  newScore: number;
  trend: "up" | "down" | "stable";
  /**
   * True when the transfer ceiling actually bound the score. Surfaced so the UI
   * can explain the stall honestly instead of appearing stuck.
   */
  cappedPendingTransfer: boolean;
}

export function computeMasteryUpdate(params: {
  currentScore: number;
  event: MasteryEventType;
  teachBackRubricScore?: number;
  /**
   * How much help was involved. Optional: callers that do not know leave it
   * out and get the original, unscaled behaviour.
   */
  independence?: Independence;
  /** Difficulty of the task that produced the event. Optional, as above. */
  difficulty?: EvidenceDifficulty;
  /**
   * Whether this concept has ever been transferred independently. Optional:
   * when omitted the ceiling is not applied, so existing callers are unchanged.
   */
  hasIndependentTransfer?: boolean;
}): MasteryUpdate {
  let target: number;

  if (params.event === "teach_back" && typeof params.teachBackRubricScore === "number") {
    target = clamp(params.teachBackRubricScore);
  } else {
    const rawDelta = EVENT_DELTA[params.event];
    // Scaling applies to gains only. A failure is a failure regardless of how
    // much help was on hand — discounting it would make the model slowest to
    // react exactly when a student is struggling most.
    const delta =
      rawDelta > 0
        ? rawDelta *
          (params.independence ? INDEPENDENCE_SCALE[params.independence] : 1) *
          (params.difficulty ? DIFFICULTY_SCALE[params.difficulty] : 1)
        : rawDelta;
    target = clamp(params.currentScore + delta);
  }

  let newScore = clamp(Math.round(params.currentScore * (1 - EMA_ALPHA) + target * EMA_ALPHA));

  // Apply the ceiling only when the caller actually told us about transfer.
  let cappedPendingTransfer = false;
  if (params.hasIndependentTransfer === false && newScore > NO_TRANSFER_CEILING) {
    newScore = NO_TRANSFER_CEILING;
    cappedPendingTransfer = true;
  }

  const trend =
    newScore > params.currentScore ? "up" : newScore < params.currentScore ? "down" : "stable";

  return { newScore, trend, cappedPendingTransfer };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}
