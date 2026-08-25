/**
 * Chemical equation verification.
 *
 * Balancing is one of the few things in chemistry that is *provably* right or
 * wrong, so it gets a real verifier rather than a model's opinion: parse both
 * sides into atom counts and compare. A student who writes an unbalanced
 * equation is told exactly which element doesn't add up and by how much.
 *
 * Everything here is arithmetic on element counts. No model is involved.
 */

export interface AtomCounts {
  [element: string]: number;
}

export interface BalanceCheck {
  isBalanced: boolean;
  left: AtomCounts;
  right: AtomCounts;
  /** Elements that don't match, with both counts. */
  mismatches: { element: string; left: number; right: number }[];
  note: string;
}

const ARROW = /(<->|<=>|->|→|⇌|=>)/;

/**
 * Counts atoms in one formula unit, e.g. "2Ca(OH)2" -> {Ca: 2, O: 4, H: 4}.
 * Handles a leading coefficient, nested groups, and subscripts.
 */
export function countAtoms(formula: string): AtomCounts | null {
  const trimmed = formula.trim().replace(/\s+/g, "");
  if (!trimmed) return null;

  // Leading stoichiometric coefficient, e.g. the 2 in "2H2O".
  const coefficientMatch = trimmed.match(/^(\d+)/);
  const coefficient = coefficientMatch ? parseInt(coefficientMatch[1]!, 10) : 1;
  const body = coefficientMatch ? trimmed.slice(coefficientMatch[1]!.length) : trimmed;
  if (!body) return null;

  const counts: AtomCounts = {};
  // Stack of multipliers so nested groups like Al2(SO4)3 resolve correctly.
  const stack: AtomCounts[] = [{}];

  let i = 0;
  while (i < body.length) {
    const char = body[i]!;

    if (char === "(" || char === "[") {
      stack.push({});
      i += 1;
      continue;
    }

    if (char === ")" || char === "]") {
      const group = stack.pop();
      if (!group || stack.length === 0) return null;
      i += 1;
      const multiplierMatch = body.slice(i).match(/^(\d+)/);
      const multiplier = multiplierMatch ? parseInt(multiplierMatch[1]!, 10) : 1;
      if (multiplierMatch) i += multiplierMatch[1]!.length;
      const parent = stack[stack.length - 1]!;
      for (const [element, n] of Object.entries(group)) {
        parent[element] = (parent[element] ?? 0) + n * multiplier;
      }
      continue;
    }

    // An element symbol: uppercase letter then optional lowercase letters.
    const elementMatch = body.slice(i).match(/^([A-Z][a-z]{0,2})(\d*)/);
    if (!elementMatch) return null;
    const element = elementMatch[1]!;
    const subscript = elementMatch[2] ? parseInt(elementMatch[2], 10) : 1;
    const current = stack[stack.length - 1]!;
    current[element] = (current[element] ?? 0) + subscript;
    i += elementMatch[0]!.length;
  }

  if (stack.length !== 1) return null; // unclosed bracket
  for (const [element, n] of Object.entries(stack[0]!)) {
    counts[element] = (counts[element] ?? 0) + n * coefficient;
  }
  return counts;
}

/** Sums atom counts across the species on one side of an equation. */
function countSide(side: string): AtomCounts | null {
  const totals: AtomCounts = {};
  // Split on "+" that separates species, not one inside a charge like Na+.
  const species = side.split(/\s\+\s|(?<=[a-zA-Z0-9)\]])\s*\+\s*(?=\d*[A-Z])/);
  for (const raw of species) {
    const cleaned = raw
      .replace(/\((s|l|g|aq)\)/gi, "") // state symbols carry no atoms
      .replace(/[⁺⁻]/g, "")
      .trim();
    if (!cleaned) continue;
    const counts = countAtoms(cleaned);
    if (!counts) return null;
    for (const [element, n] of Object.entries(counts)) {
      totals[element] = (totals[element] ?? 0) + n;
    }
  }
  return Object.keys(totals).length > 0 ? totals : null;
}

/** True when the string looks like a chemical equation rather than algebra. */
export function looksLikeChemicalEquation(text: string): boolean {
  if (!ARROW.test(text)) return false;
  // At least one element symbol, and no algebra-style lone variables.
  return /[A-Z][a-z]?\d*/.test(text) && countSide(text.split(ARROW)[0] ?? "") !== null;
}

/**
 * Checks whether a chemical equation is balanced, and says which elements
 * aren't when it isn't.
 */
export function checkChemicalBalance(equation: string): BalanceCheck | null {
  const parts = equation.split(ARROW);
  if (parts.length < 3) return null;

  const left = countSide(parts[0]!);
  const right = countSide(parts[2]!);
  if (!left || !right) return null;

  const elements = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort();
  const mismatches = elements
    .map((element) => ({ element, left: left[element] ?? 0, right: right[element] ?? 0 }))
    .filter((m) => m.left !== m.right);

  if (mismatches.length === 0) {
    return {
      isBalanced: true,
      left,
      right,
      mismatches: [],
      note: `Balanced — ${elements.map((e) => `${e}: ${left[e]}`).join(", ")} on both sides.`,
    };
  }

  const detail = mismatches
    .map((m) => `${m.element} (${m.left} on the left, ${m.right} on the right)`)
    .join("; ");

  return {
    isBalanced: false,
    left,
    right,
    mismatches,
    note: `Not balanced: ${detail}.`,
  };
}

/**
 * Verifies a step in a balancing problem: the atoms present must not change
 * between steps — only the coefficients may — and the target is balance.
 */
export function verifyChemicalStep(prevEquation: string, nextEquation: string): { isValid: boolean; note: string } {
  const prev = checkChemicalBalance(prevEquation);
  const next = checkChemicalBalance(nextEquation);

  if (!next) return { isValid: false, note: "This line couldn't be read as a chemical equation." };

  // The species themselves must be the same; only coefficients may change.
  if (prev) {
    const prevElements = new Set([...Object.keys(prev.left), ...Object.keys(prev.right)]);
    const nextElements = new Set([...Object.keys(next.left), ...Object.keys(next.right)]);
    const added = [...nextElements].filter((e) => !prevElements.has(e));
    const removed = [...prevElements].filter((e) => !nextElements.has(e));
    if (added.length > 0 || removed.length > 0) {
      const changes = [
        added.length ? `${added.join(", ")} appeared` : "",
        removed.length ? `${removed.join(", ")} disappeared` : "",
      ]
        .filter(Boolean)
        .join(" and ");
      return { isValid: false, note: `Elements can't be created or destroyed — ${changes}.` };
    }
  }

  return next.isBalanced
    ? { isValid: true, note: next.note }
    : { isValid: false, note: next.note };
}
