import { generateStructured } from "@/lib/ai/gemini-client";
import { TeachBackEvalResult } from "@/lib/ai/schemas/pipeline";

const SYSTEM = `You evaluate a student's spoken/typed explanation of a concept
they just learned ("teach it back to me"). Score 0-100 against this rubric:
(1) correctly states the rule/concept, (2) explains WHY the correct approach
works (not just what to do), (3) references their own earlier mistake
accurately, (4) uses correct terminology. Mark each criterion met/unmet with a
short note. Be encouraging but honest in feedback — do not inflate the score.`;

export async function evaluateTeachBack(params: {
  conceptName: string;
  underlyingGap: string;
  studentExplanation: string;
  /** Links this call back to the originating analysis, for the AI Observability trace view. */
  analysisId?: string;
}) {
  const { data, cached } = await generateStructured({
    stage: "evaluate_teachback",
    schema: TeachBackEvalResult,
    systemInstruction: SYSTEM,
    prompt: JSON.stringify({
      conceptName: params.conceptName,
      underlyingGap: params.underlyingGap,
      studentExplanation: params.studentExplanation,
    }),
    analysisId: params.analysisId,
  });
  return { result: data, cached };
}
