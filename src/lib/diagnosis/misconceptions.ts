/**
 * A fixed catalogue of documented misconceptions.
 *
 * Letting a language model name the misconception in its own words each time
 * produces a diagnosis that reads well and cannot be counted. Two students with
 * identical errors get different labels, nothing aggregates, and there is no
 * way to check whether the classification was reasonable.
 *
 * So classification is a lookup into this closed list. Each entry has a stable
 * code, a description in the words the research literature uses, and — where
 * the error has an algebraic signature — a deterministic detector that fires
 * without any model involvement. The model's job is reduced to choosing among
 * these codes, which is a question it can be held to.
 *
 * The algebra entries follow the misconception categories described in the
 * mathematics-education literature on early algebra errors (Kieran on the
 * equals sign and equation-solving; Küchemann on letter interpretation; Matz
 * on extrapolation from arithmetic rules). The science entries follow the same
 * pattern for the errors those subjects reliably produce.
 */

export type MisconceptionSubject = "Math" | "Physics" | "Chemistry" | "Biology";

export interface Misconception {
  /** Stable identifier — safe to count, aggregate and compare across students. */
  code: string;
  subject: MisconceptionSubject;
  /** Short name shown to a student. */
  name: string;
  /** What the student believes, stated as the rule they are actually applying. */
  studentRule: string;
  /** Why that rule is wrong, in one sentence. */
  whyItFails: string;
  /** The concept slug this maps to in the knowledge graph. */
  conceptSlug: string;
  /** The question to ask that makes the student notice it themselves. */
  socraticPrompt: string;
}

