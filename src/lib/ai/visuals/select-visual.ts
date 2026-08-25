import { parseLinearEquation } from "@/lib/math/linear-parse";

export type VisualModule =
  | { kind: "balance"; steps: { leftLabel: string; rightLabel: string; opLabel?: string }[]; caption: string }
  | { kind: "number-line"; from: number; to: number; caption: string }
  | { kind: "distributive-area"; a: number; b: number; c: number; caption: string }
  | { kind: "factor-tree"; levels: { parent: string; left: string; right: string }[]; caption: string }
  | { kind: "fraction"; numerator: number; denominator: number; label?: string; caption: string }
  | {
      kind: "coordinate-plane";
      points: { x: number; y: number; label?: string; color?: string }[];
      range?: number;
      caption: string;
    }
  | { kind: "none" };

/**
 * Chooses a visual module and computes its numeric parameters deterministically
 * from the already-verified equation string produced earlier in the pipeline
 * (math-verifier.ts). This deliberately does NOT ask a model to invent the
 * numbers that go in the diagram — per the spec, an image/text generator must
 * never be trusted with the critical numbers in a math visual. If the concept
 * has no safe deterministic mapping, or the equation string can't be parsed,
 * this returns `{ kind: "none" }` and the caller shows the existing plain-text
 * explanation instead of a fabricated diagram (reliability rule: safe fallback
 * over confident-looking nonsense).
 */
export function selectConceptVisual(params: {
  conceptSlug: string;
  originalExpression?: string | null; // e.g. first reasoning step, "2x + 7 = 15"
  correctedExpression?: string | null; // e.g. the repaired next step, "2x = 8"
}): VisualModule {
  const { conceptSlug, originalExpression, correctedExpression } = params;

  if (["inverse-operations", "equations", "algebra"].includes(conceptSlug)) {
    const before = originalExpression ? parseLinearEquation(originalExpression) : null;
    if (!before) return { kind: "none" };

    const opLabel = `${before.constantOp === "+" ? "-" : "+"}${before.constant}`;
    const afterRhs = before.constantOp === "+" ? before.rhs - before.constant : before.rhs + before.constant;
    const term = before.coefficient === 1 ? before.variable : `${before.coefficient}${before.variable}`;

    return {
      kind: "balance",
      steps: [
        {
          leftLabel: originalExpression!.split("=")[0]!.trim(),
          rightLabel: originalExpression!.split("=")[1]!.trim(),
        },
        { leftLabel: term, rightLabel: String(afterRhs), opLabel },
      ],
      caption: "Whatever you do to one side, do to the other — or the scale tips out of balance.",
    };
  }

  if (conceptSlug === "sign-handling") {
    const before = originalExpression ? parseLinearEquation(originalExpression) : null;
    if (!before) return { kind: "none" };
    const from = before.rhs;
    const to = before.constantOp === "+" ? before.rhs - before.constant : before.rhs + before.constant;
    return {
      kind: "number-line",
      from,
      to,
      caption: `Subtracting moves left on the number line; adding moves right — check the direction matches the operation.`,
    };
  }

  if (conceptSlug === "distribution") {
    const before = originalExpression ? parseLinearEquation(originalExpression) : null;
    // Distribution problems are usually written as a(b + c) rather than a linear
    // equation, so try a dedicated pattern first.
    const dist = originalExpression?.match(/(-?\d+)\s*\(\s*(-?\d+)\s*\+\s*(-?\d+)\s*\)/);
    if (dist) {
      const [, a, b, c] = dist;
      return {
        kind: "distributive-area",
        a: parseFloat(a!),
        b: parseFloat(b!),
        c: parseFloat(c!),
        caption: "The multiplier outside the parentheses applies to every term inside it.",
      };
    }
    if (before) {
      return {
        kind: "distributive-area",
        a: before.coefficient,
        b: before.constant,
        c: 0,
        caption: "The multiplier outside the parentheses applies to every term inside it.",
      };
    }
    return { kind: "none" };
  }

  if (conceptSlug === "factoring") {
    // Only render if we have a clean "product = factor × factor" style corrected
    // expression to draw from — never invent a factor pair.
    const m = correctedExpression?.match(/=\s*(-?\d+)\s*[×x\*]\s*(-?\d+)/i) ?? originalExpression?.match(/(-?\d+)\s*=\s*(-?\d+)\s*[×x\*]\s*(-?\d+)/);
    if (!m) return { kind: "none" };
    const parent = m.length === 3 ? String(parseInt(m[1]!) * parseInt(m[2]!)) : m[1]!;
    const left = m.length === 3 ? m[1]! : m[2]!;
    const right = m.length === 3 ? m[2]! : m[3]!;
    return {
      kind: "factor-tree",
      levels: [{ parent, left, right }],
      caption: "Break the number down into a pair of factors that multiply back to it.",
    };
  }

  if (conceptSlug === "fractions") {
    // Only render off a real "n/d" fraction found in the student's corrected
    // (or, failing that, original) expression — never invent a numerator or
    // denominator that wasn't actually part of the verified work.
    const source = correctedExpression ?? originalExpression ?? "";
    const match = source.match(/(-?\d+)\s*\/\s*(\d+)/);
    if (!match) return { kind: "none" };
    const numerator = parseInt(match[1]!, 10);
    const denominator = parseInt(match[2]!, 10);
    if (!denominator || denominator <= 0) return { kind: "none" };
    return {
      kind: "fraction",
      numerator,
      denominator,
      label: `${numerator}/${denominator}`,
      caption: "Each segment is one equal part of the whole — the shaded segments show the fraction's value.",
    };
  }

  if (conceptSlug === "linear-graphing") {
    // Parse a slope-intercept equation "y = mx + b" (or "y=mx-b") from the
    // verified expression and plot exactly two deterministic points: the
    // y-intercept and one point found by applying the slope once. No point
    // is invented beyond what the algebra directly implies.
    const source = correctedExpression ?? originalExpression ?? "";
    const match = source.replace(/\s+/g, "").match(/y=(-?\d*)x([+-]\d+)?/i);
    if (!match) return { kind: "none" };
    const rawM = match[1];
    const m = rawM === "" || rawM === undefined ? 1 : rawM === "-" ? -1 : parseInt(rawM, 10);
    const b = match[2] ? parseInt(match[2], 10) : 0;
    return {
      kind: "coordinate-plane",
      points: [
        { x: 0, y: b, label: `(0, ${b})`, color: "#8B5CF6" },
        { x: 1, y: m + b, label: `(1, ${m + b})`, color: "#22C55E" },
      ],
      range: Math.max(6, Math.abs(b) + Math.abs(m) + 2),
      caption: "Start at the y-intercept, then apply the slope once to find a second point on the line.",
    };
  }

  return { kind: "none" };
}
