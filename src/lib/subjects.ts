/**
 * What GapFinder can check, per subject.
 *
 * Each subject is routed to the verifiers that can actually judge its working
 * (see `lib/verification/verify-step.ts`), and each one states plainly what is
 * proved versus what is reviewed. A student is never told their chemistry is
 * "correct" when all that was confirmed is the algebra inside it.
 *
 * `proves`  — checked deterministically. If it passes, it is right.
 * `reviews` — read and explained by AI against the curated knowledge base.
 *             Useful, but not proof, and labelled as such in the UI.
 */

export interface Subject {
  name: string;
  /** Lucide icon name used on the capture screen. */
  icon: "sigma" | "zap" | "flask" | "leaf";
  /** One line for the capture screen. */
  note: string;
  proves: string[];
  reviews: string[];
}

export const SUBJECTS: Subject[] = [
  {
    name: "Math",
    icon: "sigma",
    note: "Every line is checked algebraically against the one above it.",
    proves: [
      "Each step follows from the previous one",
      "Distribution, rearrangement and solving",
      "The final answer",
    ],
    reviews: ["Why the concept broke", "What to practise next"],
  },
  {
    name: "Physics",
    icon: "zap",
    note: "We check your substitutions, your arithmetic and your units line by line.",
    proves: [
      "Substituting values into a formula",
      "The arithmetic at every step",
      "Units stay dimensionally consistent",
    ],
    reviews: ["Choice of formula", "Diagrams and free-body reasoning"],
  },
  {
    name: "Chemistry",
    icon: "flask",
    note: "We count atoms on both sides and check every calculation.",
    proves: [
      "Whether an equation is balanced, element by element",
      "That no element appears or vanishes between steps",
      "Mole and mass arithmetic",
    ],
    reviews: ["Reaction mechanisms", "Which products form"],
  },
  {
    name: "Biology",
    icon: "leaf",
    note: "Written reasoning is read and checked against curated notes — explained, not proved.",
    proves: ["Any calculation in your working (genetics ratios, rates)"],
    reviews: [
      "Your written explanation, claim by claim",
      "Misconceptions against curated notes",
    ],
  },
];

export const SUBJECT_NAMES = SUBJECTS.map((s) => s.name);

export function getSubject(name: string): Subject {
  return SUBJECTS.find((s) => s.name === name) ?? SUBJECTS[0]!;
}

/** True when this subject's working is mostly prose rather than equations. */
export function isDiscursive(name: string): boolean {
  return name === "Biology";
}
