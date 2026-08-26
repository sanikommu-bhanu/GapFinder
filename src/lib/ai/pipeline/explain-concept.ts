import { z } from "zod";
import { generateStructured } from "@/lib/ai/ai-client";

/**
 * Explaining a topic that isn't in the curated library.
 *
 * The library covers 22 concepts properly — checked material, computed
 * diagrams, catalogued misconceptions. A student asking about mitosis, or
 * vectors, or the water cycle, was previously told to ask about something else,
 * and being refused by a learning tool is its own kind of failure.
 *
 * So this generates an explanation, and says so on the screen. Three
 * constraints keep it from undoing the trust the rest of the app depends on:
 *
 *   1. The output is a fixed shape, not prose. The model fills in a diagram we
 *      already know how to draw — it never produces an image, and never picks
 *      the numbers in one.
 *   2. No citations, URLs, statistics or named studies. A fabricated source is
 *      worse than no source, because a student would repeat it. Anything that
 *      looks like one is stripped before it reaches the screen.
 *   3. It is labelled as generated wherever it appears, and it never claims
 *      anything about the student's own working — only the verified path does
 *      that.
 */

const Generated = z.object({
  topic: z.string().describe("The topic, named properly. Two or three words."),
  subject: z
    .enum(["Math", "Physics", "Chemistry", "Biology", "Other"])
    .describe("The closest school subject."),
  inLibrary: z
    .boolean()
    .describe("True only if this is a school-curriculum topic you can explain accurately."),
  whatItIs: z.string().describe("One or two sentences defining the topic. No citations, no statistics."),
  howItWorks: z.string().describe("Two or three sentences on the mechanism. Concrete, no citations."),
  commonMistake: z
    .string()
    .describe("The single most common misunderstanding, stated as the rule a student wrongly applies."),
  whyThatFails: z.string().describe("One sentence on why that rule breaks down."),
  checkYourself: z.string().describe("A question the student can ask themselves to catch the mistake."),
  diagram: z
    .object({
      /** "none" when the topic has no honest input-process-output shape. */
      kind: z.enum(["process-flow", "none"]),
      inputs: z.array(z.string()).describe("What goes in. Two to four short labels. Empty if kind is none."),
      process: z.string().describe("The name of the process. Empty if kind is none."),
      location: z.string().describe("Where it happens, or an empty string."),
      outputs: z.array(z.string()).describe("What comes out. Two to four short labels."),
    })
    .describe("A diagram the app will draw. Labels only — never numbers that matter."),
  quiz: z
    .array(
      z.object({
        prompt: z.string(),
        correct: z.string().describe("The correct option."),
        wrong: z.array(z.string()).describe("Exactly three plausible but wrong options."),
      })
    )
    .describe("Three multiple-choice questions checking understanding, not recall of wording."),
});

export type GeneratedExplanation = z.infer<typeof Generated>;

const SYSTEM = [
  "You explain one school-level concept to a student, for a tool whose entire value is that it never makes things up.",
  "Absolute rules:",
  "- Never cite a paper, study, statistic, percentage, date, URL or named researcher. Not even a real one.",
  "- Never mention the student's own work; you have not seen any.",
  "- If you are not confident the topic is a real school-curriculum concept, set inLibrary to false and leave the rest brief.",
  "- Write for a 14-to-17-year-old: plain, concrete, short sentences.",
  "- The diagram is labels only. If the topic has no genuine inputs-and-outputs shape, set kind to none.",
  "- Every wrong quiz option must be a mistake a student would really make, never a joke or an obvious filler.",
].join("\n");

/** Anything that reads like a source, a figure, or a link. */
const FABRICATION_PATTERNS: RegExp[] = [
  /https?:\/\/\S+/gi,
  /\bwww\.\S+/gi,
  /\bdoi:\s*\S+/gi,
  /\b(?:et al\.?|ibid\.?)/gi,
  /\((?:[A-Z][a-z]+,?\s*)+(?:19|20)\d{2}\)/g, // (Smith, 2019)
  /\b\d{1,3}(?:\.\d+)?\s*%/g,
  /\baccording to (?:a )?(?:study|research|paper|report)\b[^.]*/gi,
  /\b(?:studies|research) (?:show|shows|suggest|suggests|found)\b[^.]*/gi,
];

/**
 * Strips anything resembling a citation or a statistic.
 *
 * Deliberately blunt. Losing a legitimate percentage from an explanation costs
 * a student very little; keeping an invented one costs them the next exam
 * question they repeat it in.
 */
export function stripFabrications(text: string): string {
  let out = text;
  for (const pattern of FABRICATION_PATTERNS) out = out.replace(pattern, " ");
  return out.replace(/\s{2,}/g, " ").replace(/\s+([.,;:])/g, "$1").trim();
}

export async function explainUnknownConcept(topic: string): Promise<GeneratedExplanation | null> {
  const { data } = await generateStructured({
    stage: "explain-concept",
    schema: Generated,
    systemInstruction: SYSTEM,
    prompt: `Explain this topic to a school student: ${topic}`,
    // A concept's explanation doesn't change; caching it keeps the second
    // student who asks from spending quota on the same question.
    cacheTtlHours: 24 * 30,
  });

  if (!data.inLibrary) return null;

  const clean = {
    ...data,
    whatItIs: stripFabrications(data.whatItIs),
    howItWorks: stripFabrications(data.howItWorks),
    commonMistake: stripFabrications(data.commonMistake),
    whyThatFails: stripFabrications(data.whyThatFails),
    checkYourself: stripFabrications(data.checkYourself),
    quiz: data.quiz
      // A question needs a full set of options to be answerable at all.
      .filter((q) => q.prompt.trim() && q.correct.trim() && q.wrong.filter(Boolean).length >= 2)
      .slice(0, 3)
      .map((q) => ({
        prompt: stripFabrications(q.prompt),
        correct: stripFabrications(q.correct),
        wrong: q.wrong.filter(Boolean).slice(0, 3).map(stripFabrications),
      })),
  };

  // An explanation with nothing in it is worse than the honest refusal it
  // replaced, so fall back rather than render an empty screen.
  if (!clean.whatItIs || !clean.howItWorks) return null;

  return clean;
}
