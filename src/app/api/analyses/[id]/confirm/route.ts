import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { continuePipelineFromSteps } from "@/lib/ai/pipeline/orchestrator";

const Body = z.object({
  steps: z
    .array(
      z.object({
        order: z.number().int().min(1).max(200),
        interpreted: z.string().min(1).max(300),
      })
    )
    .min(1)
    .max(60),
});

/**
 * Accepts the student's corrections to how their handwriting was read, then
 * resumes the pipeline from the reconstruction stage. The vision model is not
 * called again — the student's own confirmation is better evidence than a
 * second guess at the same photo.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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
    return NextResponse.json({ error: "Each step needs to be non-empty text." }, { status: 400 });
  }

  const analysis = await prisma.analysis.findFirst({ where: { id: params.id, userId } });
  if (!analysis) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (analysis.status !== "needs_confirmation") {
    return NextResponse.json({ error: "This analysis isn't waiting for confirmation." }, { status: 409 });
  }

  await prisma.$transaction(
    parsed.data.steps.map((s) =>
      prisma.extractedStep.updateMany({
        where: { analysisId: params.id, order: s.order },
        data: { interpreted: s.interpreted, needsConfirm: false },
      })
    )
  );

  // Mark it running before returning so the Analyzing screen sees movement
  // immediately rather than reading a stale "needs_confirmation".
  await prisma.analysis.update({
    where: { id: params.id },
    data: { status: "reconstructing", statusReason: null },
  });

  void continuePipelineFromSteps({
    analysisId: params.id,
    subject: analysis.subject,
    steps: parsed.data.steps,
  }).catch(async (err) => {
    console.error("[analysis] resume crashed", params.id, err);
    await prisma.analysis
      .update({
        where: { id: params.id },
        data: { status: "failed", statusReason: "Something went wrong analyzing this. Please try again." },
      })
      .catch(() => {});
  });

  return NextResponse.json({ status: "resumed" }, { status: 202 });
}
