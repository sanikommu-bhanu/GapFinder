/**
 * GapFinder seed script
 * Populates the curated educational content the product reasons over: the
 * concept knowledge graph, the RAG knowledge chunks retrieved to ground every
 * explanation, and the achievement definitions.
 *
 * It seeds NO users and NO student data. Every analysis, gap, mastery score and
 * report in the app is produced by a real student action running through the
 * real pipeline.
 *
 * Run: npm run db:seed
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Looks up a seeded concept id, failing loudly rather than writing `undefined`. */
function cid(map: Record<string, string>, slug: string): string {
  const id = map[slug];
  if (!id) throw new Error(`Seed error: concept "${slug}" was not seeded before it was referenced.`);
  return id;
}

// ---------------------------------------------------------------------------
// 1. CONCEPT KNOWLEDGE GRAPH
// ---------------------------------------------------------------------------
// Algebra -> Equations -> Inverse Operations -> Sign Handling -> Distribution
//                                             -> Factoring -> Quadratics
const concepts = [
  {
    slug: "algebra",
    name: "Algebra",
    subject: "Math",
    description:
      "The branch of math that uses letters and symbols to represent numbers and quantities in formulas and equations.",
    commonErrors: ["Treating variables as labels instead of unknown quantities"],
  },
  {
    slug: "equations",
    name: "Equations",
    subject: "Math",
    description:
      "A statement that two expressions are equal, solved by isolating the unknown variable.",
    commonErrors: [
      "Not applying the same operation to both sides",
      "Losing track of the equals-sign balance",
    ],
  },
  {
    slug: "inverse-operations",
    name: "Inverse Operations",
    subject: "Math",
    description:
      "Undoing an operation with its opposite (addition/subtraction, multiplication/division) to isolate a variable.",
    commonErrors: [
      "Applying the inverse operation inconsistently to both sides",
      "Adding instead of subtracting (or vice versa)",
      "Forgetting to invert an operation at all",
    ],
  },
  {
    slug: "sign-handling",
    name: "Sign Handling",
    subject: "Math",
    description:
      "Correctly tracking positive and negative signs when moving terms across the equals sign or distributing.",
    commonErrors: [
      "Dropping a negative sign when moving a term",
      "Flipping a sign that shouldn't change",
      "Double-negative confusion",
    ],
  },
  {
    slug: "distribution",
    name: "Distribution",
    subject: "Math",
    description:
      "Multiplying a single term by each term inside a parenthesis: a(b + c) = ab + ac.",
    commonErrors: [
      "Only multiplying the first term inside the parenthesis",
      "Sign errors when distributing a negative coefficient",
    ],
  },
  {
    slug: "factoring",
    name: "Factoring",
    subject: "Math",
    description:
      "Rewriting an expression as a product of simpler terms, the reverse of distribution.",
    commonErrors: [
      "Choosing factor pairs that don't multiply to the constant term",
      "Sign mismatches between factor pairs",
    ],
  },
  {
    slug: "quadratics",
    name: "Quadratics",
    subject: "Math",
    description:
      "Equations of the form ax^2 + bx + c = 0, solved by factoring, completing the square, or the quadratic formula.",
    commonErrors: [
      "Misapplying the quadratic formula's sign in -b",
      "Forgetting the +/- when taking a square root",
    ],
  },
  {
    slug: "fractions",
    name: "Fractions",
    subject: "Math",
    description:
      "Representing and operating on parts of a whole, including simplifying, adding, and comparing fractions with a shared or different denominator.",
    commonErrors: [
      "Adding numerators and denominators straight across instead of finding a common denominator",
      "Failing to simplify the final fraction to lowest terms",
      "Treating a larger denominator as always meaning a larger fraction",
    ],
  },
  {
    slug: "linear-graphing",
    name: "Graphing Linear Equations",
    subject: "Math",
    description:
      "Plotting an equation in slope-intercept form (y = mx + b) on the coordinate plane by identifying the y-intercept and using the slope to find a second point.",
    commonErrors: [
      "Swapping the roles of slope and y-intercept",
      "Plotting the y-intercept on the x-axis or vice versa",
      "Miscounting rise/run when applying the slope",
    ],
  },

  // -------------------------------------------------------------------------
  // PHYSICS
  // -------------------------------------------------------------------------
  {
    slug: "units-and-dimensions",
    name: "Units and Dimensions",
    subject: "Physics",
    description:
      "Every physical quantity carries a unit, and units must stay consistent through a calculation. A result whose units are wrong is wrong, however tidy the arithmetic looks.",
    commonErrors: [
      "Dropping units partway through and losing track of what the number means",
      "Adding quantities that measure different things",
      "Mixing scales without converting (cm with m, minutes with seconds)",
    ],
  },
  {
    slug: "formula-substitution",
    name: "Formula Substitution",
    subject: "Physics",
    description:
      "Putting known values into a formula in place of their symbols, keeping each value with the symbol it belongs to before any arithmetic is done.",
    commonErrors: [
      "Substituting a value for the wrong symbol",
      "Computing before substituting, losing track of which quantity is which",
      "Skipping a symbol that is zero instead of substituting it",
    ],
  },
  {
    slug: "kinematics",
    name: "Kinematics",
    subject: "Physics",
    description:
      "Describing motion with displacement, velocity, acceleration and time, related by the equations of motion for constant acceleration.",
    commonErrors: [
      "Using a constant-acceleration equation when acceleration is not constant",
      "Sign errors on direction, treating deceleration as positive",
      "Confusing average velocity with instantaneous velocity",
    ],
  },
  {
    slug: "energy-and-work",
    name: "Energy and Work",
    subject: "Physics",
    description:
      "Work transfers energy. Kinetic energy depends on the square of speed and potential energy on height, and total energy is conserved in a closed system.",
    commonErrors: [
      "Forgetting to square the velocity in kinetic energy",
      "Omitting the factor of one half",
      "Treating energy as a vector and giving it a direction",
    ],
  },
  {
    slug: "newtons-laws",
    name: "Newtons Laws",
    subject: "Physics",
    description:
      "Force equals mass times acceleration. Forces come in equal and opposite pairs, and a body with no net force keeps doing whatever it was already doing.",
    commonErrors: [
      "Using a single force where the NET force is required",
      "Treating an action-reaction pair as acting on the same body",
      "Assuming continued motion requires a continued force",
    ],
  },

  // -------------------------------------------------------------------------
  // CHEMISTRY
  // -------------------------------------------------------------------------
  {
    slug: "chemical-equations",
    name: "Chemical Equations",
    subject: "Chemistry",
    description:
      "A chemical equation states which substances react and which are produced. Atoms are neither created nor destroyed, so every element must appear in equal numbers on both sides.",
    commonErrors: [
      "Changing a subscript instead of a coefficient to balance",
      "Balancing one element and unbalancing another without rechecking",
      "Forgetting that a coefficient multiplies every atom in the formula",
    ],
  },
  {
    slug: "balancing-equations",
    name: "Balancing Equations",
    subject: "Chemistry",
    description:
      "Choosing coefficients so each element appears the same number of times on both sides, without altering any chemical formula.",
    commonErrors: [
      "Altering a formula, turning H2O into H2O2, to make the count work",
      "Stopping as soon as one element balances",
      "Leaving fractional coefficients in a final answer",
    ],
  },
  {
    slug: "moles-and-stoichiometry",
    name: "Moles and Stoichiometry",
    subject: "Chemistry",
    description:
      "The mole links mass to number of particles. Coefficients in a balanced equation give the ratio in which substances react, which is what lets one quantity predict another.",
    commonErrors: [
      "Using mass ratios where mole ratios are required",
      "Taking ratios from an equation that is not balanced",
      "Confusing molar mass with molecular mass",
    ],
  },
  {
    slug: "atomic-structure",
    name: "Atomic Structure",
    subject: "Chemistry",
    description:
      "Protons decide the element, electrons decide bonding behaviour, and neutrons decide the isotope. Charge comes from an imbalance between protons and electrons.",
    commonErrors: [
      "Confusing atomic number with mass number",
      "Letting a neutral atom have a different electron and proton count",
      "Treating isotopes as different elements",
    ],
  },

  // -------------------------------------------------------------------------
  // BIOLOGY
  // -------------------------------------------------------------------------
  {
    slug: "cell-structure",
    name: "Cell Structure",
    subject: "Biology",
    description:
      "Cells are organised into structures whose shape follows their job: membranes control what enters, mitochondria release energy, chloroplasts capture light.",
    commonErrors: [
      "Giving a function to the wrong organelle",
      "Assuming plant cells have no mitochondria because they have chloroplasts",
      "Confusing the cell wall with the cell membrane",
    ],
  },
  {
    slug: "photosynthesis",
    name: "Photosynthesis",
    subject: "Biology",
    description:
      "Plants convert light energy into chemical energy stored in glucose, taking in carbon dioxide and water and releasing oxygen as a by-product.",
    commonErrors: [
      "Describing photosynthesis as how a plant breathes",
      "Swapping the reactants and the products",
      "Believing plants do not also respire",
    ],
  },
  {
    slug: "respiration",
    name: "Respiration",
    subject: "Biology",
    description:
      "Cells release energy from glucose. Aerobic respiration uses oxygen and yields far more energy than the anaerobic route.",
    commonErrors: [
      "Treating respiration and breathing as the same thing",
      "Thinking only animals respire",
      "Swapping the products of aerobic and anaerobic respiration",
    ],
  },
  {
    slug: "genetics-inheritance",
    name: "Genetics and Inheritance",
    subject: "Biology",
    description:
      "Alleles are inherited one from each parent. A dominant allele shows in the phenotype whenever it is present; a recessive one only when both copies are recessive.",
    commonErrors: [
      "Confusing genotype with phenotype",
      "Assuming dominant means more common in a population",
      "Reading a Punnett square as a guarantee rather than a probability",
    ],
  },
];


