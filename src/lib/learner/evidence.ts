/**
 * The evidence model.
 *
 * Everything downstream of this file — mastery, intervention choice, the next
 * best action — is computed from evidence, never from a model's opinion. This
 * module exists to make one distinction the rest of the system depends on:
 *
 *   AN ANSWER RESULT IS NOT REASONING EVIDENCE.
 *
 * A student who reaches the right answer through a broken step has produced a
 * positive answer result and a negative reasoning result at the same time. A
 * student who reasons flawlessly and then mis-adds two numbers has produced the
 * opposite. Collapsing those two into one boolean is the mistake that makes a
 * tutoring system confidently wrong, so they are kept apart here and stay apart
 * all the way through to the mastery score.
 *
 * Nothing in this file touches the database, the network or a model. It is a
 * pure function of what the student did, which is what makes it testable and
 * what makes every number it produces reproducible.
 */

/** What the observation is actually about. */
export type EvidenceKind =
  | "answer_result" // did they arrive at the right answer?
  | "reasoning_quality" // did every line follow from the one above it?
  | "recurrence" // a previously diagnosed misconception appeared again
  | "remediation" // an outcome recorded after an intervention
  | "transfer" // a structurally different problem on the same concept
  | "articulation"; // the student explained it back

/** Which part of the product produced the observation. */
export type EvidenceSource = "analysis" | "practice" | "transfer" | "teach_back" | "exam";

/**
 * How much help was in the room. This is the signal that stops "got it right"
 * from automatically meaning "knows it", and it is the reason a fourth-attempt
 * success is worth less than a first-attempt one.
 */
export type Independence = "independent" | "assisted" | "guided";

export type EvidenceDifficulty = "warmup" | "repair" | "challenge" | "transfer" | "mastery";

export interface Evidence {
  kind: EvidenceKind;
  source: EvidenceSource;
  /** Concept slug or id this speaks to. */
  concept: string;
  /** Does this observation support competence, or undermine it? */
  isPositive: boolean;
  independence: Independence;
  /** Difficulty of the task that produced it. */
  difficulty: EvidenceDifficulty;
  /** When it happened. Recency is applied at aggregation time. */
  observedAt: Date;
  /** Plain-language justification, shown to the student in "Why this?". */
  note: string;
}

// ---------------------------------------------------------------- weighting

/**
 * How much each kind of observation is allowed to move the learner model.
 *
 * These are deliberately few and deliberately blunt. A formula with more
 * constants would look more sophisticated and would be impossible to defend
 * line by line; every value below can be justified in one sentence.
 */
const KIND_WEIGHT: Record<EvidenceKind, number> = {
  // A right answer is the weakest evidence of understanding in this list. It is
  // reachable by luck, by pattern-matching, or by copying.
  answer_result: 0.6,
  // Whether every step followed is what we actually claim to measure.
  reasoning_quality: 1.0,
  // The same named slip, again, is a strong statement about a rule the student
  // is applying rather than a moment of carelessness.
  recurrence: 1.2,
  remediation: 0.9,
  // The hardest thing to fake: the same idea in an unfamiliar shape.
  transfer: 1.5,
  articulation: 0.8,
};

/** Help received discounts positive evidence. It does not discount failure. */
const INDEPENDENCE_WEIGHT: Record<Independence, number> = {
  independent: 1.0,
  assisted: 0.6, // succeeded, but after hints
  guided: 0.3, // succeeded only while being walked through it
};

/** Succeeding at something harder says more than succeeding at something easy. */
const DIFFICULTY_WEIGHT: Record<EvidenceDifficulty, number> = {
  warmup: 0.5,
  repair: 0.8,
  challenge: 1.0,
  transfer: 1.3,
  mastery: 1.5,
};

/**
 * The weight of a single observation.
 *
 * Note the asymmetry: independence and difficulty scale POSITIVE evidence only.
 * Getting a warmup problem wrong with heavy hints is not weak evidence of a
 * problem — if anything it is strong evidence — so discounting it would make
 * the model slowest to react exactly when a student is struggling most.
 */
export function weightOf(evidence: Evidence): number {
  const base = KIND_WEIGHT[evidence.kind];
  if (!evidence.isPositive) return base;
  return base * INDEPENDENCE_WEIGHT[evidence.independence] * DIFFICULTY_WEIGHT[evidence.difficulty];
}

// --------------------------------------------------------------- derivation

/**
 * Works out how independent an attempt was from what we actually recorded.
 *
 * We do not ask the student how much help they had, and we do not guess. The
 * attempt index is a fact (it is a row count) and hints used is a fact when the
 * caller knows it. Where a caller cannot supply hint counts, a first attempt is
 * still correctly read as independent.
 */
export function deriveIndependence(params: {
  /** 1 for the first attempt at this problem, 2 for the second, and so on. */
  attemptIndex: number;
  hintsUsed?: number;
}): Independence {
  const hints = params.hintsUsed ?? 0;
  if (hints >= 2 || params.attemptIndex >= 3) return "guided";
  if (hints >= 1 || params.attemptIndex >= 2) return "assisted";
  return "independent";
}

