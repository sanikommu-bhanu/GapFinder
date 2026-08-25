import { evaluate, unit, type Unit } from "mathjs";
import { fmt } from "@/lib/math/solve-step";

/**
 * Quantitative verification — the shape most physics and chemistry working
 * takes: substitute values into a formula, then compute.
 *
 * Two things are genuinely checkable here, and both are arithmetic rather than
 * opinion:
 *
 *   1. **Value**   — does the number on the right actually equal the
 *                    expression on the left?
 *   2. **Units**   — do the units on both sides reduce to the same dimension?
 *
 * Unit errors are the single most common way physics working goes wrong while
 * looking right, and they are exactly the kind of thing a language model will
 * wave through. So they're checked here, with mathjs doing the dimensional
 * algebra.
 */

export interface QuantitativeCheck {
  isValid: boolean;
  note: string;
  /** Set when the numbers are right but the units don't reconcile. */
  unitProblem?: string;
}

/** Relative tolerance — students round, and rounding isn't an error. */
const RELATIVE_TOLERANCE = 0.005;

function normalize(expression: string): string {
  return expression
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–—]/g, "-")
    .replace(/\^/g, "^")
    .replace(/½/g, "0.5")
    .replace(/¼/g, "0.25")
    .replace(/π/g, "pi")
    .trim();
}

/** Splits "KE = 0.5 * 4 * 3^2" into its two sides. */
function splitEquation(line: string): { lhs: string; rhs: string } | null {
  const parts = line.split("=");
  if (parts.length !== 2) return null;
  const lhs = parts[0]!.trim();
  const rhs = parts[1]!.trim();
  if (!lhs || !rhs) return null;
  return { lhs, rhs };
}

