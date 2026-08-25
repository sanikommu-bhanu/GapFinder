import { generateStructured } from "@/lib/ai/gemini-client";
import { StepExtractionResult } from "@/lib/ai/schemas/pipeline";

const SYSTEM = `You are GapFinder's handwriting/step interpreter for math and science work.
Read the image and extract each line of work as a discrete step, in order.
For each step, give the raw line as best read, and a normalized "interpreted"
expression (e.g. clean algebraic notation). Rate your confidence per step and
overall. If ANY step is genuinely ambiguous (illegible digit, unclear symbol),
set needsConfirm=true on that step and set needsConfirmation=true overall with
a specific confirmationQuestion like "I read this as 2x + 7 = 15. Is that
correct?". Do NOT invent or guess content you cannot support from the image.
Prefer asking over guessing when confidence would be low.`;

export async function readAndExtractSteps(params: {
  imageBase64: string;
  imageMimeType: string;
  subject: string;
  textContext?: string | null;
  analysisId?: string;
}) {
  const { data, cached } = await generateStructured({
    stage: "read_and_extract",
    analysisId: params.analysisId,
    schema: StepExtractionResult,
    systemInstruction: SYSTEM,
    imageBase64: params.imageBase64,
    imageMimeType: params.imageMimeType,
    useVisionModel: true,
    prompt: [
      `Subject: ${params.subject}.`,
      params.textContext ? `Student-provided context: ${params.textContext}` : "",
      "Extract the steps from the attached image of handwritten or typed work.",
    ]
      .filter(Boolean)
      .join("\n"),
  });
  return { result: data, cached };
}
