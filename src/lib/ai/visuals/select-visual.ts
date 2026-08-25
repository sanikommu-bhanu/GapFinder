import { parseLinearEquation } from "@/lib/math/linear-parse";
import { checkChemicalBalance } from "@/lib/verification/domains/chemistry";

export type VisualModule =
  | { kind: "balance"; steps: { leftLabel: string; rightLabel: string; opLabel?: string }[]; caption: string }
  | { kind: "number-line"; from: number; to: number; caption: string }
  | {
      kind: "distributive-area";
      a: number;
      /** Coefficient of the variable term inside the bracket (1 when implicit). */
      b: number;
      /** Constant term inside the bracket. */
      c: number;
      /** Variable letter, when the bracket contains one. */
      variable?: string;
      caption: string;
    }
  | { kind: "factor-tree"; levels: { parent: string; left: string; right: string }[]; caption: string }
  | { kind: "fraction"; numerator: number; denominator: number; label?: string; caption: string }
  | {
      kind: "coordinate-plane";
      points: { x: number; y: number; label?: string; color?: string }[];
      range?: number;
      /** Joins the points in order — a relationship, not a scatter. */
      connect?: boolean;
      xLabel?: string;
      yLabel?: string;
      /** The relationship being drawn, shown on the plot. */
      equation?: string;
      caption: string;
    }
  | {
      kind: "atom-balance";
      left: Record<string, number>;
      right: Record<string, number>;
      caption: string;
    }
  | {
      kind: "punnett";
      parentA: string[];
      parentB: string[];
      dominant: string;
      caption: string;
    }
  | {
      kind: "process-flow";
      inputs: string[];
      process: string;
      location: string;
      outputs: string[];
      energy?: { direction: "stores" | "releases"; label: string };
      caption: string;
    }
  | {
      kind: "atom-shells";
      symbol: string;
      name: string;
      protons: number;
      neutrons: number;
      shells: number[];
      caption: string;
    }
  | {
      kind: "cell-compare";
      shared: string[];
      plantOnly: string[];
      animalOnly: string[];
      caption: string;
    }
  | { kind: "none" };

/**
 * Curated process facts for the biology concepts.
 *
 * These are written down rather than derived because a cell's biology isn't
 * computable from the student's sentence — but they are still fixed, checkable
 * statements from the same curated corpus the explanations are grounded in,
 * not something a model produced at render time.
 */
const PROCESS_FLOWS: Record<
  string,
  {
    inputs: string[];
    process: string;
    location: string;
    outputs: string[];
    energy: { direction: "stores" | "releases"; label: string };
    caption: string;
  }
> = {
  photosynthesis: {
    inputs: ["Carbon dioxide", "Water", "Light"],
    process: "Photosynthesis",
    location: "chloroplast",
    outputs: ["Glucose", "Oxygen"],
    energy: { direction: "stores", label: "light energy becomes chemical energy in glucose" },
    caption: "Oxygen is a by-product, not the purpose. The purpose is storing energy as glucose.",
  },
  respiration: {
    inputs: ["Glucose", "Oxygen"],
    process: "Aerobic respiration",
    location: "mitochondrion",
    outputs: ["Carbon dioxide", "Water"],
    energy: { direction: "releases", label: "stored chemical energy becomes usable energy" },
    caption: "The reverse direction of photosynthesis — and every living cell does it, plants included.",
  },
};

/**
 * Curated structural facts for the two concepts whose diagram is a picture of a
 * thing rather than a computation.
 *
 * Sodium is the worked example for atomic structure because its single outer
 * electron is what makes its behaviour legible; the cell comparison is drawn as
 * plant-versus-animal because the mistake this concept produces is a boundary
 * error, not a naming one.
 */
const STRUCTURES = {
  "atomic-structure": {
    symbol: "Na",
    name: "Sodium",
    protons: 11,
    neutrons: 12,
    shells: [2, 8, 1],
    caption:
      "Sodium: 11 protons, 11 electrons in shells of 2, 8 and 1. The single outer electron is why it reacts the way it does.",
  },
  "cell-structure": {
    shared: ["Nucleus", "Cell membrane", "Mitochondria", "Cytoplasm", "Ribosomes"],
    plantOnly: ["Cell wall", "Chloroplasts", "Permanent vacuole"],
    animalOnly: [],
    caption:
      "Plant cells have mitochondria too — they respire as well as photosynthesise. The wall sits outside the membrane; it does not replace it.",
  },
} as const;

