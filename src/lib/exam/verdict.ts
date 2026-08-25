/**
 * Turning exam answers into a verdict.
 *
 * The rule this file exists to enforce: **mastery is never claimed from one
 * question.** A single correct answer is consistent with understanding, with a
 * lucky guess, and with remembering a similar problem. Only repeated,
 * independent, reasoning-sound success is evidence — and where the evidence is
 * thin, the honest verdict is "uncertain", not a cheerful one.
 *
 * Reasoning is weighted separately from correctness for the same reason it is
 * in practice: a right answer reached through an invalid step is not a repair,
 * and a wrong final answer after flawless reasoning is an arithmetic slip, not
 * a misconception.
 */

export type ConceptVerdict = "mastered" | "needs_reinforcement" | "uncertain";

export interface QuestionOutcome {
  conceptId: string;
  isCorrect: boolean;
  /** Did every line follow from the one before it? */
  reasoningValid: boolean;
  /** The catalogue code, when the error matched one. */
  misconceptionCode: string | null;
}

export interface ConceptResult {
  conceptId: string;
  conceptName: string;
  verdict: ConceptVerdict;
  answered: number;
  correct: number;
  reasoningSound: number;
  /** Codes that recurred during the exam — the old habit resurfacing. */
  recurringCodes: string[];
  /** Plain-language justification, built from the counts. */
  because: string;
}

/** Below this, there is not enough evidence to call anything either way. */
const MIN_QUESTIONS_FOR_A_VERDICT = 2;

export function judgeConcept(params: {
  conceptId: string;
  conceptName: string;
  outcomes: QuestionOutcome[];
  /** Codes this student had a history of before the exam. */
  priorMisconceptionCodes: string[];
}): ConceptResult {
  const { conceptId, conceptName, outcomes, priorMisconceptionCodes } = params;

  const answered = outcomes.length;
  const correct = outcomes.filter((o) => o.isCorrect).length;
  const reasoningSound = outcomes.filter((o) => o.reasoningValid).length;

  // A question that is both right AND soundly reasoned is the only kind that
  // counts toward mastery. The two can come apart in either direction.
  const fullyRight = outcomes.filter((o) => o.isCorrect && o.reasoningValid).length;

  const recurringCodes = Array.from(
    new Set(
      outcomes
        .map((o) => o.misconceptionCode)
        .filter((c): c is string => Boolean(c) && c !== "UNCLASSIFIED")
        .filter((c) => priorMisconceptionCodes.includes(c))
    )
  );

  if (answered < MIN_QUESTIONS_FOR_A_VERDICT) {
    return {
      conceptId,
      conceptName,
      verdict: "uncertain",
      answered,
      correct,
      reasoningSound,
      recurringCodes,
      because:
        answered === 0
          ? "You didn't answer a question on this."
          : "One question isn't enough to tell understanding from a lucky guess.",
    };
  }

  // An old misconception reappearing under exam conditions is the clearest
  // possible signal that the repair didn't hold, whatever the score.
  if (recurringCodes.length > 0) {
    return {
      conceptId,
      conceptName,
      verdict: "needs_reinforcement",
      answered,
      correct,
      reasoningSound,
      recurringCodes,
      because: `The same misconception you had before came back under exam conditions, so the repair hasn't held yet.`,
    };
  }

  if (fullyRight === answered) {
    return {
      conceptId,
      conceptName,
      verdict: "mastered",
      answered,
      correct,
      reasoningSound,
      recurringCodes,
      because: `${answered} of ${answered} right, with every line following from the one before it — and no help available.`,
    };
  }

  if (fullyRight === 0) {
    return {
      conceptId,
      conceptName,
      verdict: "needs_reinforcement",
      answered,
      correct,
      reasoningSound,
      recurringCodes,
      because: `None came out right without help. This one needs more work before it's settled.`,
    };
  }

  // Mixed. Whether that reads as "nearly there" or "not yet" depends on
  // whether the failures were reasoning or arithmetic.
  const arithmeticOnly = outcomes.every((o) => o.reasoningValid) && correct < answered;
  return {
    conceptId,
    conceptName,
    verdict: arithmeticOnly ? "uncertain" : "needs_reinforcement",
    answered,
    correct,
    reasoningSound,
    recurringCodes,
    because: arithmeticOnly
      ? `Your reasoning held every time, but the arithmetic slipped. That's a different problem from the one we repaired.`
      : `${fullyRight} of ${answered} fully sound. Not consistent enough to call it settled.`,
  };
}

/** The headline number: fully-right answers over questions answered. */
export function examScore(results: ConceptResult[]): number {
  const answered = results.reduce((sum, r) => sum + r.answered, 0);
  if (answered === 0) return 0;
  const sound = results.reduce((sum, r) => sum + Math.min(r.correct, r.reasoningSound), 0);
  return Math.round((sound / answered) * 100);
}
