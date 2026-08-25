import { evaluate, simplify } from "mathjs";
import { parseLinearEquation } from "./linear-parse";

/**
 * Deterministic "what the step should have been" derivation.
 *
 * GapFinder's most important screen tells a student: *you wrote X, but it
 * should be Y*. Y must never be invented by a language model — if it were, the
 * one number the student is asked to trust would be the one number nobody
 * verified. So Y is computed here, algebraically, from the previous step that
 * the verifier already confirmed was valid.
 */

export interface LinearForm {
  /** coefficient m in the canonical form m*x + k = 0 */
  m: number;
  /** constant k in the canonical form m*x + k = 0 */
  k: number;
  variable: string;
}

/** Reduces "A = B" to the canonical linear form m*x + k = 0. */
export function toLinearForm(expr: string): LinearForm | null {
  const parts = expr.split("=");
  if (parts.length !== 2) return null;
  const variable = expr.match(/[a-zA-Z]/)?.[0];
  if (!variable) return null;
  try {
    const diff = simplify(`(${parts[0]!.trim()}) - (${parts[1]!.trim()})`).toString();
    const at0 = Number(evaluate(diff, { [variable]: 0 }));
    const at1 = Number(evaluate(diff, { [variable]: 1 }));
    if (!Number.isFinite(at0) || !Number.isFinite(at1)) return null;
    const m = at1 - at0;
    // Reject anything non-linear: a linear function is fully determined by two
    // points, so a third must agree or we refuse to guess.
    const at2 = Number(evaluate(diff, { [variable]: 2 }));
    if (!Number.isFinite(at2) || Math.abs(at2 - (2 * m + at0)) > 1e-9) return null;
    return { m, k: at0, variable };
  } catch {
    return null;
  }
}

/** Solves a linear equation for its single variable. Returns null if unsolvable. */
export function solveLinear(expr: string): number | null {
  const form = toLinearForm(expr);
  if (!form || Math.abs(form.m) < 1e-12) return null;
  return -form.k / form.m;
}

/**
 * Formats a derived value the way a maths teacher would write it.
 *
 * A third is "1/3", not "0.333333" — showing a truncated decimal as the correct
 * answer would be teaching the student something slightly false, on the one
 * screen where precision is the entire point.
 */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));

  // Test the raw value: rounding first pushes exact thirds just past the
  // tolerance and turns "2/3" into "0.6667".
  const fraction = asSimpleFraction(n);
  if (fraction) return fraction;

  // Not a tidy fraction — show a bounded decimal rather than a long tail.
  return String(Math.round(n * 1e4) / 1e4);
}