/**
 * Straight-line relationships in physics, written down rather than derived.
 *
 * Each one is the defining equation of the concept with the other quantities
 * held fixed, so the line drawn is the relationship itself. The axis labels are
 * part of the data for a reason: an unlabelled line through the origin could be
 * any claim at all, which would make it decoration rather than a diagram.
 */
const PHYSICS_RELATIONSHIPS: Record<
  string,
  {
    slope: number;
    intercept: number;
    xs: number[];
    xLabel: string;
    yLabel: string;
    equation: string;
    caption: string;
  }
> = {
  kinematics: {
    slope: 2,
    intercept: 1,
    xs: [0, 1, 2, 3],
    xLabel: "time (s)",
    yLabel: "velocity (m/s)",
    equation: "v = u + at, with u = 1 m/s and a = 2 m/s²",
    caption: "On a velocity-time graph the gradient is the acceleration, and the area underneath is the distance.",
  },
  "newtons-laws": {
    slope: 0.5,
    intercept: 0,
    xs: [0, 2, 4, 6],
    xLabel: "resultant force (N)",
    yLabel: "acceleration (m/s²)",
    equation: "a = F / m, with m = 2 kg",
    caption: "Double the resultant force and the acceleration doubles — the mass sets the gradient.",
  },
  "energy-and-work": {
    slope: 3,
    intercept: 0,
    xs: [0, 1, 2, 3],
    xLabel: "distance moved (m)",
    yLabel: "work done (J)",
    equation: "W = Fd, with F = 3 N",
    caption: "Work is force times distance, so with a steady force it rises in a straight line.",
  },
};

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
  /**
   * Allows the curated worked examples — the physics relationships and the
   * parabola — to be drawn.
   *
   * Off by default, and deliberately so. Those diagrams are correct statements
   * about the concept but say nothing about *this* student's working, so
   * showing one beside a diagnosis would put a picture on screen that their own
   * lines can't be checked against. The concept explainer, where there is no
   * student working at all, is the one place that is the right thing to draw.
   */
  allowCuratedExample?: boolean;
}): VisualModule {
  const { conceptSlug, originalExpression, correctedExpression, allowCuratedExample } = params;

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
    const bracket = findDistributedTerm(originalExpression ?? "");
    if (bracket) {
      return {
        kind: "distributive-area",
        ...bracket,
        caption:
          bracket.a < 0
            ? "A negative multiplier reaches both terms — including the sign of the second one."
            : "The multiplier outside the parentheses applies to every term inside it.",
      };
    }
    return { kind: "none" };
  }

  // ---------------------------------------------------------------- Chemistry
  if (conceptSlug === "balancing-equations" || conceptSlug === "chemical-equations") {
    // Drawn from the same atom counts the verifier used to judge the step, so
    // the picture and the verdict can never disagree.
    const source = correctedExpression ?? originalExpression ?? "";
    const balance = checkChemicalBalance(source);
    if (!balance) return { kind: "none" };
    return {
      kind: "atom-balance",
      left: balance.left,
      right: balance.right,
      caption: "Balancing changes the number in front of a substance — never the formula itself.",
    };
  }

  // ----------------------------------------------------------------- Biology
  if (conceptSlug === "genetics-inheritance") {
    const cross = parseGeneticCross(originalExpression ?? correctedExpression ?? "");
    if (!cross) return { kind: "none" };
    return {
      kind: "punnett",
      ...cross,
      caption: "Every cell is one allele from each parent. Count them for the ratio.",
    };
  }

  const flow = PROCESS_FLOWS[conceptSlug];
  if (flow) {
    return { kind: "process-flow", ...flow };
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

  if (conceptSlug === "atomic-structure" && allowCuratedExample) {
    const atom = STRUCTURES["atomic-structure"];
    return { kind: "atom-shells", ...atom, shells: [...atom.shells] };
  }

  if (conceptSlug === "cell-structure" && allowCuratedExample) {
    const cell = STRUCTURES["cell-structure"];
    return {
      kind: "cell-compare",
      shared: [...cell.shared],
      plantOnly: [...cell.plantOnly],
      animalOnly: [...cell.animalOnly],
      caption: cell.caption,
    };
  }

  // ------------------------------------------------------------------ Physics
  //
  // These are straight-line relationships between two named quantities, which
  // is a real diagram rather than a decorative one — but only if the axes say
  // what they are. Every point is computed from the stated equation.
  const relationship = allowCuratedExample ? PHYSICS_RELATIONSHIPS[conceptSlug] : undefined;
  if (relationship) {
    const points = relationship.xs.map((x) => ({
      x,
      y: relationship.slope * x + relationship.intercept,
      label: undefined,
      color: "#8B5CF6",
    }));
    const range = Math.max(6, ...points.map((p) => Math.abs(p.y) + 1), ...points.map((p) => Math.abs(p.x) + 1));
    return {
      kind: "coordinate-plane",
      points,
      range,
      connect: true,
      xLabel: relationship.xLabel,
      yLabel: relationship.yLabel,
      equation: relationship.equation,
      caption: relationship.caption,
    };
  }

  if (conceptSlug === "quadratics" && allowCuratedExample) {
    // y = x^2 - 4, plotted from its own definition. The roots are where it
    // crosses, which is the thing students are actually being asked to find.
    const xs = [-3, -2, -1, 0, 1, 2, 3];
    return {
      kind: "coordinate-plane",
      points: xs.map((x) => ({
        x,
        y: x * x - 4,
        label: x * x - 4 === 0 ? `(${x}, 0)` : undefined,
        color: x * x - 4 === 0 ? "#22C55E" : "#8B5CF6",
      })),
      range: 6,
      connect: true,
      xLabel: "x",
      yLabel: "y",
      equation: "y = x² - 4",
      caption: "The roots are where the curve crosses zero — here, x = -2 and x = 2.",
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
      connect: true,
      xLabel: "x",
      yLabel: "y",
      equation: source.trim(),
      caption: "Start at the y-intercept, then apply the slope once to find a second point on the line.",
    };
  }

  return { kind: "none" };
}

