import type { LessonLine } from "./build-lesson";
import type { Misconception } from "@/lib/diagnosis/misconceptions";

/**
 * The spoken lesson for a concept a student asked about.
 *
 * `build-lesson.ts` teaches a mistake the pipeline proved. This teaches a
 * concept nobody has made a mistake in yet, which changes what the lines can
 * safely say — but not where they come from. Every line here is assembled from
 * the seeded concept record, the curated knowledge chunks retrieved for it, and
 * the misconception catalogue. A model writes none of it.
 *
 * That matters more here than anywhere else in the app, because this is read
 * aloud in a confident tutor's voice to a student who has no working of their
 * own to check it against.
 */

export interface ConceptLessonSource {
  conceptName: string;
  subject: string;
  description: string;
  commonErrors: string[];
  /** Curated chunks already retrieved for this concept, most relevant first. */
  chunks: { id: string; kind: string; title: string; content: string }[];
  /** Catalogue entries whose concept slug matches. */
  misconceptions: Misconception[];
}

export interface ConceptLesson {
  lines: LessonLine[];
  /** Chunk IDs the lesson drew on, so the UI can show its sources. */
  citedChunkIds: string[];
}

/** Roughly two spoken sentences; longer chunks are trimmed at a sentence end. */
const MAX_SPOKEN_CHARS = 340;

export function buildConceptLesson(source: ConceptLessonSource): ConceptLesson {
  const { conceptName, description, commonErrors, chunks, misconceptions } = source;
  const lines: LessonLine[] = [];
  const cited: string[] = [];

  // 1. What it is. The seeded description is the definition of record.
  lines.push({
    role: "concept",
    label: "What it is",
    text: `${conceptName}. ${description}`,
  });

  // 2. How it works, from the curated explanation chunk when there is one.
  const explanation = pick(chunks, "explanation");
  if (explanation) {
    cited.push(explanation.id);
    lines.push({ role: "correct", label: "How it works", text: trim(explanation.content) });
  }

  // 3. A worked example, if the corpus carries one.
  const example = pick(chunks, "worked_example");
  if (example) {
    cited.push(example.id);
    lines.push({ role: "correct", label: "Worked through", text: trim(example.content) });
  }

  // 4. Where it usually breaks. Stated as the rule a student is applying, not
  //    as a warning — the point is recognition, not caution.
  const misconception = misconceptions[0];
  if (misconception) {
    lines.push({
      role: "why",
      label: "Where it usually breaks",
      text: `Most students who get this wrong are applying a rule that sounds right: ${lowerFirst(
        misconception.studentRule
      )}`,
    });
    lines.push({ role: "why", label: "Why that fails", text: misconception.whyItFails });
  } else if (commonErrors[0]) {
    lines.push({
      role: "why",
      label: "Where it usually breaks",
      text: `The most common mistake here: ${lowerFirst(commonErrors[0])}.`,
    });
  }

  const misconceptionChunk = pick(chunks, "misconception");
  if (misconceptionChunk && misconceptionChunk.id !== explanation?.id) {
    cited.push(misconceptionChunk.id);
    lines.push({ role: "why", label: "In practice", text: trim(misconceptionChunk.content) });
  }

  // 5. The check to run on your own work. A question, so it transfers.
  lines.push({
    role: "avoid",
    label: "Check yourself",
    text: misconception
      ? misconception.socraticPrompt
      : `Before you move on, ask: could you explain ${conceptName.toLowerCase()} to someone who has never seen it?`,
  });

  return { lines, citedChunkIds: Array.from(new Set(cited)) };
}

function pick(
  chunks: ConceptLessonSource["chunks"],
  kind: string
): ConceptLessonSource["chunks"][number] | undefined {
  return chunks.find((c) => c.kind === kind);
}

/** Trims to a sentence boundary rather than mid-word, for the spoken version. */
function trim(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= MAX_SPOKEN_CHARS) return clean;
  const cut = clean.slice(0, MAX_SPOKEN_CHARS);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return lastStop > 120 ? cut.slice(0, lastStop + 1) : `${cut.trimEnd()}…`;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
