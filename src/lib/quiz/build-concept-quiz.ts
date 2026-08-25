import { MISCONCEPTIONS, type Misconception } from "@/lib/diagnosis/misconceptions";

/**
 * The quiz that follows an explanation.
 *
 * A concept explainer that ends with "make sense?" teaches nothing — the whole
 * argument of this app is that recognising an explanation is not the same as
 * understanding it. So the lesson ends in questions, and the questions are
 * built the same way the lesson is: from the seeded concept record and the
 * misconception catalogue, never generated.
 *
 * Distractors are the real documented misconceptions for the concept. That is
 * what makes a wrong answer diagnostic rather than merely wrong: choosing one
 * says which rule the student is actually applying, in the same vocabulary the
 * diagnosis pipeline uses, so it lands in the same learning history.
 */

export interface ChoiceQuestion {
  prompt: string;
  options: string[];
  correctAnswer: string;
  /** What the question is testing, shown after the quiz, never before. */
  rationale: string;
}

export interface ConceptQuizSource {
  conceptSlug: string;
  conceptName: string;
  subject: string;
  description: string;
  commonErrors: string[];
}

/** Enough to mean something; few enough to finish after one explanation. */
export const QUIZ_LENGTH = 3;
const OPTIONS_PER_QUESTION = 4;

export function buildConceptQuiz(source: ConceptQuizSource, seed: string): ChoiceQuestion[] {
  const { conceptSlug, conceptName, subject, description, commonErrors } = source;

  const own = MISCONCEPTIONS.filter((m) => m.conceptSlug === conceptSlug && m.code !== "UNCLASSIFIED");
  const nearby = MISCONCEPTIONS.filter(
    (m) => m.conceptSlug !== conceptSlug && m.subject === subject && m.code !== "UNCLASSIFIED"
  );
  const distant = MISCONCEPTIONS.filter((m) => m.subject !== subject && m.code !== "UNCLASSIFIED");

  const questions: ChoiceQuestion[] = [];

  // 1. Can they pick the correct account of the concept out of the rules that
  //    students actually apply instead?
  const ruleDistractors = fill(
    own.map((m) => sentence(m.studentRule)),
    [...nearby, ...distant].map((m) => sentence(m.studentRule)),
    OPTIONS_PER_QUESTION - 1
  );
  if (ruleDistractors.length >= 2) {
    const correct = condense(description);
    questions.push({
      prompt: `Which of these describes ${conceptName.toLowerCase()} correctly?`,
      options: shuffle([correct, ...ruleDistractors], `${seed}:1`),
      correctAnswer: correct,
      rationale: "The three wrong options are rules students genuinely apply — that's what makes them tempting.",
    });
  }

  // 2. Given the misconception stated as a belief, can they say why it fails?
  //    Recognising the flaw is a stronger signal than recognising the fact.
  const target: Misconception | undefined = own[0] ?? nearby[0];
  if (target) {
    const correct = condense(target.whyItFails);
    // Distractors stay in the same subject, because an obviously off-topic
    // option teaches a student to answer by elimination. What they must not do
    // is overlap with the belief being examined: "respiration happens in every
    // cell" is a fair criticism of a claim about respiring, and a question with
    // two defensible answers measures the wording, not the student.
    const related = stems(target.studentRule);
    const wrong = fill(
      nearby
        .filter((m) => !sharesStem(m.whyItFails, related))
        .map((m) => condense(m.whyItFails)),
      distant.map((m) => condense(m.whyItFails)),
      OPTIONS_PER_QUESTION - 1
    );
    if (wrong.length >= 2) {
      questions.push({
        prompt: `A student says: "${sentence(target.studentRule)}" What is wrong with that?`,
        options: shuffle([correct, ...wrong], `${seed}:2`),
        correctAnswer: correct,
        rationale: `This is the misconception catalogued as ${target.code}.`,
      });
    }
  }

  // 3. Which mistake actually belongs to this concept? Tests whether the
  //    boundary of the concept is understood, not just its contents.
  const ownErrors = commonErrors.map(sentence);
  const otherErrors = [...nearby, ...distant].map((m) => sentence(m.name));
  if (ownErrors[0] && otherErrors.length >= 2) {
    const correct = ownErrors[0];
    const wrong = fill(otherErrors, [], OPTIONS_PER_QUESTION - 1);
    questions.push({
      prompt: `Which of these is a mistake people make with ${conceptName.toLowerCase()}?`,
      options: shuffle([correct, ...wrong], `${seed}:3`),
      correctAnswer: correct,
      rationale: "The other options are real mistakes — just not ones about this concept.",
    });
  }

  return questions.slice(0, QUIZ_LENGTH);
}

/** Takes from `primary` first, tops up from `secondary`, never duplicates. */
function fill(primary: string[], secondary: string[], count: number): string[] {
  const out: string[] = [];
  for (const candidate of [...primary, ...secondary]) {
    if (out.length >= count) break;
    if (!candidate) continue;
    if (out.some((o) => o.toLowerCase() === candidate.toLowerCase())) continue;
    out.push(candidate);
  }
  return out;
}

/**
 * Trims an option to the length of the others.
 *
 * The longest option being the right one is a tell students learn to exploit
 * before they learn the subject, so a definition that runs to three clauses is
 * cut back to the one that carries the claim.
 */
function condense(text: string, max = 110): string {
  const first = firstSentence(text.replace(/\s+/g, " ").trim());
  if (first.length <= max) return sentence(first);
  const cut = first.slice(0, max);
  const lastComma = cut.lastIndexOf(",");
  const lastSpace = cut.lastIndexOf(" ");
  // Never mid-word: a truncated option reads as a typo, not a wrong answer.
  const boundary = lastComma > 40 ? lastComma : lastSpace > 40 ? lastSpace : max;
  return sentence(cut.slice(0, boundary).trim());
}

/** Six-character stems of the content words, enough to tie respire/respiration. */
function stems(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 5)
      .map((w) => w.slice(0, 6))
  );
}

function sharesStem(text: string, against: Set<string>): boolean {
  for (const stem of stems(text)) if (against.has(stem)) return true;
  return false;
}

function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  return (match ? match[0] : text).trim();
}

function sentence(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const capitalised = clean.charAt(0).toUpperCase() + clean.slice(1);
  return /[.!?]$/.test(capitalised) ? capitalised : `${capitalised}.`;
}

/**
 * Seeded shuffle, so the correct answer isn't always in the same place but the
 * same quiz reloads identically — a student refreshing mid-quiz shouldn't find
 * the options rearranged under them.
 */
function shuffle(items: string[], seed: string): string[] {
  const out = [...items];
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    const j = Math.abs(h) % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Which documented misconception a chosen distractor represents.
 *
 * A wrong answer here is worth exactly as much as a wrong line of working: it
 * names a rule. Matching it back to a catalogue code is what lets an exam
 * relapse and a homework relapse count as the same event.
 */
export function misconceptionForAnswer(answer: string): string | null {
  const normalised = answer.replace(/\s+/g, " ").trim().toLowerCase().replace(/[.!?]+$/, "");
  for (const m of MISCONCEPTIONS) {
    if (m.code === "UNCLASSIFIED") continue;
    const candidates = [m.studentRule, firstSentence(m.whyItFails), m.name];
    if (candidates.some((c) => c.replace(/\s+/g, " ").trim().toLowerCase().replace(/[.!?]+$/, "") === normalised)) {
      return m.code;
    }
  }
  return null;
}
