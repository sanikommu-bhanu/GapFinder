import { verifyFinalAnswer } from "@/lib/verification/math-verifier";
import { solveLinear, fmt } from "@/lib/math/solve-step";

/**
 * Deterministic practice/transfer problem generation.
 *
 * Two jobs, both required by the product's honesty rules:
 *
 * 1. It is the offline path. When Gemini is unavailable (no key, quota
 *    exhausted, or network down) a student must still get a real,
 *    correct problem targeting their actual gap — not an error screen.
 * 2. It is the validator. Every problem — generated here OR by Gemini — is run
 *    through `validateGeneratedProblem` before a student ever sees it, so the
 *    claimed answer is checked by the same deterministic verifier that grades
 *    the student. A problem whose stated answer does not actually solve it is
 *    rejected rather than shown.
 */

export interface GeneratedProblem {
  prompt: string;
  correctAnswer: string;
  difficulty: "warmup" | "repair" | "challenge" | "transfer" | "mastery";
  /** How this problem came to exist — surfaced in the observability view. */
  source: "gemini" | "deterministic";
}

/**
 * Pulls the equation out of a problem statement.
 *
 * A generated prompt often carries framing ("Solve for n: 5n + 7 = 47"), and
 * rejecting those would throw away every usable problem the model writes. This
 * finds the equation inside the text; if there isn't one, there is nothing to
 * verify and the caller rejects the problem.
 */
export function extractEquation(prompt: string): string | null {
  const normalized = prompt
    .replace(/[×·]/g, "*")
    .replace(/[−–—]/g, "-")
    .replace(/\?[$]/g, "")
    .trim();

  // Longest run of equation-ish characters containing exactly one "=".
  const candidates = normalized.match(/[0-9a-zA-Z().+\-*/^\s]*=[0-9a-zA-Z().+\-*/^\s]*/g);
  if (!candidates) return null;

  for (const candidate of candidates
    .map((c) => c.trim())
    .sort((a, b) => b.length - a.length)) {
    if ((candidate.match(/=/g) ?? []).length !== 1) continue;
    const [lhs, rhs] = candidate.split("=");
    if (!lhs?.trim() || !rhs?.trim()) continue;
    if (!/[0-9]/.test(candidate)) continue;
    // Trim leading prose words that got swept in ("Solve for n 5n + 7 = 47").
    const cleanedLhs = lhs.trim().split(/\s{2,}|:/).pop()?.trim() ?? lhs.trim();
    const equation = `${cleanedLhs} = ${rhs.trim()}`;
    if (solveLinear(equation) !== null) return equation;
  }
  return null;
}

/**
 * Checks that a problem's declared answer really is the answer, by solving the
 * problem independently and comparing. Returns false for anything unverifiable
 * — an unverifiable problem is never shown to a student.
 */
export function validateGeneratedProblem(prompt: string, correctAnswer: string): boolean {
  const equation = extractEquation(prompt);
  if (!equation) return false;
  const solved = solveLinear(equation);
  if (solved === null) return false;
  const variable = equation.match(/[a-zA-Z]/)?.[0] ?? "x";
  const check = verifyFinalAnswer(correctAnswer, `${variable} = ${solved}`);
  return check.isValid;
}


/** Deterministic pseudo-random so a given gap gets a stable but varied problem. */
function seededPick<T>(items: T[], seed: string, offset = 0): T {
  let h = 2166136261 ^ offset;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return items[Math.abs(h) % items.length]!;
}

const DIFFICULTY_RANGE: Record<GeneratedProblem["difficulty"], { coef: number[]; konst: number[]; answers: number[] }> = {
  warmup: { coef: [1, 2], konst: [2, 3, 4, 5], answers: [2, 3, 4, 5] },
  repair: { coef: [2, 3, 4], konst: [5, 7, 9, 11], answers: [3, 4, 5, 6, 9] },
  challenge: { coef: [3, 4, 5, 6], konst: [8, 11, 13, 15], answers: [4, 6, 7, 8] },
  transfer: { coef: [2, 3, 5], konst: [6, 7, 9, 12], answers: [4, 5, 6, 8] },
  mastery: { coef: [4, 6, 7], konst: [13, 17, 19], answers: [6, 8, 9, 12] },
};

/**
 * Builds a problem that exercises the same concept. `mode: "transfer"` changes
 * the *surface form* — constant written first, a different variable letter, or
 * a word-problem framing — while keeping the underlying inverse-operation
 * reasoning identical. That surface change is the whole point of transfer:
 * succeeding on it cannot be explained by pattern-matching the original layout.
 */
export function buildDeterministicProblem(params: {
  conceptSlug: string;
  difficulty: GeneratedProblem["difficulty"];
  mode: "repair" | "transfer";
  seed: string;
  avoidPrompts?: string[];
}): GeneratedProblem | null {
  const range = DIFFICULTY_RANGE[params.difficulty] ?? DIFFICULTY_RANGE.repair;
  const avoid = new Set((params.avoidPrompts ?? []).map((p) => p.replace(/\s/g, "")));

  for (let attempt = 0; attempt < 12; attempt++) {
    const a = seededPick(range.coef, params.seed, attempt);
    const answer = seededPick(range.answers, params.seed, attempt + 101);
    const b = seededPick(range.konst, params.seed, attempt + 211);
    const variable = params.mode === "transfer" ? seededPick(["n", "y", "t"], params.seed, attempt + 7) : "x";
    const negative = params.conceptSlug === "sign-handling" && attempt % 2 === 1;

    const c = negative ? a * answer - b : a * answer + b;
    const prompt =
      params.mode === "transfer"
        ? `${fmt(negative ? -b : b)} ${negative ? "" : "+ "}${a}${variable} = ${fmt(c)}`.replace("+ -", "- ")
        : `${a}${variable} ${negative ? "-" : "+"} ${fmt(b)} = ${fmt(c)}`;

    const normalized = prompt.replace(/\s/g, "");
    if (avoid.has(normalized)) continue;

    const correctAnswer = `${variable} = ${fmt(answer)}`;
    // Self-check before returning: never hand out a problem we can't verify.
    if (!validateGeneratedProblem(prompt, correctAnswer)) continue;

    return { prompt, correctAnswer, difficulty: params.difficulty, source: "deterministic" };
  }
  return null;
}
