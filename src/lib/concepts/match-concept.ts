/**
 * Routing a student's words to a concept in the knowledge graph.
 *
 * Everything downstream — the diagram, the spoken lesson, the quiz — is drawn
 * from curated material attached to a concept. So this is the only place where
 * free text is allowed to influence what a student is told, and it is
 * deliberately a *routing* decision, not a content decision: the worst case is
 * landing on the wrong concept, never being told something invented.
 *
 * Scoring is deterministic and explainable. A match is returned only when it
 * clears a floor; below that the caller shows what the library does cover
 * rather than guessing.
 */

export interface MatchableConcept {
  id: string;
  slug: string;
  name: string;
  subject: string;
  description: string;
  /** Already-parsed common errors from the seeded catalogue. */
  commonErrors: string[];
}

export interface ConceptMatch {
  concept: MatchableConcept;
  score: number;
  /** Which signal carried the match, surfaced when we explain the routing. */
  via: "alias" | "name" | "description";
}

/**
 * Words a student is likely to use that aren't in the concept's own name.
 *
 * Curated rather than inferred: "mole" must reach stoichiometry and not
 * "molecule", and no amount of token overlap gets that right on its own.
 */
const ALIASES: Record<string, string[]> = {
  photosynthesis: ["photosynthesis", "photosynthesise", "photosynthesize", "chlorophyll", "chloroplast", "light reaction", "calvin", "how plants make food", "plants food", "plant energy"],
  respiration: ["respiration", "respire", "aerobic", "anaerobic", "mitochondria", "mitochondrion", "atp", "cellular respiration", "breathing", "lactic acid"],
  "cell-structure": ["cell", "cells", "organelle", "organelles", "nucleus", "membrane", "cell wall", "ribosome", "cytoplasm", "plant cell", "animal cell"],
  "genetics-inheritance": ["genetics", "inheritance", "allele", "alleles", "gene", "genes", "punnett", "dominant", "recessive", "genotype", "phenotype", "heredity", "dna inheritance", "monohybrid"],
  "chemical-equations": ["chemical equation", "reactants", "products", "reaction", "chemical reaction", "state symbols"],
  "balancing-equations": ["balancing", "balance", "balanced equation", "coefficients", "conservation of mass", "atom count"],
  "moles-and-stoichiometry": ["mole", "moles", "stoichiometry", "molar mass", "avogadro", "concentration", "titration", "limiting reagent"],
  "atomic-structure": ["atom", "atomic structure", "proton", "neutron", "electron", "shells", "isotope", "isotopes", "periodic table"],
  "units-and-dimensions": ["units", "unit", "dimensional analysis", "si units", "converting units", "dimensions"],
  "formula-substitution": ["substitution", "substituting", "rearranging formula", "plug in", "formula"],
  kinematics: ["kinematics", "suvat", "velocity", "acceleration", "displacement", "speed", "motion", "projectile"],
  "energy-and-work": ["energy", "work", "power", "kinetic energy", "potential energy", "joules", "conservation of energy"],
  "newtons-laws": ["newton", "newtons laws", "force", "forces", "free body", "friction", "momentum", "f = ma", "inertia"],
  algebra: ["algebra", "algebraic", "expression", "expressions", "variables", "like terms", "simplify"],
  equations: ["equation", "equations", "solve for x", "solving equations", "linear equation", "unknown"],
  "inverse-operations": ["inverse", "inverse operations", "opposite operation", "undo", "both sides", "isolate"],
  "sign-handling": ["signs", "sign", "negative", "negatives", "minus sign", "positive and negative", "transposing", "moving terms"],
  distribution: ["distribute", "distributing", "distribution", "expand", "expanding", "brackets", "parentheses", "distributive law", "distributive property"],
  factoring: ["factor", "factoring", "factorise", "factorize", "factorising", "common factor", "hcf"],
  quadratics: ["quadratic", "quadratics", "parabola", "roots", "quadratic formula", "completing the square", "x squared"],
  fractions: ["fraction", "fractions", "numerator", "denominator", "common denominator", "improper fraction", "mixed number"],
  "linear-graphing": ["graph", "graphing", "gradient", "slope", "y intercept", "straight line", "y = mx + c", "y = mx + b", "plotting"],
};

/** Below this the match isn't good enough to build a lesson on. */
const SCORE_FLOOR = 2.5;

export function matchConcept(
  topic: string,
  concepts: MatchableConcept[],
  opts: { subjectHint?: string } = {}
): { best: ConceptMatch | null; alternatives: MatchableConcept[] } {
  const query = normalise(topic);
  if (!query) return { best: null, alternatives: [] };

  const queryTokens = new Set(tokens(query));
  const scored: ConceptMatch[] = [];

  for (const concept of concepts) {
    let score = 0;
    let via: ConceptMatch["via"] = "description";

    // 1. Curated aliases — the strongest signal, and a whole-phrase match beats
    //    a single word so "cellular respiration" doesn't tie with "cell".
    for (const alias of ALIASES[concept.slug] ?? []) {
      const a = normalise(alias);
      if (!a) continue;
      if (query === a) {
        score += 10;
        via = "alias";
      } else if (containsPhrase(query, a)) {
        score += 5 + a.split(" ").length;
        via = "alias";
      }
    }

    // 2. The concept's own name.
    const nameTokens = tokens(normalise(concept.name));
    const nameHits = nameTokens.filter((t) => queryTokens.has(t)).length;
    if (nameHits > 0) {
      score += nameHits * 3;
      if (via !== "alias") via = "name";
      if (nameHits === nameTokens.length) score += 3;
    }

    // 3. Description and known errors — weak evidence, enough to break ties.
    const body = tokens(normalise(`${concept.description} ${concept.commonErrors.join(" ")}`));
    const bodySet = new Set(body);
    for (const t of queryTokens) if (bodySet.has(t)) score += 0.5;

    // A chosen subject is a hint, never a filter: a student browsing Biology
    // who asks about moles should still get moles.
    if (opts.subjectHint && concept.subject === opts.subjectHint) score += 1;

    if (score > 0) scored.push({ concept, score, via });
  }

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  return {
    best: best && best.score >= SCORE_FLOOR ? best : null,
    alternatives: scored.slice(best && best.score >= SCORE_FLOOR ? 1 : 0, 4).map((s) => s.concept),
  };
}

/** The slugs a router (deterministic or model) is allowed to choose from. */
export function knownSlugs(concepts: MatchableConcept[]): string[] {
  return concepts.map((c) => c.slug);
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+\-/= ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "the", "a", "an", "of", "and", "or", "to", "in", "on", "for", "is", "are",
  "was", "were", "be", "it", "its", "this", "that", "with", "how", "why",
  "what", "does", "do", "work", "works", "me", "my", "i", "you",
]);

function tokens(text: string): string[] {
  return text
    .split(" ")
    .map(stem)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Crude but predictable: enough to tie "equations" to "equation". */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function containsPhrase(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `);
}