const relationships: [string, string, string][] = [
  ["algebra", "equations", "prerequisite"],
  ["equations", "inverse-operations", "prerequisite"],
  ["inverse-operations", "sign-handling", "prerequisite"],
  ["sign-handling", "distribution", "prerequisite"],
  ["distribution", "factoring", "prerequisite"],
  ["factoring", "quadratics", "prerequisite"],
  ["sign-handling", "factoring", "related"],
  ["algebra", "fractions", "prerequisite"],
  ["fractions", "equations", "related"],
  ["equations", "linear-graphing", "builds-on"],
  ["linear-graphing", "quadratics", "related"],
  // Reverse operations of each other — students frequently apply one
  // procedure when the other was called for.
  ["distribution", "factoring", "commonly-confused-with"],

  // Physics
  ["units-and-dimensions", "formula-substitution", "prerequisite"],
  ["formula-substitution", "kinematics", "prerequisite"],
  ["kinematics", "newtons-laws", "prerequisite"],
  ["newtons-laws", "energy-and-work", "prerequisite"],
  ["equations", "formula-substitution", "prerequisite"],
  ["sign-handling", "kinematics", "related"],
  // Both get reached for on "how much push does this need" questions.
  ["energy-and-work", "newtons-laws", "commonly-confused-with"],

  // Chemistry
  ["atomic-structure", "chemical-equations", "prerequisite"],
  ["chemical-equations", "balancing-equations", "prerequisite"],
  ["balancing-equations", "moles-and-stoichiometry", "prerequisite"],
  ["fractions", "moles-and-stoichiometry", "related"],
  // Changing a subscript "balances" the count while silently changing the substance.
  ["balancing-equations", "chemical-equations", "commonly-confused-with"],

  // Biology
  ["cell-structure", "photosynthesis", "prerequisite"],
  ["cell-structure", "respiration", "prerequisite"],
  ["cell-structure", "genetics-inheritance", "prerequisite"],
  ["photosynthesis", "respiration", "related"],
  // The classic pair students describe as exact opposites of one another.
  ["photosynthesis", "respiration", "commonly-confused-with"],
];

