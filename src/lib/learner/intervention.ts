/**
 * The intervention decision engine.
 *
 * The existing selectDifficulty() decides how HARD the next task should be.
 * This decides what KIND of thing should happen at all — which is a different
 * question and, until now, one nothing in the system asked. A tutor who
 * responds to every error by explaining is not adapting; they are reciting.
 *
 * The rules below are ordered by precedence and evaluated top to bottom. That
 * ordering is the design: a missing prerequisite outranks a recurring
 * misconception, which outranks a first-time conceptual error, which outranks a
 * slip. Each rule states the evidence it fired on, so the decision can be
 * explained to the student and asserted in a test.
 *
 * A model is never asked which intervention to run. A model may later be asked
 * to WRITE the chosen intervention — the words in a hint, the prose of an
 * explanation — but the choice itself is made here, from rows.
 */

import type { EvidenceSummary } from "./evidence";

export type InterventionAction =
  | "targeted_hint" // one nudge; they were close and the method was sound
  | "concise_explanation" // name the idea they are missing, briefly
  | "worked_example" // show the whole move done correctly, start to finish
  | "prerequisite_review" // the problem is upstream of this concept
  | "targeted_practice" // they understand it; they need reps to own it
  | "easier_diagnostic" // we do not know enough; ask something simpler
  | "re_attempt" // nothing is broken, let them finish
  | "transfer_problem" // same idea, unfamiliar shape
  | "mastery_check"; // confirm and move on

/** Recurrence at or above this count stops being a slip and becomes a habit. */
export const PERSISTENT_RECURRENCE = 3;
/** Mastery at or above this counts a prerequisite as met. Matches the roadmap. */
export const PREREQ_THRESHOLD = 60;
/** Mastery at or above this is a candidate for confirmation rather than teaching. */
export const MASTERED_THRESHOLD = 90;
/** Below this we treat the concept as not yet established. */
export const FRAGILE_THRESHOLD = 40;

export interface InterventionInput {
  /** 0-100 for the concept in question. */
  masteryScore: number;
  /** Aggregated evidence for this concept. */
  evidence: EvidenceSummary;
  /** How many times this exact misconception code has been diagnosed. */
  recurrenceCount: number;
  /**
   * Lowest mastery among this concept's prerequisites, or null when the
   * concept has none / none have been assessed.
   */
  weakestPrerequisiteScore: number | null;
  /** Name of that prerequisite, for the explanation. */
  weakestPrerequisiteName?: string | null;
  /**
   * True when the diagnosed error was arithmetic rather than conceptual — the
   * method was right and the numbers were not.
   */
  isArithmeticSlip: boolean;
  /** True when the most recent submission had no divergence at all. */
  lastAttemptWasCorrect: boolean;
  /** Interventions already delivered for this concept, most recent last. */
  interventionHistory: InterventionAction[];
}

export interface InterventionDecision {
  action: InterventionAction;
  /** Student-facing sentence. Never mentions internal thresholds. */
  reason: string;
  /**
   * The rule that fired, as a stable identifier. This is what tests assert on
   * and what the observability view shows, so it must not be prose.
   */
  rule: string;
  /** The specific facts that triggered it, for the "Why this?" panel. */
  evidence: string[];
  /**
   * How confident we are in this CHOICE — which is a function of how much
   * evidence we have, not of how sure a model sounds.
   */
  confidence: number;
}

/**
 * Chooses the next instructional action.
 *
 * Deterministic and total: every input lands on exactly one rule, and the same
 * input always produces the same decision.
 */