export const MISCONCEPTIONS: Misconception[] = [
  // ---------------------------------------------------------------- Math
  {
    code: "M-TRANSPOSE-SIGN",
    subject: "Math",
    name: "Moving a term without inverting it",
    studentRule: "A term can be moved across the equals sign as it is.",
    whyItFails:
      "Moving a term is shorthand for applying its inverse to both sides. Carrying it across unchanged applies the operation to one side only, so the two sides stop describing the same value.",
    conceptSlug: "sign-handling",
    socraticPrompt:
      "You moved that term to the other side. What operation would you have to do to BOTH sides to make it disappear from the left?",
  },
  {
    code: "M-DISTRIBUTE-FIRST-ONLY",
    subject: "Math",
    name: "Distributing to the first term only",
    studentRule: "The multiplier outside a bracket applies to the first term inside it.",
    whyItFails:
      "A bracket groups terms that are all being multiplied. Reaching only the first one silently changes what is inside the bracket.",
    conceptSlug: "distribution",
    socraticPrompt:
      "If you wrote out that bracket as a repeated addition instead, how many times would the second term appear?",
  },
  {
    code: "M-DISTRIBUTE-NEGATIVE",
    subject: "Math",
    name: "Losing the sign when distributing a negative",
    studentRule: "A negative outside a bracket attaches only to the first term.",
    whyItFails:
      "The sign is part of the multiplier, so it multiplies every term inside — including changing the sign of the second one.",
    conceptSlug: "distribution",
    socraticPrompt: "What is a negative number multiplied by a positive one? Now check the second term.",
  },
  {
    code: "M-ONE-SIDED-OPERATION",
    subject: "Math",
    name: "Operating on one side only",
    studentRule: "An operation can be applied where it is needed.",
    whyItFails:
      "An equation asserts two expressions are equal. Changing one side alone breaks that assertion, however sensible the operation looked.",
    conceptSlug: "inverse-operations",
    socraticPrompt:
      "You divided the left side. What happens to a balance scale if you take weight off one pan only?",
  },
  {
    code: "M-EQUALS-AS-ANSWER",
    subject: "Math",
    name: "Reading = as 'now write the answer'",
    studentRule: "The equals sign announces a result rather than stating a balance.",
    whyItFails:
      "In arithmetic the equals sign usually precedes an answer, so it gets read as an instruction. In algebra it is a claim of equality that has to stay true on every line.",
    conceptSlug: "equations",
    socraticPrompt:
      "Substitute your answer back into the original equation. Do the two sides come out to the same number?",
  },
  {
    code: "M-ARITHMETIC-SLIP",
    subject: "Math",
    name: "Arithmetic slip in an otherwise valid step",
    studentRule: "(No false rule — the method was right and the computation was not.)",
    whyItFails: "The reasoning holds; the number produced by it does not.",
    conceptSlug: "equations",
    socraticPrompt: "Your method is right here. Work out that line again on its own — what do you get?",
  },

  // ------------------------------------------------------------- Physics
  {
    code: "P-UNIT-MISMATCH",
    subject: "Physics",
    name: "Units that stop matching the quantity",
    studentRule: "Units are a label added at the end.",
    whyItFails:
      "Units carry through every operation. If the units of a result are not the units of the quantity being found, the operations that produced it were not the right ones.",
    conceptSlug: "units-and-dimensions",
    socraticPrompt: "What units should this answer have? Now carry the units through your calculation — do they match?",
  },
  {
    code: "P-SUBSTITUTION-SLIP",
    subject: "Physics",
    name: "Value substituted for the wrong symbol",
    studentRule: "The numbers can be placed into the formula in the order they were given.",
    whyItFails:
      "Each symbol names a specific quantity. A value in the wrong place computes something real — just not the thing that was asked for.",
    conceptSlug: "formula-substitution",
    socraticPrompt: "Go back to the formula and say out loud what each letter stands for. Does every value match its letter?",
  },
  {
    code: "P-ARITHMETIC-SLIP",
    subject: "Physics",
    name: "Arithmetic slip after a correct substitution",
    studentRule: "(No false rule — the substitution was right and the computation was not.)",
    whyItFails: "The physics is right; the arithmetic that followed is not.",
    conceptSlug: "formula-substitution",
    socraticPrompt: "Your substitution is correct. Evaluate that line again by itself — what number comes out?",
  },
  {
    code: "P-NET-FORCE",
    subject: "Physics",
    name: "Using one force where the net force is needed",
    studentRule: "F in F = ma is the force you were told about.",
    whyItFails:
      "F is the resultant of every force acting. Using a single applied force while friction or weight also acts gives an acceleration that is too large.",
    conceptSlug: "newtons-laws",
    socraticPrompt: "List every force acting on the object. Which ones did your F include?",
  },

  // ----------------------------------------------------------- Chemistry
  {
    code: "C-SUBSCRIPT-CHANGED",
    subject: "Chemistry",
    name: "Changing a subscript to balance",
    studentRule: "Any number in the equation can be adjusted to make the counts match.",
    whyItFails:
      "A subscript is part of the substance's identity. Changing it does make the count work, and it also answers a question about a different chemical than the one asked about.",
    conceptSlug: "balancing-equations",
    socraticPrompt: "You changed a number inside a formula. Is the substance on that line still the same chemical it was?",
  },
  {
    code: "C-UNBALANCED-FINAL",
    subject: "Chemistry",
    name: "Stopping before the equation balances",
    studentRule: "Balancing is finished when the element being worked on matches.",
    whyItFails:
      "Fixing one element commonly unbalances another. The equation is only balanced when every element matches at the same time.",
    conceptSlug: "balancing-equations",
    socraticPrompt: "Count each element on both sides one at a time. Which one still doesn't match?",
  },
  {
    code: "C-MASS-NOT-MOLE-RATIO",
    subject: "Chemistry",
    name: "Applying the coefficient ratio to masses",
    studentRule: "The numbers in a balanced equation are a ratio of grams.",
    whyItFails:
      "Coefficients give a ratio of moles. Different substances weigh different amounts per mole, so applying the ratio to masses compares things that are not comparable.",
    conceptSlug: "moles-and-stoichiometry",
    socraticPrompt: "Does one mole of each of those substances weigh the same? What has to happen before you use that ratio?",
  },

  // ------------------------------------------------------------- Biology
  {
    code: "B-PHOTOSYNTHESIS-AS-BREATHING",
    subject: "Biology",
    name: "Treating photosynthesis as the plant breathing",
    studentRule: "Photosynthesis is what plants do instead of respiring.",
    whyItFails:
      "Photosynthesis stores energy and respiration releases it. Plants do both, which is why the gas exchange balance changes after dark.",
    conceptSlug: "photosynthesis",
    socraticPrompt: "A plant in a dark cupboard for a week — is it doing anything with energy? What?",
  },
  {
    code: "B-RESPIRATION-AS-BREATHING",
    subject: "Biology",
    name: "Confusing respiration with breathing",
    studentRule: "Respiration is the movement of air in and out of lungs.",
    whyItFails:
      "Respiration is a chemical process in every living cell. Treating it as breathing makes it impossible to explain how a plant or a bacterium releases energy.",
    conceptSlug: "respiration",
    socraticPrompt: "Do trees have lungs? Do their cells still need energy? What is that process called?",
  },
  {
    code: "B-GENOTYPE-PHENOTYPE",
    subject: "Biology",
    name: "Confusing genotype with phenotype",
    studentRule: "The alleles carried and the characteristic shown are the same thing.",
    whyItFails:
      "Two different genotypes can produce the same phenotype, which is exactly why a trait can skip a generation and reappear.",
    conceptSlug: "genetics-inheritance",
    socraticPrompt: "Can two individuals look the same but carry different alleles? What would that mean here?",
  },
  {
    code: "B-DOMINANT-MEANS-COMMON",
    subject: "Biology",
    name: "Assuming dominant means common",
    studentRule: "A dominant allele is the one most individuals have.",
    whyItFails:
      "Dominance describes which allele shows when both are present. It says nothing about how frequent the allele is in a population.",
    conceptSlug: "genetics-inheritance",
    socraticPrompt: "If an allele is dominant, does that tell you anything about how many people carry it?",
  },
];

/** Fallback used when no catalogue entry matches — never invents a label. */
export const UNCLASSIFIED: Misconception = {
  code: "UNCLASSIFIED",
  subject: "Math",
  name: "Not matched to a known misconception",
  studentRule: "(We could not identify a documented misconception behind this step.)",
  whyItFails: "The step does not follow from the one above it, but the pattern isn't one we have a catalogue entry for.",
  conceptSlug: "equations",
  socraticPrompt: "Compare this line with the one above it. What changed between them, exactly?",
};

export function getMisconception(code: string): Misconception {
  return MISCONCEPTIONS.find((m) => m.code === code) ?? UNCLASSIFIED;
}

/** The codes a model may choose from, scoped to the subject being worked on. */
export function codesForSubject(subject: string): Misconception[] {
  const matched = MISCONCEPTIONS.filter((m) => m.subject.toLowerCase() === subject.toLowerCase());
  return matched.length > 0 ? matched : MISCONCEPTIONS;
}