// ---------------------------------------------------------------------------
// 2. CURATED RAG KNOWLEDGE CHUNKS
// ---------------------------------------------------------------------------
type ChunkSeed = {
  concept: string;
  kind: "explanation" | "worked_example" | "misconception" | "teaching_strategy" | "practice_pattern";
  title: string;
  content: string;
  keywords: string[];
};

const chunks: ChunkSeed[] = [
  // ---------------------------------------------------------------------------
  // PHYSICS
  // ---------------------------------------------------------------------------
  {
    concept: "units-and-dimensions",
    kind: "explanation",
    title: "Units are part of the answer, not decoration",
    content:
      "A physical quantity is a number AND a unit; neither means anything alone. Carrying units through every line is also a free error check: if the units of your result are not the units the question asked for, something went wrong earlier, no matter how neat the arithmetic looks.",
    keywords: ["units", "dimensions", "metres", "seconds", "check", "consistent"],
  },
  {
    concept: "units-and-dimensions",
    kind: "misconception",
    title: "Adding quantities that measure different things",
    content:
      "Only quantities of the same kind can be added. Ten metres plus five seconds is not fifteen of anything. When an addition looks impossible dimensionally, the mistake is usually one line earlier, in which formula was chosen.",
    keywords: ["add", "different", "dimension", "mismatch", "metres", "seconds"],
  },
  {
    concept: "units-and-dimensions",
    kind: "teaching_strategy",
    title: "Convert first, compute second",
    content:
      "Put every quantity into base units before any arithmetic starts. Converting mid-calculation is where mixed scales creep in, because by then the numbers no longer visibly carry what they measure.",
    keywords: ["convert", "base units", "before", "scale", "kilometres"],
  },
  {
    concept: "formula-substitution",
    kind: "explanation",
    title: "Substitute before you simplify",
    content:
      "Write the formula, then replace each symbol with its value while the symbols are still visible. Doing arithmetic first means deciding what to multiply before establishing what each number represents, which is when values end up attached to the wrong symbol.",
    keywords: ["substitute", "formula", "values", "symbols", "replace"],
  },
  {
    concept: "formula-substitution",
    kind: "misconception",
    title: "Skipping a value that happens to be zero",
    content:
      "A quantity of zero still belongs in the substitution. Leaving it out makes the line unreadable to anyone checking it, including you, and it hides whether the zero was a genuine starting condition or something forgotten.",
    keywords: ["zero", "initial", "skip", "omit", "rest"],
  },
  {
    concept: "kinematics",
    kind: "worked_example",
    title: "Dropping an object from rest",
    content:
      "An object falls from rest for 3 seconds with acceleration 9.8 m/s^2. Using v = u + at with u = 0: v = 0 + 9.8 x 3, so v = 29.4 m/s. Writing the substitution line before the arithmetic line makes the check obvious.",
    keywords: ["kinematics", "falling", "rest", "velocity", "acceleration", "suvat"],
  },
  {
    concept: "kinematics",
    kind: "misconception",
    title: "Sign errors on direction",
    content:
      "Decide which direction is positive before starting, and keep it for the whole problem. Deceleration is not a separate idea; it is acceleration whose sign is opposite to the velocity. Switching convention halfway is the usual cause of an answer with the right size and the wrong sign.",
    keywords: ["sign", "direction", "negative", "deceleration", "convention"],
  },
  {
    concept: "energy-and-work",
    kind: "explanation",
    title: "Why kinetic energy squares the speed",
    content:
      "Kinetic energy is one half m v squared. The square is why stopping distance grows so sharply with speed: doubling speed quadruples the energy that has to go somewhere. Dropping either the square or the half changes the answer by a factor of two or four.",
    keywords: ["kinetic", "energy", "squared", "half", "speed", "mass"],
  },
  {
    concept: "energy-and-work",
    kind: "worked_example",
    title: "Kinetic energy of a moving mass",
    content:
      "A 4 kg mass moves at 3 m/s. KE = 0.5 x m x v^2, so KE = 0.5 x 4 x 3^2 = 0.5 x 4 x 9 = 18 J. Squaring before multiplying keeps the order of operations visible.",
    keywords: ["kinetic", "worked", "joules", "example", "mass", "velocity"],
  },
  {
    concept: "newtons-laws",
    kind: "explanation",
    title: "F = ma uses the NET force",
    content:
      "The F in F = ma is the resultant of every force acting on the body. Substituting a single applied force while friction or weight also acts is the most common way this equation is misused, and it produces an acceleration that is too large.",
    keywords: ["newton", "net force", "resultant", "friction", "acceleration"],
  },
  {
    concept: "newtons-laws",
    kind: "misconception",
    title: "Action-reaction pairs act on different bodies",
    content:
      "The third law pairs act on two different objects, which is why they never cancel each other out. If two forces you are calling a pair act on the same body, they are not an action-reaction pair.",
    keywords: ["third law", "action", "reaction", "pair", "cancel", "bodies"],
  },

  // ---------------------------------------------------------------------------
  // CHEMISTRY
  // ---------------------------------------------------------------------------
  {
    concept: "balancing-equations",
    kind: "explanation",
    title: "Coefficients balance, subscripts identify",
    content:
      "A subscript is part of a substance name: H2O and H2O2 are different chemicals. A coefficient says how many units of that substance take part. Balancing changes coefficients only, because changing a subscript answers a different question than the one asked.",
    keywords: ["coefficient", "subscript", "balance", "formula", "substance"],
  },
  {
    concept: "balancing-equations",
    kind: "misconception",
    title: "Changing a subscript to make the numbers work",
    content:
      "Turning H2O into H2O2 does make the oxygen count match, and it also turns water into hydrogen peroxide. The count is now right for a reaction that was not the one being asked about, which is why this is the single most damaging habit in balancing.",
    keywords: ["subscript", "change", "peroxide", "water", "wrong substance"],
  },
  {
    concept: "balancing-equations",
    kind: "worked_example",
    title: "Balancing methane combustion",
    content:
      "CH4 + O2 gives CO2 + H2O. Carbon balances at one each. Hydrogen: four on the left needs 2H2O on the right. That makes oxygen four on the right, so 2O2 on the left. Final: CH4 + 2O2 gives CO2 + 2H2O. Recheck every element after each change.",
    keywords: ["methane", "combustion", "balance", "worked", "oxygen", "carbon"],
  },
  {
    concept: "balancing-equations",
    kind: "teaching_strategy",
    title: "Leave oxygen and hydrogen until last",
    content:
      "Balance the elements that appear in only one substance on each side first, and leave oxygen and hydrogen for the end. They usually appear in several compounds, so fixing them early tends to unbalance them again.",
    keywords: ["strategy", "order", "oxygen", "hydrogen", "last", "method"],
  },
  {
    concept: "chemical-equations",
    kind: "explanation",
    title: "Conservation of mass is the whole rule",
    content:
      "Atoms are rearranged in a reaction, never created or destroyed. That single fact is why an equation must balance, and it is also the check: if an element appears on one side and not the other, something has been mis-copied.",
    keywords: ["conservation", "mass", "atoms", "rearranged", "destroyed"],
  },
  {
    concept: "moles-and-stoichiometry",
    kind: "explanation",
    title: "Ratios come from moles, not from mass",
    content:
      "Coefficients in a balanced equation are ratios of moles, not grams. Converting mass to moles first, using the ratio, then converting back is the order that works; applying the ratio directly to masses does not, because different substances weigh different amounts per mole.",
    keywords: ["mole", "ratio", "mass", "stoichiometry", "grams", "convert"],
  },
  {
    concept: "moles-and-stoichiometry",
    kind: "misconception",
    title: "Taking a ratio from an unbalanced equation",
    content:
      "Every stoichiometric ratio depends on the equation being balanced first. Reading coefficients off an unbalanced equation gives a ratio for a reaction that does not conserve atoms, so every number computed after it is wrong.",
    keywords: ["unbalanced", "ratio", "first", "stoichiometry", "coefficients"],
  },
  {
    concept: "atomic-structure",
    kind: "explanation",
    title: "Protons name the element, electrons do the chemistry",
    content:
      "The proton count is the atomic number and fixes which element it is. Electrons, particularly the outermost ones, determine how the atom bonds. Neutrons change the mass and give isotopes, without changing chemical behaviour.",
    keywords: ["proton", "electron", "neutron", "atomic number", "isotope"],
  },

  // ---------------------------------------------------------------------------
  // BIOLOGY
  // ---------------------------------------------------------------------------
  {
    concept: "photosynthesis",
    kind: "explanation",
    title: "What photosynthesis actually converts",
    content:
      "Photosynthesis converts light energy into chemical energy stored in glucose. Carbon dioxide and water go in, glucose and oxygen come out, and it happens in the chloroplast. The oxygen released is a by-product, not the purpose.",
    keywords: ["photosynthesis", "light", "glucose", "chloroplast", "oxygen", "carbon dioxide"],
  },
  {
    concept: "photosynthesis",
    kind: "misconception",
    title: "Photosynthesis is not the plant breathing",
    content:
      "Photosynthesis and respiration are different processes and plants do both. Photosynthesis stores energy; respiration releases it. A plant respires day and night, and photosynthesises only in light, which is why the gas exchange balance changes after dark.",
    keywords: ["breathing", "respiration", "opposite", "plants", "night", "confuse"],
  },
  {
    concept: "respiration",
    kind: "explanation",
    title: "Respiration releases energy, breathing moves air",
    content:
      "Respiration is a chemical process inside every living cell that releases energy from glucose. Breathing is the movement of air in and out of lungs. Using the words interchangeably hides that plants, bacteria and every one of your cells respire without breathing.",
    keywords: ["respiration", "breathing", "cells", "glucose", "energy", "difference"],
  },
  {
    concept: "respiration",
    kind: "misconception",
    title: "Mixing up the anaerobic products",
    content:
      "Aerobic respiration gives carbon dioxide and water and a large energy yield. Anaerobic respiration in muscle gives lactic acid, and in yeast gives ethanol and carbon dioxide, both with a much smaller yield. Which organism is involved decides which set applies.",
    keywords: ["anaerobic", "aerobic", "lactic", "ethanol", "yeast", "products"],
  },
  {
    concept: "cell-structure",
    kind: "explanation",
    title: "Structure follows function",
    content:
      "Each organelle looks the way it does because of what it does. Mitochondria are folded to maximise the surface where energy release happens; the cell membrane is a partial barrier because the cell needs selective control, not a wall.",
    keywords: ["organelle", "mitochondria", "membrane", "function", "structure"],
  },
  {
    concept: "cell-structure",
    kind: "misconception",
    title: "Plant cells have mitochondria too",
    content:
      "Chloroplasts capture light energy; mitochondria release stored energy. A plant needs both, because it has to use the glucose it makes. Having chloroplasts does not replace the need to respire.",
    keywords: ["plant", "mitochondria", "chloroplast", "both", "respire"],
  },
  {
    concept: "genetics-inheritance",
    kind: "explanation",
    title: "Genotype is the alleles, phenotype is what shows",
    content:
      "Genotype is the pair of alleles carried; phenotype is the characteristic that appears. Two different genotypes can give the same phenotype, which is why a trait can skip a generation and reappear.",
    keywords: ["genotype", "phenotype", "allele", "dominant", "recessive"],
  },
  {
    concept: "genetics-inheritance",
    kind: "misconception",
    title: "Dominant does not mean common",
    content:
      "A dominant allele masks a recessive one when both are present. It says nothing about how frequent the allele is in a population; plenty of dominant traits are rare, and plenty of recessive ones are widespread.",
    keywords: ["dominant", "common", "frequency", "population", "recessive", "mask"],
  },

  {
    concept: "inverse-operations",
    kind: "explanation",
    title: "What an inverse operation actually undoes",
    content:
      "Every operation has an opposite that cancels it out: addition undoes subtraction, multiplication undoes division. To isolate a variable, apply the inverse of whatever is being done to it, and apply that exact same inverse to both sides of the equation so the balance is preserved.",
    keywords: ["inverse", "opposite", "undo", "isolate", "both sides"],
  },
  {
    concept: "inverse-operations",
    kind: "misconception",
    title: "Applying the inverse to only one side",
    content:
      "A common misconception is subtracting a value from one side but forgetting to subtract it from the other, which breaks the equality. Students often do this when the operation 'looks finished' on the side they're focused on.",
    keywords: ["one side", "unbalanced", "forgot", "both sides"],
  },
  {
    concept: "inverse-operations",
    kind: "worked_example",
    title: "Isolating x in 2x + 7 = 15",
    content:
      "Subtract 7 from both sides: 2x = 8. Then divide both sides by 2: x = 4. Each step undoes the operation closest to the variable first, working outward.",
    keywords: ["2x+7", "worked example", "step by step"],
  },
  {
    concept: "inverse-operations",
    kind: "teaching_strategy",
    title: "Use a balance-scale mental model",
    content:
      "Picture the equation as a balance scale: whatever you remove from one pan, you must remove from the other or the scale tips. This concrete image helps students internalize why both sides need the same operation.",
    keywords: ["balance", "scale", "visual", "model"],
  },
  {
    concept: "sign-handling",
    kind: "explanation",
    title: "Why signs flip when moving terms",
    content:
      "Moving a term across the equals sign is really subtracting it from both sides, which is why a positive term becomes negative on the other side. The sign doesn't 'flip' by rule — it changes because of the subtraction being applied.",
    keywords: ["sign flip", "move term", "negative", "cross the equals"],
  },
  {
    concept: "sign-handling",
    kind: "misconception",
    title: "Dropping the negative sign",
    content:
      "Students frequently rewrite -7 as 7 when isolating a term, especially under time pressure. The error usually happens at the exact step where a term crosses the equals sign, not in the arithmetic that follows.",
    keywords: ["dropped sign", "negative", "lost minus"],
  },
  {
    concept: "sign-handling",
    kind: "worked_example",
    title: "Solving 2x = 15 - 7",
    content:
      "2x = 15 - 7 simplifies to 2x = 8, not 2x = 22. Combine the constant terms on the same side carefully, keeping each term's sign attached to it as it moves.",
    keywords: ["2x=15-7", "combine terms", "constants"],
  },
  {
    concept: "distribution",
    kind: "explanation",
    title: "Distributing across every term",
    content:
      "a(b + c) means a multiplies both b and c individually, producing ab + ac. Every term inside the parenthesis must be multiplied, not just the first one.",
    keywords: ["distribute", "parenthesis", "multiply each term"],
  },
  {
    concept: "distribution",
    kind: "misconception",
    title: "Only distributing to the first term",
    content:
      "A frequent error is multiplying the outside term by only the first term in the parenthesis and simply copying the second term unchanged.",
    keywords: ["first term only", "partial distribution"],
  },
  {
    concept: "distribution",
    kind: "worked_example",
    title: "Expanding -3(x - 4)",
    content:
      "-3(x - 4) = -3x + 12. The negative sign on -3 must be distributed to both terms, flipping the sign of -4 to +12.",
    keywords: ["negative distribution", "-3(x-4)"],
  },
  {
    concept: "factoring",
    kind: "explanation",
    title: "Factoring as reverse distribution",
    content:
      "Factoring finds two terms that, when distributed, reproduce the original expression. For x^2 + bx + c, look for two numbers that multiply to c and add to b.",
    keywords: ["factor pairs", "reverse distribution", "x^2+bx+c"],
  },
  {
    concept: "factoring",
    kind: "misconception",
    title: "Picking factors that add instead of multiply to c",
    content:
      "Students sometimes search for two numbers that sum to c rather than multiply to c, mixing up which condition applies to which coefficient.",
    keywords: ["sum vs product", "factor pair confusion"],
  },
  {
    concept: "factoring",
    kind: "practice_pattern",
    title: "Factor-pair table strategy",
    content:
      "List all factor pairs of the constant term, then check which pair sums to the middle coefficient. This systematic table avoids trial-and-error guessing.",
    keywords: ["factor table", "systematic", "strategy"],
  },
  {
    concept: "quadratics",
    kind: "explanation",
    title: "The quadratic formula's sign structure",
    content:
      "In x = (-b ± √(b²-4ac)) / 2a, the sign of b is inverted before the rest of the formula is applied, which is a frequent source of sign errors.",
    keywords: ["quadratic formula", "-b", "sign"],
  },
  {
    concept: "quadratics",
    kind: "misconception",
    title: "Forgetting the ± when taking a square root",
    content:
      "When solving by taking a square root directly, students often keep only the positive root and miss the negative solution.",
    keywords: ["plus minus", "square root", "two solutions"],
  },
  {
    concept: "equations",
    kind: "teaching_strategy",
    title: "Verify by substitution",
    content:
      "After solving, substitute the answer back into the original equation to confirm both sides are equal. This habit catches sign and arithmetic errors before they compound.",
    keywords: ["check answer", "substitute", "verify"],
  },
  {
    concept: "fractions",
    kind: "explanation",
    title: "Why fractions need a common denominator to add",
    content:
      "A fraction's denominator defines the size of each part, so two fractions can only be combined directly once their parts are the same size. Finding a common denominator rescales both fractions to matching part-sizes before the numerators are added.",
    keywords: ["common denominator", "add fractions", "equivalent fractions"],
  },
  {
    concept: "fractions",
    kind: "misconception",
    title: "Adding straight across",
    content:
      "Students often add numerator to numerator and denominator to denominator without finding a common denominator first, producing a fraction that doesn't represent the correct total.",
    keywords: ["straight across", "wrong denominator", "add numerators"],
  },
  {
    concept: "fractions",
    kind: "worked_example",
    title: "Adding 1/4 + 1/2",
    content:
      "Rewrite 1/2 as 2/4 so both fractions share a denominator of 4. Then 1/4 + 2/4 = 3/4, which is already in lowest terms.",
    keywords: ["1/4+1/2", "worked example", "lowest terms"],
  },
  {
    concept: "linear-graphing",
    kind: "explanation",
    title: "Reading slope-intercept form",
    content:
      "In y = mx + b, b is the y-intercept — where the line crosses the y-axis — and m is the slope, describing how many units y changes for each unit x increases. Plot b first, then use m as rise-over-run to find a second point.",
    keywords: ["slope intercept", "y=mx+b", "slope", "y-intercept"],
  },
  {
    concept: "linear-graphing",
    kind: "misconception",
    title: "Swapping slope and y-intercept",
    content:
      "A frequent error is plotting the slope value on the y-axis and using the intercept as the rise-over-run, which produces a line with the correct steepness in the wrong position or the correct position at the wrong angle.",
    keywords: ["swapped slope", "wrong intercept", "confused m and b"],
  },
  {
    concept: "linear-graphing",
    kind: "worked_example",
    title: "Graphing y = 2x + 1",
    content:
      "Start at the y-intercept (0, 1). The slope 2 means rise 2, run 1, so the next point is (1, 3). Draw a line through both points.",
    keywords: ["y=2x+1", "worked example", "rise over run"],
  },
];

