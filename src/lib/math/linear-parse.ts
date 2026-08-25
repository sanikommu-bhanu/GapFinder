/**
 * Deterministic, regex-based extraction of the numbers in a simple linear
 * equation string (e.g. "2x + 7 = 15", "4x - 9 = 27", "7 + 3x = 25").
 *
 * This intentionally does NOT call an LLM. The spec is explicit that visual
 * modules must never get their critical numbers from an image/text generator
 * — so instead of asking a model to "supply structured parameters", we parse
 * the already-verified equation string that the deterministic math verifier
 * produced earlier in the pipeline. If the shape isn't recognized, we return
 * null and the caller falls back to a non-numeric explanation (see
 * select-visual.ts) rather than guessing.
 */

export interface LinearEquation {
  /** coefficient on the variable term, e.g. 2 in "2x + 7 = 15" */
  coefficient: number;
  /** the variable name, e.g. "x" */
  variable: string;
  /** the constant being added/subtracted alongside the variable term */
  constant: number;
  /** "+" if the equation reads "ax + b", "-" if "ax - b" (as written) */
  constantOp: "+" | "-";
  /** right-hand side value */
  rhs: number;
  /** whether the variable term appeared first ("2x + 7 = 15") or the
   * constant did ("7 + 3x = 25") — useful for transfer-style visuals */
  variableFirst: boolean;
}

const CLEAN = (s: string) =>
  s
    .replace(/[×·]/g, "*")
    .replace(/\s+/g, "")
    .replace(/−/g, "-")
    .trim();

// ax + b = c   or   ax - b = c
const VAR_FIRST = /^([+-]?\d*\.?\d*)([a-zA-Z])([+-]\d+\.?\d*)=([+-]?\d+\.?\d*)$/;
// b + ax = c   or   -b + ax = c  (constant written before the variable term)
const CONST_FIRST = /^([+-]?\d+\.?\d*)([+-]\d*\.?\d*)([a-zA-Z])=([+-]?\d+\.?\d*)$/;
// ax = c  (no constant term)
const NO_CONST = /^([+-]?\d*\.?\d*)([a-zA-Z])=([+-]?\d+\.?\d*)$/;

function coef(raw: string): number {
  if (raw === "" || raw === "+") return 1;
  if (raw === "-") return -1;
  return parseFloat(raw);
}

export function parseLinearEquation(input: string): LinearEquation | null {
  const s = CLEAN(input);
  if (!s.includes("=")) return null;

  let m = s.match(VAR_FIRST);
  if (m) {
    const [, a, variable, b, c] = m;
    const bNum = parseFloat(b!);
    return {
      coefficient: coef(a!),
      variable: variable!,
      constant: Math.abs(bNum),
      constantOp: bNum < 0 ? "-" : "+",
      rhs: parseFloat(c!),
      variableFirst: true,
    };
  }

  m = s.match(CONST_FIRST);
  if (m) {
    const [, b, a, variable, c] = m;
    return {
      coefficient: coef(a!),
      variable: variable!,
      constant: Math.abs(parseFloat(b!)),
      constantOp: parseFloat(b!) < 0 ? "-" : "+",
      rhs: parseFloat(c!),
      variableFirst: false,
    };
  }

  m = s.match(NO_CONST);
  if (m) {
    const [, a, variable, c] = m;
    return {
      coefficient: coef(a!),
      variable: variable!,
      constant: 0,
      constantOp: "+",
      rhs: parseFloat(c!),
      variableFirst: true,
    };
  }

  return null;
}