/** Recovers a/b for small b, so exact answers stay exact. */
function asSimpleFraction(value: number): string | null {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  for (let denominator = 2; denominator <= 24; denominator++) {
    const numerator = abs * denominator;
    if (Math.abs(numerator - Math.round(numerator)) < 1e-7) {
      const n = Math.round(numerator);
      const g = gcd(n, denominator);
      const num = n / g;
      const den = denominator / g;
      if (den === 1) return `${sign}${num}`;
      return `${sign}${num}/${den}`;
    }
  }
  return null;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Given the previous (verified-valid) step and the student's next step, returns
 * the step the student *should* have written — matched to the shape of what
 * they actually attempted, so the correction reads as a minimal edit rather
 * than a leap to the answer.
 *
 * Returns null when the shape isn't recognised; callers must then say nothing
 * rather than show an unverified correction.
 */
export function correctNextStep(prevExpr: string, studentNextExpr: string): string | null {
  const form = toLinearForm(prevExpr);
  if (!form || Math.abs(form.m) < 1e-12) return null;

  // For brackets or variables on both sides there is no single "inverse
  // operation" to show, so the correction is whatever the correct path does
  // next from exactly where the student was — the properly expanded line,
  // rather than a leap to a form they never attempted.
  const chain = parseLinearEquation(prevExpr) === null ? correctSolutionChain(prevExpr) : null;
  if (chain && chain.length > 1) {
    const normalizedPrev = prevExpr.replace(/\s/g, "");
    const index = chain.findIndex((line) => line.replace(/\s/g, "") === normalizedPrev);
    const next = index >= 0 ? chain[index + 1] : chain[1];
    // This is by construction exactly one step on from where they were, so it
    // is a correction rather than a leap to the answer. The student's line may
    // be the unsimplified expansion while this is the collected one — that is
    // the same move, shown tidily.
    if (next && next.replace(/\s/g, "") !== studentNextExpr.replace(/\s/g, "")) return next;
  }

  const solution = -form.k / form.m;

  const rhs = studentNextExpr.split("=")[1]?.trim() ?? "";
  const startsWithBareVariable = /^\s*[a-zA-Z]\s*=/.test(studentNextExpr.replace(/\s/g, " "));
  // "x = 7" is an answer; "x = 12 + 5" is a move still being worked out. The
  // second deserves the minimal correction ("x = 12 - 5"), because that is the
  // single edit the student actually needs to see.
  const rhsIsUnevaluated = /[+\-*/]/.test(rhs.replace(/^[+-]/, ""));

  if (startsWithBareVariable && !rhsIsUnevaluated) {
    return `${form.variable} = ${fmt(solution)}`;
  }

  // Otherwise they were mid-isolation (e.g. "2x = 15 + 7"). Show the correct
  // isolation of the variable term, preserving the arithmetic they were doing
  // so the difference is a single visible sign/operation.
  const pretty = parseLinearEquation(prevExpr);
  if (pretty && pretty.constant !== 0) {
    const inverse = pretty.constantOp === "+" ? "-" : "+";
    const coefficient = pretty.coefficient === 1 ? "" : pretty.coefficient === -1 ? "-" : fmt(pretty.coefficient);
    return `${coefficient}${pretty.variable} = ${fmt(pretty.rhs)} ${inverse} ${fmt(pretty.constant)}`;
  }

  const coefficient = form.m === 1 ? "" : form.m === -1 ? "-" : fmt(form.m);
  return `${coefficient}${form.variable} = ${fmt(-form.k)}`;
}

/** Reduces one SIDE of an equation to slope/intercept, or null if non-linear. */
function sideForm(expression: string, variable: string): { m: number; c: number } | null {
  try {
    const at0 = Number(evaluate(expression, { [variable]: 0 }));
    const at1 = Number(evaluate(expression, { [variable]: 1 }));
    const at2 = Number(evaluate(expression, { [variable]: 2 }));
    if (![at0, at1, at2].every(Number.isFinite)) return null;
    const m = at1 - at0;
    if (Math.abs(at2 - (2 * m + at0)) > 1e-9) return null;
    return { m, c: at0 };
  } catch {
    return null;
  }
}

/** Writes "m*x + c" the way a person would: "2x - 18", "-x", "3x + 4". */
function term(m: number, c: number, variable: string): string {
  const coefficient = m === 1 ? variable : m === -1 ? `-${variable}` : `${fmt(m)}${variable}`;
  if (Math.abs(m) < 1e-12) return fmt(c);
  if (Math.abs(c) < 1e-12) return coefficient;
  return `${coefficient} ${c < 0 ? "-" : "+"} ${fmt(Math.abs(c))}`;
}

/**
 * The full correct solution path, derived from the equation itself.
 *
 * This is what the student is shown as "how it should have gone", so every line
 * has to be a real algebraic step rather than a jump to the answer. It handles
 * brackets and variables on both sides by reducing each side to its linear
 * form and then writing out the moves in the order a person would make them:
 * expand and collect, gather the variable, divide.
 */
export function correctSolutionChain(expr: string): string[] | null {
  const form = toLinearForm(expr);
  if (!form || Math.abs(form.m) < 1e-12) return null;

  const [lhsRaw, rhsRaw] = expr.split("=");
  if (!lhsRaw || !rhsRaw) return null;
  const lhs = sideForm(lhsRaw.trim(), form.variable);
  const rhs = sideForm(rhsRaw.trim(), form.variable);
  if (!lhs || !rhs) return null;

  const solution = -form.k / form.m;
  const chain: string[] = [expr.trim()];
  const push = (line: string) => {
    if (chain[chain.length - 1]?.replace(/\s/g, "") !== line.replace(/\s/g, "")) chain.push(line);
  };

  // A plain "ax + b = c" gets the operation written out — "2x = 15 - 7" shows
  // the student the move they missed, where "2x = 8" only shows its result.
  const simple = parseLinearEquation(expr);
  if (simple && simple.constant !== 0) {
    const inverse = simple.constantOp === "+" ? "-" : "+";
    const coefficient =
      simple.coefficient === 1 ? "" : simple.coefficient === -1 ? "-" : fmt(simple.coefficient);
    push(`${coefficient}${simple.variable} = ${fmt(simple.rhs)} ${inverse} ${fmt(simple.constant)}`);
    const isolated = simple.constantOp === "+" ? simple.rhs - simple.constant : simple.rhs + simple.constant;
    if (Math.abs(simple.coefficient) !== 1) push(`${coefficient}${simple.variable} = ${fmt(isolated)}`);
    push(`${simple.variable} = ${fmt(solution)}`);
    return chain;
  }

  // Anything with brackets or variables on both sides: expand and collect first.
  push(`${term(lhs.m, lhs.c, form.variable)} = ${term(rhs.m, rhs.c, form.variable)}`);

  // 2. Gather the variable on the left and the constants on the right.
  if (Math.abs(rhs.m) > 1e-12 || Math.abs(lhs.c) > 1e-12) {
    const varSide = term(lhs.m - rhs.m, 0, form.variable);
    push(`${varSide} = ${fmt(rhs.c - lhs.c)}`);
  }

  // 3. Divide through by the coefficient.
  if (Math.abs(form.m) !== 1) push(`${form.variable} = ${fmt(rhs.c - lhs.c)} / ${fmt(form.m)}`);

  push(`${form.variable} = ${fmt(solution)}`);
  return chain;
}