// ---------------------------------------------------------------------------
// 3. ACHIEVEMENTS (machine-checkable criteria)
// ---------------------------------------------------------------------------
// NOTE: criteria shape { stat, min } matches the machine-checkable evaluator
// in src/lib/services/achievements-service.ts (checkAndUnlockAchievements).
const achievements = [
  {
    slug: "first-gap",
    title: "First Gap",
    description: "Found your first learning gap.",
    icon: "target",
    criteria: JSON.stringify({ stat: "gapsFound", min: 1 }),
  },
  {
    slug: "gap-master",
    title: "Gap Master",
    description: "Repaired 5 gaps.",
    icon: "award",
    criteria: JSON.stringify({ stat: "gapsRepaired", min: 5 }),
  },
  {
    slug: "transfer-pro",
    title: "Transfer Pro",
    description: "Transferred 5 concepts to new problems.",
    icon: "shuffle",
    criteria: JSON.stringify({ stat: "transfersSucceeded", min: 5 }),
  },
  {
    slug: "teach-back",
    title: "Teach Back",
    description: "Explained 5 concepts back correctly.",
    icon: "message-circle",
    criteria: JSON.stringify({ stat: "teachBacks", min: 1 }),
  },
  {
    slug: "streak-7",
    title: "7-Day Streak",
    description: "Studied 7 days in a row.",
    icon: "flame",
    criteria: JSON.stringify({ stat: "streakDays", min: 7 }),
  },
];

