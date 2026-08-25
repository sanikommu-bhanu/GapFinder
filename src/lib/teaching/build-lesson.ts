import type { Misconception } from "@/lib/diagnosis/misconceptions";

export interface LessonLine {
  /** What this line is doing, so the UI can style and pace it. */
  role: "mistake" | "why" | "concept" | "correct" | "avoid";
  text: string;
  /** Rendered in the display font when it's an expression rather than prose. */
  expression?: string;
}

/**
 * Builds the spoken/animated lesson from one student's diagnosis.
 *
 * Every line is assembled from values the pipeline already proved — their own
 * expressions, the derived correction, the matched misconception. Nothing here
 * is generated at read time, which is what makes it safe to read aloud: a voice
 * saying "your answer should be X" carries more authority than text on a
 * screen, so X had better come from the algebra rather than from a model.
 *
 * The five beats are the ones the addendum asks a tutor to cover: what you did,
 * why it happened, the concept underneath, the corrected reasoning, and how to
 * avoid it next time.
 */
export function buildLesson(params: {
  studentExpression: string;
  previousExpression: string | null;
  correctedExpression: string | null;
  conceptName: string;
  misconception: Misconception | null;
  correctReasoning: string[];
  stepOrder: number;
}): LessonLine[] {
  const {
    studentExpression,
    previousExpression,
    correctedExpression,
    conceptName,
    misconception,
    correctReasoning,
    stepOrder,
  } = params;

  const lines: LessonLine[] = [];

  // 1. What actually happened, in their own working.
  lines.push({
    role: "mistake",
    text: previousExpression
      ? `Everything held up to step ${stepOrder - 1}. Then, going from ${speakable(previousExpression)}, you wrote:`
      : `At step ${stepOrder}, you wrote:`,
    expression: studentExpression,
  });

  if (correctedExpression) {
    lines.push({
      role: "correct",
      text: "Checked algebraically, that line should read:",
      expression: correctedExpression,
    });
  }

  // 2. Why it happened — the rule they were actually applying.
  if (misconception) {
    lines.push({
      role: "why",
      text: `This isn't carelessness. It's a rule you're applying: ${lowerFirst(misconception.studentRule)}`,
    });
    lines.push({ role: "why", text: misconception.whyItFails });
  }

  // 3. The concept underneath.
  lines.push({
    role: "concept",
    text: `The concept underneath this is ${conceptName.toLowerCase()}.`,
  });

  // 4. The corrected reasoning, step by step.
  for (const step of correctReasoning.slice(0, 4)) {
    lines.push({ role: "correct", text: step });
  }

  // 5. How to catch it next time — a check, not an exhortation.
  if (misconception) {
    lines.push({
      role: "avoid",
      text: `Next time, before you move on, ask yourself: ${misconception.socraticPrompt}`,
    });
  }

  return lines;
}

/** Reads an expression aloud sensibly: "2x = 15 - 7" not "two x equals..." */
function speakable(expression: string): string {
  return expression
    .replace(/\s*=\s*/g, " equals ")
    .replace(/\s*\+\s*/g, " plus ")
    .replace(/(\d)\s*-\s*/g, "$1 minus ")
    .replace(/\s*\*\s*/g, " times ")
    .replace(/\s*\/\s*/g, " over ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The sentences handed to speech synthesis, expressions spoken in words. */
export function lessonToSpeech(lines: LessonLine[]): string[] {
  return lines.map((line) =>
    line.expression ? `${line.text} ${speakable(line.expression)}` : line.text
  );
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