export function selectIntervention(input: InterventionInput): InterventionDecision {
  const ev = input.evidence;
  // Confidence in the decision tracks how much evidence backs it, floored so a
  // first-encounter decision is not reported as worthless.
  const confidence = round2(0.5 + 0.5 * ev.confidence);

  // 1. A missing prerequisite outranks everything. Teaching a concept on top of
  //    an unmet prerequisite is the most common way tutoring wastes a student's
  //    time, because the explanation cannot land.
  if (
    input.weakestPrerequisiteScore !== null &&
    input.weakestPrerequisiteScore < PREREQ_THRESHOLD &&
    input.masteryScore < MASTERED_THRESHOLD
  ) {
    const name = input.weakestPrerequisiteName ?? "an earlier concept";
    return {
      action: "prerequisite_review",
      rule: "prerequisite_not_met",
      reason: `This builds on ${name}, and that one is not solid yet. Going back there first will make this easier than pushing on.`,
      evidence: [
        `Prerequisite ${name} is at ${input.weakestPrerequisiteScore}/100, below the ${PREREQ_THRESHOLD} needed.`,
      ],
      confidence,
    };
  }

  // 2. The same named slip three times is not carelessness. Explaining it again
  //    has now demonstrably failed twice, so the strategy changes rather than
  //    repeating at a louder volume.
  if (input.recurrenceCount >= PERSISTENT_RECURRENCE) {
    return {
      action: "prerequisite_review",
      rule: "persistent_misconception",
      reason:
        "This same step has tripped you up several times now. Rather than going over it again the same way, we will rebuild the idea underneath it.",
      evidence: [`This exact misconception has been diagnosed ${input.recurrenceCount} times.`],
      confidence,
    };
  }

  // 3. Second occurrence: the explanation did not stick, so show it done
  //    instead of describing it again.
  if (input.recurrenceCount === 2) {
    return {
      action: "worked_example",
      rule: "recurring_misconception",
      reason:
        "You have hit this one before. Here is the whole move worked through, so you can see where it turns.",
      evidence: ["This misconception has now been diagnosed twice."],
      confidence,
    };
  }

  // 4. Nothing is wrong. Decide between confirming, stretching and practising.
  if (input.lastAttemptWasCorrect) {
    if (input.masteryScore >= MASTERED_THRESHOLD && ev.hasIndependentTransfer) {
      return {
        action: "mastery_check",
        rule: "mastery_candidate",
        reason: "You have handled this unaided, including in an unfamiliar form. One last check and it is done.",
        evidence: [
          `Mastery is ${input.masteryScore}/100.`,
          "A transfer problem has been solved independently.",
        ],
        confidence,
      };
    }
    // The section-10 rule: repeating the same pattern is not mastery. Before we
    // call this learned, it has to survive a different shape.
    if (input.masteryScore >= PREREQ_THRESHOLD && !ev.hasIndependentTransfer) {
      return {
        action: "transfer_problem",
        rule: "needs_transfer_evidence",
        reason:
          "You are getting these right. The real test is whether it holds when the problem does not look the same, so here is one that does not.",
        evidence: [
          `Mastery is ${input.masteryScore}/100.`,
          "No independent transfer success recorded yet.",
        ],
        confidence,
      };
    }
    // Right answers, but never without help. Reps, not more teaching.
    if (ev.onlySucceedsWithHelp) {
      return {
        action: "targeted_practice",
        rule: "assisted_success_only",
        reason:
          "You are getting there, but so far with a hand on the handlebars. A couple on your own will settle it.",
        evidence: ["Every success so far involved hints or a repeat attempt."],
        confidence,
      };
    }
    return {
      action: "targeted_practice",
      rule: "consolidating",
      reason: "That worked. A little practice at this level will make it stick.",
      evidence: [`Mastery is ${input.masteryScore}/100.`],
      confidence,
    };
  }

  // 5. Wrong answer, sound method. This is a nudge, not a lesson — and treating
  //    an arithmetic slip as a conceptual failure is insulting and wastes time.
  if (input.isArithmeticSlip) {
    return {
      action: "targeted_hint",
      rule: "arithmetic_slip",
      reason:
        "Your method is right — the number is not. A pointer at the line in question should be enough.",
      evidence: ["The step has the correct shape; only the value it produced is wrong."],
      confidence,
    };
  }

  // 6. Repeated failure on an already-fragile concept. We are not learning
  //    anything from asking again at this level; drop down and find the floor.
  if (input.masteryScore < FRAGILE_THRESHOLD && ev.count >= 2 && ev.positiveShare < 0.34) {
    return {
      action: "easier_diagnostic",
      rule: "repeated_failure",
      reason:
        "This level is not working yet. We will step back to something smaller to find exactly where it stops making sense.",
      evidence: [
        `Mastery is ${input.masteryScore}/100.`,
        `Most recent evidence is largely negative (${Math.round(ev.positiveShare * 100)}% positive).`,
      ],
      confidence,
    };
  }

  // 7. First conceptual error. Explaining is the right move exactly once —
  //    unless we already tried, in which case show it instead.
  if (input.interventionHistory.includes("concise_explanation")) {
    return {
      action: "worked_example",
      rule: "explanation_already_tried",
      reason: "We have talked through this one. Let us look at it done instead.",
      evidence: ["An explanation has already been delivered for this concept."],
      confidence,
    };
  }

  return {
    action: "concise_explanation",
    rule: "first_conceptual_error",
    reason: "This is the first time this idea has caused trouble. Here is the piece that is missing.",
    evidence: ["First diagnosed occurrence of this misconception."],
    confidence,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