/**
 * Finds a bracketed term to draw, e.g. "-4(x+2)" or "2(3x-5)".
 *
 * Prefers a negative multiplier when the expression has one: distributing a
 * negative across a bracket is where students most often lose a sign, so that
 * is the term worth putting on screen. Numbers come straight out of the
 * student's own verified expression — never from a model.
 */
/**
 * Reads a monohybrid cross like "Aa x Aa" out of the student's own line.
 * Returns null for anything that isn't unambiguously a cross, rather than
 * guessing at which letters were meant to be alleles.
 */
function parseGeneticCross(
  text: string
): { parentA: string[]; parentB: string[]; dominant: string } | null {
  const match = text.replace(/\s+/g, "").match(/([A-Za-z]{2})[x×*]([A-Za-z]{2})/);
  if (!match) return null;

  const [, a, b] = match;
  const letters = new Set([...a!, ...b!].map((c) => c.toLowerCase()));
  // A monohybrid cross uses one gene, so exactly one letter, in two cases.
  if (letters.size !== 1) return null;

  const dominant = [...a!, ...b!].find((c) => c === c.toUpperCase());
  if (!dominant) return null;

  return { parentA: a!.split(""), parentB: b!.split(""), dominant };
}

function findDistributedTerm(
  expression: string
): { a: number; b: number; c: number; variable?: string } | null {
  // The leading sign can be separated from its coefficient by a space, as in
  // "2(3x-5) - 4(x+2)" — that term's multiplier is -4, not 4, and getting it
  // wrong would put the wrong diagram in front of the student.
  const pattern = /([+-]?)\s*(\d*)\s*\(\s*(-?\d*)([a-zA-Z]?)\s*([+-])\s*(\d+)\s*\)/g;
  const matches: { a: number; b: number; c: number; variable?: string }[] = [];

  for (const m of expression.matchAll(pattern)) {
    const [, sign, rawA, rawB, variable, innerSign, rawC] = m;
    const magnitude = rawA === "" || rawA === undefined ? 1 : parseFloat(rawA);
    const a = (sign === "-" ? -1 : 1) * magnitude;
    const b = rawB === "" || rawB === undefined ? 1 : rawB === "-" ? -1 : parseFloat(rawB);
    const c = (innerSign === "-" ? -1 : 1) * parseFloat(rawC!);
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) continue;
    matches.push({ a, b, c, variable: variable || undefined });
  }

  if (matches.length === 0) return null;
  return matches.find((m) => m.a < 0) ?? matches[0]!;
}
