import { generateStructured } from "@/lib/ai/gemini-client";
import { hasGeminiKey } from "@/lib/env";
import { ReasoningReconstructionResult } from "@/lib/ai/schemas/pipeline";
import { parseLinearEquation } from "@/lib/math/linear-parse";
import { toLinearForm } from "@/lib/math/solve-step";

const SYSTEM = `You reconstruct the STUDENT'S reasoning from extracted math/science
steps — not the "correct" path, the path they actually appear to be taking.

Return EXACTLY one entry for EVERY step you are given, with the same order
numbers. Never merge, drop, reorder or add steps.

For each step, "statement" describes the move that produced THAT step from the
one before it (e.g. "Subtracting 7 from both sides"). For the first step, the
statement is simply that this is the equation as given.

Copy each "expression" through unchanged. Stay faithful to what's on the page:
do not silently correct errors here — correction happens in a later stage.`;

export async function reconstructReasoning(params: {
  subject: string;
  steps: { order: number; interpreted: string }[];
  analysisId?: string;
}) {
  if (hasGeminiKey()) {
    try {
      const { data, cached } = await generateStructured({
        stage: "reconstruct_reasoning",
        analysisId: params.analysisId,
        schema: ReasoningReconstructionResult,
        systemInstruction: SYSTEM,
        prompt: JSON.stringify({ subject: params.subject, steps: params.steps }),
      });

      // The model narrates the steps; it must not change them. Rebuilding from
      // the student's own list guarantees every step survives with its original
      // expression — a model that drops or rewrites a line would break the
      // divergence search that runs next, silently and invisibly.
      const narrationByOrder = new Map(data.reasoningSteps.map((s) => [s.order, s.statement]));
      const reconciled = params.steps.map((step, i) => ({
        order: step.order,
        statement:
          i === 0
            ? "Start from the equation as written."
            : narrationByOrder.get(step.order)?.trim() ||
              describeStep(step.interpreted, params.steps[i - 1]?.interpreted),
        expression: step.interpreted,
      }));

      return { result: { reasoningSteps: reconciled }, cached };
    } catch (err) {
      console.warn("[reconstruct] falling back to structural narration", err);
    }
  }

  return { result: { reasoningSteps: narrateStructurally(params.steps) }, cached: false };
}

/**
 * Describes each step from its algebraic shape alone.
 *
 * The narration is the only part of this stage a language model contributes —
 * the expressions and the verification are already deterministic — so when the
 * model is unavailable the pipeline continues with plainer wording rather than
 * stopping. Every statement here is derived from the equation itself.
 */
function narrateStructurally(steps: { order: number; interpreted: string }[]) {
  return steps.map((step, i) => {
    const previous = i > 0 ? steps[i - 1] : undefined;
    return {
      order: step.order,
      statement: describeStep(step.interpreted, previous?.interpreted),
      expression: step.interpreted,
    };
  });
}

function describeStep(expression: string, previous?: string): string {
  if (!previous) return "Start from the equation as written.";

  const before = parseLinearEquation(previous);
  const after = parseLinearEquation(expression);
  const beforeForm = toLinearForm(previous);
  const afterForm = toLinearForm(expression);

  const isolatesVariable = /^\s*[a-zA-Z]\s*=/.test(expression);
  if (isolatesVariable) return "Solve for the variable.";

  if (before && after && before.constant !== 0 && after.constant === 0) {
    return "Move the constant to the other side to isolate the variable term.";
  }
  if (beforeForm && afterForm && Math.abs(beforeForm.m - afterForm.m) > 1e-9) {
    return "Divide both sides by the coefficient.";
  }
  if (beforeForm && afterForm && Math.abs(beforeForm.m - afterForm.m) < 1e-9) {
    return "Simplify the right-hand side.";
  }
  return "Continue working the equation.";
}