/**
 * Turns one finished attempt into the pair of observations it actually
 * supports, keeping the answer and the reasoning apart.
 *
 * `reasoningValid` is optional because not every surface can check it. Where it
 * is unknown we emit the answer result alone rather than inventing a reasoning
 * verdict — an unverified step is not a wrong step.
 */
export function evidenceFromAttempt(params: {
  concept: string;
  source: EvidenceSource;
  isCorrect: boolean;
  reasoningValid?: boolean | null;
  independence: Independence;
  difficulty: EvidenceDifficulty;
  observedAt?: Date;
}): Evidence[] {
  const observedAt = params.observedAt ?? new Date();
  const shared = {
    source: params.source,
    concept: params.concept,
    independence: params.independence,
    difficulty: params.difficulty,
    observedAt,
  } as const;

  const out: Evidence[] = [
    {
      ...shared,
      kind: params.source === "transfer" ? "transfer" : "answer_result",
      isPositive: params.isCorrect,
      note: params.isCorrect
        ? "Reached the correct answer."
        : "Did not reach the correct answer.",
    },
  ];

  if (typeof params.reasoningValid === "boolean") {
    out.push({
      ...shared,
      kind: "reasoning_quality",
      isPositive: params.reasoningValid,
      note: params.reasoningValid
        ? "Every line followed from the one above it."
        : "A line did not follow from the one above it.",
    });
  }

  return out;
}

// -------------------------------------------------------------- aggregation

export interface EvidenceSummary {
  /** Total observations considered. */
  count: number;
  /**
   * Weighted share of evidence that is positive, 0-1. This is the single number
   * the mastery engine consumes.
   */
  positiveShare: number;
  /** Sum of weights, positive and negative. A high total is a well-evidenced picture. */
  totalWeight: number;
  /** True when at least one independent success on a transfer task exists. */
  hasIndependentTransfer: boolean;
  /** True when the student has succeeded, but never without help. */
  onlySucceedsWithHelp: boolean;
  /**
   * How far the answer results and the reasoning results disagree, 0-1.
   *
   * A high value is the interesting case and the one this product exists for:
   * right answers on top of broken reasoning, or sound reasoning undone by
   * arithmetic. Either way the headline score is hiding something.
   */
  answerReasoningGap: number;
  /**
   * How much we trust the summary itself, 0-1, from how much evidence there is.
   * Three observations is not a judgement; twelve is. Saturates rather than
   * pretending to a precision the row count does not support.
   */
  confidence: number;
}

/** Evidence contributes at half weight per half-life elapsed. */
const HALF_LIFE_DAYS = 21;
/** Weight total at which we call the picture well-evidenced. */
const CONFIDENCE_SATURATION = 8;

function recencyFactor(observedAt: Date, now: number): number {
  const ageDays = Math.max(0, (now - observedAt.getTime()) / 86_400_000);
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

/** Weighted positive share across one subset of the evidence. */
function shareOf(evidence: Evidence[], now: number): number | null {
  let positive = 0;
  let total = 0;
  for (const e of evidence) {
    const w = weightOf(e) * recencyFactor(e.observedAt, now);
    total += w;
    if (e.isPositive) positive += w;
  }
  return total > 0 ? positive / total : null;
}

/**
 * Reduces a pile of observations to the few numbers the rest of the system
 * needs. Recency-weighted, because what a student did today describes them
 * better than what they did three weeks ago.
 */
export function summariseEvidence(evidence: Evidence[], now: number = Date.now()): EvidenceSummary {
  if (evidence.length === 0) {
    return {
      count: 0,
      positiveShare: 0,
      totalWeight: 0,
      hasIndependentTransfer: false,
      onlySucceedsWithHelp: false,
      answerReasoningGap: 0,
      confidence: 0,
    };
  }

  let positiveWeight = 0;
  let totalWeight = 0;
  for (const e of evidence) {
    const w = weightOf(e) * recencyFactor(e.observedAt, now);
    totalWeight += w;
    if (e.isPositive) positiveWeight += w;
  }

  const positives = evidence.filter((e) => e.isPositive);

  const answerShare = shareOf(
    evidence.filter((e) => e.kind === "answer_result" || e.kind === "transfer"),
    now
  );
  const reasoningShare = shareOf(
    evidence.filter((e) => e.kind === "reasoning_quality"),
    now
  );

  return {
    count: evidence.length,
    positiveShare: totalWeight > 0 ? positiveWeight / totalWeight : 0,
    totalWeight,
    hasIndependentTransfer: positives.some(
      (e) => e.kind === "transfer" && e.independence === "independent"
    ),
    // Only meaningful once they have actually succeeded at something.
    onlySucceedsWithHelp:
      positives.length > 0 && positives.every((e) => e.independence !== "independent"),
    // Undefined when we have only one of the two kinds — no disagreement can be
    // observed, so none is claimed.
    answerReasoningGap:
      answerShare !== null && reasoningShare !== null ? Math.abs(answerShare - reasoningShare) : 0,
    confidence: Math.min(1, totalWeight / CONFIDENCE_SATURATION),
  };
}
