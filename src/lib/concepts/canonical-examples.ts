/**
 * One worked example per concept, written down rather than generated.
 *
 * The concept explainer has no student working to draw from — someone asking
 * "explain distribution" hasn't written anything yet. The diagram still has to
 * come from real numbers, so these are curated examples that the existing
 * deterministic visual selector can parse exactly as if a student had written
 * them. Nothing here is produced at request time.
 *
 * Concepts whose visuals need no expression (the biology process flows) are
 * absent on purpose: `selectConceptVisual` already builds those from its own
 * curated table.
 */

export interface CanonicalExample {
  /** The line the visual is computed from. */
  expression: string;
  /** The next line, where the visual needs a before/after pair. */
  corrected?: string;
  /** What the example is showing, in the student's language. */
  caption: string;
  /**
   * The slug to hand `selectConceptVisual`, when the concept's own slug has no
   * visual of its own but a related one draws the same idea honestly.
   */
  visualSlug?: string;
}

export const CANONICAL_EXAMPLES: Record<string, CanonicalExample> = {
  algebra: {
    expression: "3x + 5 = 20",
    corrected: "3x = 15",
    caption: "A worked example: strip the constant, then the coefficient.",
  },
  equations: {
    expression: "2x + 7 = 15",
    corrected: "2x = 8",
    caption: "A worked example: both sides stay equal at every line.",
  },
  "inverse-operations": {
    expression: "2x + 7 = 15",
    corrected: "2x = 8",
    caption: "A worked example: subtract 7 from both sides, not just one.",
  },
  "sign-handling": {
    expression: "x + 6 = 10",
    corrected: "x = 4",
    caption: "A worked example: moving +6 across means subtracting 6.",
  },
  distribution: {
    expression: "-4(x + 2)",
    corrected: "-4x - 8",
    caption: "A worked example: the -4 reaches both terms, sign included.",
  },
  factoring: {
    expression: "12 = 3 x 4",
    corrected: "12 = 3 x 4",
    caption: "A worked example: break the number into a factor pair.",
  },
  quadratics: {
    expression: "y = 2x + 0",
    corrected: "y = 2x + 0",
    caption: "A worked example: plotting the line the roots sit on.",
    visualSlug: "linear-graphing",
  },
  fractions: {
    expression: "3/4",
    corrected: "3/4",
    caption: "A worked example: three of four equal parts of one whole.",
  },
  "linear-graphing": {
    expression: "y = 2x + 1",
    corrected: "y = 2x + 1",
    caption: "A worked example: start at the intercept, apply the slope once.",
  },
  "units-and-dimensions": {
    expression: "2x + 7 = 15",
    corrected: "2x = 8",
    caption: "A worked example: the same balance rule that keeps units consistent.",
    visualSlug: "inverse-operations",
  },
  "formula-substitution": {
    expression: "2x + 7 = 15",
    corrected: "2x = 8",
    caption: "A worked example: substitute, then isolate the unknown.",
    visualSlug: "inverse-operations",
  },
  kinematics: {
    expression: "y = 2x + 1",
    corrected: "y = 2x + 1",
    caption: "A worked example: a velocity-time line — the gradient is the acceleration.",
    visualSlug: "linear-graphing",
  },
  "energy-and-work": {
    expression: "y = 2x + 0",
    corrected: "y = 2x + 0",
    caption: "A worked example: energy rising in proportion to the distance moved.",
    visualSlug: "linear-graphing",
  },
  "newtons-laws": {
    expression: "y = 2x + 0",
    corrected: "y = 2x + 0",
    caption: "A worked example: with mass fixed, acceleration is proportional to force.",
    visualSlug: "linear-graphing",
  },
  "chemical-equations": {
    expression: "2H2 + O2 -> 2H2O",
    corrected: "2H2 + O2 -> 2H2O",
    caption: "A worked example: every atom on the left appears on the right.",
    visualSlug: "balancing-equations",
  },
  "balancing-equations": {
    expression: "2H2 + O2 -> 2H2O",
    corrected: "2H2 + O2 -> 2H2O",
    caption: "A worked example: coefficients balance it, never the subscripts.",
  },
  "moles-and-stoichiometry": {
    expression: "N2 + 3H2 -> 2NH3",
    corrected: "N2 + 3H2 -> 2NH3",
    caption: "A worked example: the coefficients are the mole ratio.",
    visualSlug: "balancing-equations",
  },
  "atomic-structure": {
    expression: "2H2 + O2 -> 2H2O",
    corrected: "2H2 + O2 -> 2H2O",
    caption: "A worked example: atoms are rearranged, never created or destroyed.",
    visualSlug: "balancing-equations",
  },
  "genetics-inheritance": {
    expression: "Aa x Aa",
    corrected: "Aa x Aa",
    caption: "A worked example: one allele from each parent, every combination counted.",
  },
};

/** The visual selector expects the slugs it already knows about. */
export function exampleFor(slug: string): CanonicalExample | null {
  return CANONICAL_EXAMPLES[slug] ?? null;
}
