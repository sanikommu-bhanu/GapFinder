import type { RetrievedChunk } from "@/lib/ai/rag/retrieve";

/**
 * Offline teach-back rubric.
 *
 * When Gemini can't be reached, a student who just explained a concept out loud
 * still deserves an answer. This scores their explanation against the same four
 * rubric criteria the Gemini prompt uses, by checking for the reasoning moves
 * each criterion requires. It is deliberately conservative — it can confirm
 * that a criterion was clearly met, and stays honest when it can't tell.
 *
 * Every surface that shows this score labels it as an offline rubric, never as
 * an AI evaluation.
 */

export interface OfflineRubricResult {
  rubricScore: number;
  criteriaMet: { criterion: string; met: boolean; note: string }[];
  feedback: string;
  /** Always true here — callers must surface this to the student. */
  offline: true;
}

const BOTH_SIDES = /\bboth\s+sides?\b|\beach\s+side\b|\bsame\s+(thing|operation|amount)\s+to\s+both\b/i;
const INVERSE = /\binverse\b|\bopposite\b|\bundo(ing)?\b|\bsubtract(ing|ed)?\b|\badd(ing|ed)?\b|\bdivid(e|ing|ed)\b|\bmultipl(y|ying|ied)\b/i;
const WHY = /\bbecause\b|\bso\s+that\b|\bin\s+order\s+to\b|\bthat\s+way\b|\bkeeps?\b|\bstays?\b/i;
const BALANCE = /\bbalanc\w*\b|\bequal\w*\b|\bsame\s+value\b|\bscale\b/i;
const OWN_MISTAKE = /\bi\s+(wrote|added|subtracted|forgot|missed|should|made)\b|\bmy\s+(mistake|error)\b|\blast\s+time\b|\bbefore\s+i\b/i;

export function scoreTeachBackOffline(params: {
  studentExplanation: string;
  conceptName: string;
  chunks?: RetrievedChunk[];
}): OfflineRubricResult {
  const text = params.studentExplanation.trim();
  const words = text.split(/\s+/).filter(Boolean).length;

  const criteria = [
    {
      criterion: "States the rule or operation involved",
      met: INVERSE.test(text),
      note: INVERSE.test(text)
        ? "Names the operation being applied."
        : "Doesn't name which operation undoes the other.",
    },
    {
      criterion: "Explains why the approach works",
      met: WHY.test(text) && words >= 12,
      note:
        WHY.test(text) && words >= 12
          ? "Gives a reason, not just a procedure."
          : "Describes what to do, but not why it works.",
    },
    {
      criterion: "Refers to keeping the equation balanced",
      met: BOTH_SIDES.test(text) || BALANCE.test(text),
      note:
        BOTH_SIDES.test(text) || BALANCE.test(text)
          ? "Connects the step to keeping both sides equal."
          : "Doesn't mention that both sides must stay equal.",
    },
    {
      criterion: "Connects it back to their own work",
      met: OWN_MISTAKE.test(text),
      note: OWN_MISTAKE.test(text)
        ? "Relates the rule to their own earlier step."
        : "Doesn't reference their own earlier reasoning.",
    },
  ];

  const met = criteria.filter((c) => c.met).length;
  // Length alone is never evidence of understanding, so it only ever costs
  // points — a two-word answer cannot score as a full explanation.
  const lengthCeiling = words < 6 ? 40 : words < 12 ? 70 : 100;
  const rubricScore = Math.min(lengthCeiling, Math.round((met / criteria.length) * 100));

  const feedback =
    met === criteria.length
      ? `That's a complete explanation of ${params.conceptName.toLowerCase()} — you named the operation, said why it works, and tied it to your own work.`
      : met >= 2
        ? `Good start. To make it airtight, add ${criteria.filter((c) => !c.met)[0]!.note.toLowerCase()}`
        : `Try again with more detail: say which operation you applied, and why doing it to both sides keeps the equation true.`;

  return { rubricScore, criteriaMet: criteria, feedback, offline: true };
}
