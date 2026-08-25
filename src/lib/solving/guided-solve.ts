import { correctSolutionChain, solveLinear, toLinearForm } from "@/lib/math/solve-step";
import { verifyStep } from "@/lib/verification/verify-step";
import { checkChemicalBalance, looksLikeChemicalEquation } from "@/lib/verification/domains/chemistry";

/**
 * Guided solving — for a question the student hasn't started.
 *
 * GapFinder's whole engine runs backwards: it takes finished working and finds
 * where it broke. That is useless to someone staring at a blank page, which is
 * the most common moment a student actually needs help. This runs the same
 * engine forwards.
 *
 * The rule that makes it teaching rather than answering: **the app never writes
 * the next line.** It says what move comes next and why, then the student
 * writes it, and their attempt is checked by the same verifier that grades
 * everything else. Handing over the finished chain would make this a solver,
 * and solvers are why students can pass homework and fail exams.
 */

export type GuidedStepKind = "isolate" | "expand" | "collect" | "divide" | "solve" | "balance" | "done";

export interface GuidedStep {
  /** 1-based position in the solution. */
  order: number;
  /** What to do, without doing it. */
  instruction: string;
  /** Why this move is the right one here. */
  reason: string;
  kind: GuidedStepKind;
  /**
   * The line the student should arrive at. Held server-side to check their
   * attempt — revealed only if they ask, never volunteered.
   */
  expected: string;
}

export interface GuidedPlan {
  /** The problem as given. */
  problem: string;
  steps: GuidedStep[];
  finalAnswer: string | null;
  /** True when this shape can be guided at all. */
  solvable: boolean;
  /** Why not, when it can't. */
  reason?: string;
}

/**
 * Builds the plan from the question alone.
 *
 * Every line comes from the same derivation used to produce the "how it should
 * have gone" chain in a diagnosis, so a student who is guided through a problem
 * and a student who is corrected on one are being taught the identical method.
 */
export function buildGuidedPlan(problem: string): GuidedPlan {
  const trimmed = problem.trim();

  if (looksLikeChemicalEquation(trimmed)) {
    return buildChemicalPlan(trimmed);
  }

  const chain = correctSolutionChain(trimmed);
  const form = toLinearForm(trimmed);

  if (!chain || chain.length < 2 || !form) {
    return {
      problem: trimmed,
      steps: [],
      finalAnswer: null,
      solvable: false,
      reason:
        "We can guide you through linear equations, and through balancing chemical equations. This one is a shape we can't work step by step yet.",
    };
  }

  const solution = solveLinear(trimmed);
  const steps: GuidedStep[] = [];

  // chain[0] is the problem itself; each later entry is one move.
  for (let i = 1; i < chain.length; i++) {
    const expected = chain[i]!;
    steps.push({
      order: i,
      ...describeMove(chain[i - 1]!, expected, i === chain.length - 1, form.variable),
      expected,
    });
  }

  return {
    problem: trimmed,
    steps,
    finalAnswer: solution === null ? null : chain[chain.length - 1]!,
    solvable: true,
  };
}

/** Names the move between two lines without performing it for the student. */
function describeMove(
  from: string,
  to: string,
  isLast: boolean,
  variable: string
): { instruction: string; reason: string; kind: GuidedStepKind } {
  if (isLast) {
    return {
      instruction: `Divide both sides to get ${variable} on its own.`,
      reason: `Whatever is multiplying ${variable} has to be undone, and dividing is what undoes multiplying.`,
      kind: "solve",
    };
  }

  if (/\(/.test(from) && !/\(/.test(to)) {
    return {
      instruction: "Expand the brackets, then collect like terms.",
      reason:
        "The multiplier outside a bracket applies to every term inside it — including the sign of the second one.",
      kind: "expand",
    };
  }

  const fromForm = toLinearForm(from);
  const toForm = toLinearForm(to);

  if (fromForm && toForm && Math.abs(fromForm.m - toForm.m) > 1e-9) {
    return {
      instruction: `Gather the ${variable} terms on one side.`,
      reason: `You can't divide out ${variable} while it appears on both sides, so bring them together first.`,
      kind: "collect",
    };
  }

  return {
    instruction: "Move the constant to the other side.",
    reason:
      "Moving a term across the equals sign means applying its inverse to both sides — so its sign flips.",
    kind: "isolate",
  };
}

/**
 * Balancing is guided element by element, in the order that avoids undoing
 * previous work: the elements appearing in fewest compounds first, with oxygen
 * and hydrogen last.
 */
function buildChemicalPlan(equation: string): GuidedPlan {
  const balance = checkChemicalBalance(equation);
  if (!balance) {
    return {
      problem: equation,
      steps: [],
      finalAnswer: null,
      solvable: false,
      reason: "We couldn't read that as a chemical equation.",
    };
  }

  if (balance.isBalanced) {
    return {
      problem: equation,
      steps: [
        {
          order: 1,
          instruction: "Check each element on both sides.",
          reason: "This equation is already balanced — every element matches.",
          kind: "done",
          expected: equation,
        },
      ],
      finalAnswer: equation,
      solvable: true,
    };
  }

  // Leave O and H until last: they appear in the most compounds, so fixing
  // them early tends to unbalance whatever was just balanced.
  const ordered = balance.mismatches
    .map((m) => m.element)
    .sort((a, b) => rank(a) - rank(b));

  return {
    problem: equation,
    steps: ordered.map((element, i) => ({
      order: i + 1,
      instruction: `Balance ${element} by changing a coefficient — the number in front of a substance.`,
      reason: `${element} is ${balance.left[element] ?? 0} on the left and ${balance.right[element] ?? 0} on the right. Never change a subscript: that would make it a different chemical.`,
      kind: "balance" as const,
      // Balancing has many valid intermediate lines, so there is no single
      // expected string to check against — the verifier judges the attempt.
      expected: "",
    })),
    finalAnswer: null,
    solvable: true,
  };
}

function rank(element: string): number {
  if (element === "H") return 2;
  if (element === "O") return 3;
  return 1;
}

/**
 * Checks a student's attempt at the current step.
 *
 * Deliberately permissive about *form* and strict about *truth*: any line that
 * legitimately follows from where they were is accepted, even if it isn't the
 * one the plan predicted, because there is usually more than one correct route.
 */
export function checkGuidedAttempt(params: {
  previousLine: string;
  attempt: string;
  expected: string;
}): { accepted: boolean; note: string; matchedExpected: boolean } {
  const attempt = params.attempt.trim();
  if (!attempt) {
    return { accepted: false, note: "Write the next line of your working.", matchedExpected: false };
  }

  const normalised = (s: string) => s.replace(/\s/g, "");
  const matchedExpected = Boolean(params.expected) && normalised(attempt) === normalised(params.expected);

  const verification = verifyStep(params.previousLine, attempt);

  if (!verification) {
    return {
      accepted: false,
      note: "We couldn't check that line. Write it as an equation, one step at a time.",
      matchedExpected: false,
    };
  }

  if (!verification.isValid) {
    return { accepted: false, note: verification.note, matchedExpected: false };
  }

  return {
    accepted: true,
    note: matchedExpected
      ? "Exactly right."
      : "That works too — it follows from the line above, which is what matters.",
    matchedExpected,
  };
}
