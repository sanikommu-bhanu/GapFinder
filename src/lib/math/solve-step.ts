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

function fmt(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const rounded = Math.round(n * 1e6) / 1e6;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
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

  const solution = -form.k / form.m;
  const studentIsolatesVariable = /^\s*[a-zA-Z]\s*=/.test(studentNextExpr.replace(/\s/g, " "));

  // The student jumped to a final answer ("x = 11") — correct that answer.
  if (studentIsolatesVariable) return `${form.variable} = ${fmt(solution)}`;

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

/**
 * The full correct solution chain for a linear equation, used to show a
 * student the path they should have taken. Every line is derived, not written.
 */
export function correctSolutionChain(expr: string): string[] | null {
  const pretty = parseLinearEquation(expr);
  const form = toLinearForm(expr);
  if (!form || Math.abs(form.m) < 1e-12) return null;
  const solution = -form.k / form.m;

  const chain = [expr.trim()];
  if (pretty && pretty.constant !== 0) {
    const inverse = pretty.constantOp === "+" ? "-" : "+";
    const coefficient = pretty.coefficient === 1 ? "" : pretty.coefficient === -1 ? "-" : fmt(pretty.coefficient);
    chain.push(`${coefficient}${pretty.variable} = ${fmt(pretty.rhs)} ${inverse} ${fmt(pretty.constant)}`);
    const isolated = pretty.constantOp === "+" ? pretty.rhs - pretty.constant : pretty.rhs + pretty.constant;
    if (Math.abs(pretty.coefficient) !== 1) chain.push(`${coefficient}${pretty.variable} = ${fmt(isolated)}`);
  }
  chain.push(`${form.variable} = ${fmt(solution)}`);
  return Array.from(new Set(chain));
}
