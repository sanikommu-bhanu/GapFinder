/**
 * What GapFinder can honestly verify today.
 *
 * The verification layer proves that one algebraic line follows from another.
 * That covers linear equations, distribution and rearrangement completely, and
 * it covers the *symbolic* half of physics and chemistry working — but it does
 * not check units, balance chemical equations, or reason about diagrams.
 *
 * Offering those subjects with no caveat would promise a check we don't
 * perform, so each subject carries its own support level and the capture screen
 * says plainly what will and won't be verified. A student is never told their
 * chemistry is right when all we confirmed was the algebra inside it.
 */

export type SupportLevel = "full" | "partial";

export interface Subject {
  name: string;
  level: SupportLevel;
  /** Shown on the capture screen when this subject is selected. */
  note: string;
}

export const SUBJECTS: Subject[] = [
  {
    name: "Math",
    level: "full",
    note: "Every line is checked algebraically against the one above it.",
  },
  {
    name: "Physics",
    level: "partial",
    note: "We verify the algebra in your working. We don't check units or read diagrams yet — so treat those parts as unchecked.",
  },
  {
    name: "Chemistry",
    level: "partial",
    note: "We verify the algebra in your working. We don't balance equations or check stoichiometry yet — so treat those parts as unchecked.",
  },
];

export const SUBJECT_NAMES = SUBJECTS.map((s) => s.name);

export function getSubject(name: string): Subject {
  return SUBJECTS.find((s) => s.name === name) ?? SUBJECTS[0]!;
}