async function main() {
  console.log("Seeding concepts...");
  const conceptMap: Record<string, string> = {};
  for (const c of concepts) {
    const row = await prisma.concept.upsert({
      where: { slug: c.slug },
      update: {
        name: c.name,
        subject: c.subject,
        description: c.description,
        commonErrors: JSON.stringify(c.commonErrors),
      },
      create: {
        slug: c.slug,
        name: c.name,
        subject: c.subject,
        description: c.description,
        commonErrors: JSON.stringify(c.commonErrors),
      },
    });
    conceptMap[c.slug] = row.id;
  }

  console.log("Seeding concept relationships...");
  for (const [from, to, type] of relationships) {
    await prisma.conceptRelationship.upsert({
      where: {
        fromId_toId_relationType: {
          fromId: cid(conceptMap, from!),
          toId: cid(conceptMap, to!),
          relationType: type!,
        },
      },
      update: {},
      create: {
        fromId: cid(conceptMap, from!),
        toId: cid(conceptMap, to!),
        relationType: type!,
      },
    });
  }

  console.log("Seeding RAG knowledge chunks...");
  // Idempotency: clear existing chunks for these concepts, then insert fresh.
  await prisma.knowledgeChunk.deleteMany({
    where: { conceptId: { in: Object.values(conceptMap) } },
  });
  for (const ch of chunks) {
    await prisma.knowledgeChunk.create({
      data: {
        conceptId: cid(conceptMap, ch.concept),
        kind: ch.kind,
        title: ch.title,
        content: ch.content,
        keywords: JSON.stringify(ch.keywords),
      },
    });
  }

  console.log("Seeding achievements...");
  for (const a of achievements) {
    await prisma.achievement.upsert({
      where: { slug: a.slug },
      update: { title: a.title, description: a.description, icon: a.icon, criteria: a.criteria },
      create: a,
    });
  }

  console.log("Seed complete.");
}


main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