/** Pulls a unit off the end of a value, e.g. "19.6 m/s" -> {value, unit}. */
function parseQuantity(text: string): { value: number; unitText: string | null } | null {
  const cleaned = normalize(text);
  const match = cleaned.match(/^([-+]?[\d.]+(?:[eE][-+]?\d+)?)\s*([a-zA-Z][a-zA-Z0-9^/*.\s-]*)?$/);
  if (!match) return null;
  const value = parseFloat(match[1]!);
  if (!Number.isFinite(value)) return null;
  return { value, unitText: match[2]?.trim() || null };
}

function closeEnough(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / scale <= RELATIVE_TOLERANCE;
}

/** True when the line is a numeric computation rather than symbolic algebra. */
export function looksQuantitative(line: string): boolean {
  const sides = splitEquation(line);
  if (!sides) return false;
  // A right-hand side that is purely numeric (with optional units) and a left
  // side that either names a quantity or is itself computable.
  return /\d/.test(sides.rhs) && !/[a-zA-Z]\s*[a-zA-Z]/.test(sides.rhs.replace(/\s/g, " "));
}

/**
 * Checks one computed line: that its stated result matches what its own
 * right-hand side evaluates to.
 */
export function verifyComputation(line: string): QuantitativeCheck | null {
  const sides = splitEquation(line);
  if (!sides) return null;

  const stated = parseQuantity(sides.rhs);
  const rhsExpression = normalize(sides.rhs);

  // If the right-hand side is already a bare number there is nothing to compute
  // on this line alone — it is a statement, checked against the previous step.
  if (stated && !/[+\-*/^]/.test(rhsExpression.replace(/^[-+]/, ""))) return null;

  try {
    const computed = Number(evaluate(rhsExpression.replace(/[a-zA-Z][a-zA-Z0-9]*\s*$/, "")));
    if (!Number.isFinite(computed)) return null;
    return {
      isValid: true,
      note: `Evaluates to ${round(computed)}.`,
    };
  } catch {
    return null;
  }
}

function round(n: number): string {
  const r = Math.round(n * 1e6) / 1e6;
  return String(r);
}

/**
 * Verifies that a computed step follows from the one before it: the value the
 * student wrote must equal what the previous line actually evaluates to.
 *
 * Example chain, all checkable:
 *   v = u + a*t
 *   v = 0 + 9.8 * 2      ← substitution
 *   v = 19.6             ← arithmetic  ✓
 *   v = 19.6 m/s         ← units
 */
export function verifyQuantitativeStep(prevLine: string, nextLine: string): QuantitativeCheck | null {
  const prev = splitEquation(prevLine);
  const next = splitEquation(nextLine);
  if (!prev || !next) return null;

  const prevRhs = normalize(prev.rhs);
  const nextRhs = normalize(next.rhs);

  // Strip any trailing unit so the arithmetic can be compared on its own.
  const stripUnit = (s: string) => s.replace(/\s*[a-zA-Z][a-zA-Z0-9^/*.\s-]*$/, "").trim() || s;

  let prevValue: number | null = null;
  let nextValue: number | null = null;
  try {
    prevValue = Number(evaluate(stripUnit(prevRhs)));
  } catch {
    prevValue = null;
  }
  try {
    nextValue = Number(evaluate(stripUnit(nextRhs)));
  } catch {
    nextValue = null;
  }

  const unitCheck = compareUnits(prev.rhs, next.rhs);

  if (prevValue === null || nextValue === null || !Number.isFinite(prevValue) || !Number.isFinite(nextValue)) {
    // Not something we can evaluate — say so rather than guessing.
    return null;
  }

  if (!closeEnough(prevValue, nextValue)) {
    return {
      isValid: false,
      note: `This should come to ${round(prevValue)}, but you wrote ${round(nextValue)}.`,
      unitProblem: unitCheck ?? undefined,
    };
  }

  if (unitCheck) {
    return {
      isValid: false,
      note: unitCheck,
      unitProblem: unitCheck,
    };
  }

  return { isValid: true, note: "The arithmetic checks out." };
}

/**
 * Compares the units on two expressions. Returns a message when they disagree,
 * or null when they match (or when neither carries units).
 */
export function compareUnits(prevExpression: string, nextExpression: string): string | null {
  const prevUnit = extractUnit(prevExpression);
  const nextUnit = extractUnit(nextExpression);

  // Units appearing for the first time (a student adding them at the end) is
  // normal working, not an error.
  if (!prevUnit || !nextUnit) return null;
  if (prevUnit === nextUnit) return null;

  try {
    const a = unit(`1 ${prevUnit}`) as Unit;
    const b = unit(`1 ${nextUnit}`) as Unit;
    // Same dimension written differently (m/s vs km/h) is fine.
    if (a.equalBase(b)) return null;
    return `The units don't match: ${prevUnit} became ${nextUnit}, which measures a different quantity.`;
  } catch {
    // Unrecognised unit strings — don't accuse on something we can't parse.
    return null;
  }
}

function extractUnit(expression: string): string | null {
  const match = normalize(expression).match(/[\d.)\s]([a-zA-Z][a-zA-Z0-9^/*·\s-]*)$/);
  const candidate = match?.[1]?.trim();
  if (!candidate) return null;
  // Single letters are usually variables, not units.
  if (candidate.length === 1 && !/[gsmNJWAKC]/.test(candidate)) return null;
  try {
    unit(`1 ${candidate}`);
    return candidate;
  } catch {
    return null;
  }
}

/**
 * What a miscomputed line should have said: the value its own right-hand side
 * actually evaluates to, keeping whatever the student was naming on the left.
 *
 * Derived by evaluating their expression — never generated, and never an
 * algebraic rearrangement, which would answer a question they weren't asking.
 */
/**
 * Formats a computed result in the form its own inputs imply.
 *
 * An exact quotient of whole numbers is a fraction: two thirds is "2/3", and
 * writing "0.666667" would quietly introduce an error into the one line the
 * student is being asked to trust. A value computed from decimals is a
 * measurement, and "147/5" is not how anyone writes 29.4 m/s.
 */
function formatResult(value: number, sourceExpression: string): string {
  const sourceHasDecimals = /\d\.\d/.test(sourceExpression);
  if (sourceHasDecimals) {
    // Trim floating-point noise without inventing precision.
    return String(Math.round(value * 1e6) / 1e6);
  }
  return fmt(value);
}

export function correctQuantitativeStep(prevLine: string, nextLine: string): string | null {
  const prev = splitEquation(prevLine);
  const next = splitEquation(nextLine);
  if (!prev || !next) return null;

  const stripUnit = (s: string) => s.replace(/\s*[a-zA-Z][a-zA-Z0-9^/*.\s-]*$/, "").trim() || s;

  try {
    const value = Number(evaluate(stripUnit(normalize(prev.rhs))));
    if (!Number.isFinite(value)) return null;
    // Keep any unit the student had written on this line.
    const unitSuffix = next.rhs.match(/\s([a-zA-Z][a-zA-Z0-9^/*·\s-]*)$/)?.[1]?.trim();
    return `${next.lhs.trim()} = ${formatResult(value, prev.rhs)}${unitSuffix ? ` ${unitSuffix}` : ""}`;
  } catch {
    return null;
  }
}
