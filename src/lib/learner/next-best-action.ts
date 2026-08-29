/**
 * The next-best-action engine.
 *
 * Answers one question: what should this learner do next, and why?
 *
 * It is a pure function of a learner snapshot. No database, no network, no
 * model — the caller assembles the snapshot from rows and this decides. That
 * split is deliberate: it means the decision can be replayed exactly from a
 * stored snapshot, asserted in a test, and shown to a student as a chain of
 * facts rather than as an assurance that the computer knows best.
 *
 * The LLM's role, elsewhere, is to phrase the chosen action well. It does not
 * get a vote on which action is chosen.
 */

import { summariseEvidence, type Evidence } from "./evidence";
import {
  selectIntervention,
  MASTERED_THRESHOLD,
  PREREQ_THRESHOLD,
  type InterventionAction,
  type InterventionDecision,
} from "./intervention";
import { selectDifficulty, type Difficulty } from "@/lib/ai/pipeline/select-intervention";

export interface ConceptSnapshot {
  conceptId: string;
  slug: string;
  name: string;
  masteryScore: number;
  /** Prerequisite concept ids, for readiness checks. */
  prerequisiteIds: string[];
  /** True when the student has an open (unrepaired) gap on this concept. */
  hasOpenGap: boolean;
  /** Diagnoses of the dominant misconception on this concept. */
  recurrenceCount: number;
  /** True when the open gap was an arithmetic slip rather than a concept error. */
  isArithmeticSlip: boolean;
  /** Most recent submission on this concept had no divergence. */
  lastAttemptWasCorrect: boolean;
  /** Interventions already delivered for this concept, most recent last. */
  interventionHistory: InterventionAction[];
  /** Raw evidence for this concept. */
  evidence: Evidence[];
  /** Attempt outcomes on this concept, most recent last — drives difficulty. */
  recentAttempts: { isCorrect: boolean }[];
}

export interface LearnerSnapshot {
  concepts: ConceptSnapshot[];
  /** Concept ids the roadmap currently considers startable. */
  unlockedConceptIds: string[];
}

export interface NextBestAction {
  action: InterventionAction | "choose_concept";
  reason: string;
  /** The rule that fired, stable across runs. */
  rule: string;
  targetConcept: { conceptId: string; slug: string; name: string } | null;
  difficulty: Difficulty;
  confidence: number;
  evidence: string[];
}

/**
 * Priority for choosing WHICH concept to work on.
 *
 * Higher wins. An open gap outranks everything, because unrepaired
 * misunderstanding compounds: every later concept built on it inherits the
 * fault. Within open gaps, the one that keeps coming back goes first.
 */
function priorityOf(c: ConceptSnapshot, unlocked: Set<string>): number {
  if (!unlocked.has(c.conceptId)) return -1; // locked: never recommended
  let score = 0;
  if (c.hasOpenGap) score += 1000;
  score += c.recurrenceCount * 100;
  // Lower mastery is more urgent, but only among things already engaged with.
  score += 100 - clampScore(c.masteryScore);
  // A concept already at mastery is the least urgent thing to revisit.
  if (c.masteryScore >= MASTERED_THRESHOLD) score -= 500;
  return score;
}

export function decideNextBestAction(
  snapshot: LearnerSnapshot,
  now: number = Date.now()
): NextBestAction {
  const unlocked = new Set(snapshot.unlockedConceptIds);
  const byId = new Map(snapshot.concepts.map((c) => [c.conceptId, c]));

  const candidates = snapshot.concepts
    .filter((c) => unlocked.has(c.conceptId))
    .sort((a, b) => priorityOf(b, unlocked) - priorityOf(a, unlocked));

  const target = candidates[0];

  // Nothing unlocked, or nothing to work on at all. Say so plainly rather than
  // inventing a recommendation.
  if (!target) {
    return {
      action: "choose_concept",
      rule: "no_candidate_concept",
      reason: "There is nothing queued up yet. Submit some work and we will find the next step from it.",
      targetConcept: null,
      difficulty: "repair",
      confidence: 0,
      evidence: [],
    };
  }

  const evidence = summariseEvidence(target.evidence, now);

  // The weakest prerequisite that has actually been assessed. An unassessed
  // prerequisite is not evidence of a hole, so it is excluded rather than
  // treated as a zero — otherwise every new student is told to go backwards.
  const assessedPrereqs = target.prerequisiteIds
    .map((id) => byId.get(id))
    .filter((c): c is ConceptSnapshot => Boolean(c) && (c!.evidence.length > 0 || c!.masteryScore > 0));

  const weakestPrereq =
    assessedPrereqs.length > 0
      ? assessedPrereqs.reduce((min, c) => (c.masteryScore < min.masteryScore ? c : min))
      : null;

  const decision: InterventionDecision = selectIntervention({
    masteryScore: target.masteryScore,
    evidence,
    recurrenceCount: target.recurrenceCount,
    weakestPrerequisiteScore: weakestPrereq?.masteryScore ?? null,
    weakestPrerequisiteName: weakestPrereq?.name ?? null,
    isArithmeticSlip: target.isArithmeticSlip,
    lastAttemptWasCorrect: target.lastAttemptWasCorrect,
    interventionHistory: target.interventionHistory,
  });

  // A prerequisite review is about the PREREQUISITE, not the concept that
  // surfaced it. Retargeting here is what makes the recommendation actionable
  // rather than merely correct.
  const retarget =
    decision.rule === "prerequisite_not_met" && weakestPrereq ? weakestPrereq : target;

  const difficulty = difficultyFor(decision.action, retarget);

  return {
    action: decision.action,
    rule: decision.rule,
    reason: decision.reason,
    targetConcept: {
      conceptId: retarget.conceptId,
      slug: retarget.slug,
      name: retarget.name,
    },
    difficulty,
    confidence: decision.confidence,
    evidence: [
      ...decision.evidence,
      `Working on ${retarget.name}, mastery ${retarget.masteryScore}/100.`,
      evidence.count > 0
        ? `Based on ${evidence.count} recorded observation${evidence.count === 1 ? "" : "s"}.`
        : "No prior observations on this concept yet.",
    ],
  };
}

/**
 * Some actions imply their own difficulty regardless of performance — a
 * transfer problem is a transfer problem. Where the action does not dictate
 * one, the existing evidence-driven selector decides.
 */
function difficultyFor(action: InterventionAction, concept: ConceptSnapshot): Difficulty {
  if (action === "transfer_problem") return "transfer";
  if (action === "mastery_check") return "mastery";
  if (action === "easier_diagnostic") return "warmup";
  if (action === "prerequisite_review") return "repair";

  return selectDifficulty({
    currentMasteryScore: concept.masteryScore,
    recentAttempts: concept.recentAttempts,
    isFirstEncounter: concept.recentAttempts.length === 0 && concept.evidence.length === 0,
  });
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/** Re-exported so callers get the thresholds from one place. */
export { MASTERED_THRESHOLD, PREREQ_THRESHOLD };
