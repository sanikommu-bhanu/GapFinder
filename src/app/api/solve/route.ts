import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/session";
import { buildGuidedPlan, checkGuidedAttempt } from "@/lib/solving/guided-solve";

const PlanBody = z.object({
  action: z.literal("plan"),
  problem: z.string().min(1).max(300),
});

const CheckBody = z.object({
  action: z.literal("check"),
  /** The original question, so the plan can be rebuilt server-side. */
  problem: z.string().min(1).max(300),
  /** The line the student is working from — their own previous attempt. */
  previousLine: z.string().min(1).max(300),
  attempt: z.string().min(1).max(300),
  /** Which step of the plan they are on, 1-based. */
  stepIndex: z.number().int().min(1).max(40),
});

const Body = z.union([PlanBody, CheckBody]);

/**
 * Guided solving. Entirely deterministic — no model call, so it costs nothing
 * against any quota and returns instantly.
 *
 * The plan deliberately omits `expected` from the response. Sending the answer
 * to the browser would put it one devtools tab away, and the point of guiding
 * someone is that they write the line themselves.
 */
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Send a problem to solve, or an attempt to check." }, { status: 400 });
  }

  if (parsed.data.action === "plan") {
    const plan = buildGuidedPlan(parsed.data.problem);
    return NextResponse.json({
      problem: plan.problem,
      solvable: plan.solvable,
      reason: plan.reason ?? null,
      totalSteps: plan.steps.length,
      // The instruction and the reasoning, never the line itself.
      steps: plan.steps.map((s) => ({
        order: s.order,
        instruction: s.instruction,
        reason: s.reason,
        kind: s.kind,
      })),
    });
  }

  // The expected line is recomputed here rather than round-tripped through the
  // browser, so the answer never leaves the server. Rebuilding is free — the
  // plan is pure arithmetic.
  const plan = buildGuidedPlan(parsed.data.problem);
  const expected = plan.steps[parsed.data.stepIndex - 1]?.expected ?? "";

  const result = checkGuidedAttempt({
    previousLine: parsed.data.previousLine,
    attempt: parsed.data.attempt,
    expected,
  });

  const isLastStep = parsed.data.stepIndex >= plan.steps.length;

  return NextResponse.json({
    ...result,
    // Only revealed once they have got there themselves.
    finished: result.accepted && isLastStep,
    finalAnswer: result.accepted && isLastStep ? plan.finalAnswer : null,
  });
}
