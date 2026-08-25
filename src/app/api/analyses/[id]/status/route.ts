import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";

/** Wall-clock ceiling after which a still-running analysis is treated as stuck. */
const STALL_AFTER_MS = 3 * 60 * 1000;

const STAGE_ORDER = [
  "pending",
  "reading",
  "reconstructing",
  "verifying",
  "classifying",
  "explaining",
  "complete",
] as const;

/**
 * Reports where an analysis actually is in the pipeline. The Analyzing screen
 * polls this, so the progress a student watches reflects real work rather than
 * a timer — and a crashed or hung run surfaces as an explanation instead of an
 * animation that never ends.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const analysis = await prisma.analysis.findFirst({
    where: { id: params.id, userId },
    select: {
      id: true,
      status: true,
      statusReason: true,
      confidence: true,
      createdAt: true,
      completedAt: true,
      _count: { select: { gaps: true, reasoningSteps: true } },
    },
  });

  if (!analysis) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const terminal = ["complete", "failed", "needs_confirmation"].includes(analysis.status);
  const ageMs = Date.now() - analysis.createdAt.getTime();

  if (!terminal && ageMs > STALL_AFTER_MS) {
    // A run this old is not coming back — a server restart mid-pipeline is the
    // usual cause. Record it so the student gets a way forward, not a spinner.
    await prisma.analysis.update({
      where: { id: analysis.id },
      data: {
        status: "failed",
        statusReason: "This analysis stopped partway through. Please upload the photo again.",
      },
    });
    return NextResponse.json({
      status: "failed",
      statusReason: "This analysis stopped partway through. Please upload the photo again.",
      stageIndex: STAGE_ORDER.indexOf("pending"),
      stageCount: STAGE_ORDER.length - 1,
      gapCount: 0,
    });
  }

  const stageIndex = Math.max(0, STAGE_ORDER.indexOf(analysis.status as (typeof STAGE_ORDER)[number]));

  return NextResponse.json({
    status: analysis.status,
    statusReason: analysis.statusReason,
    confidence: analysis.confidence,
    stageIndex,
    stageCount: STAGE_ORDER.length - 1,
    gapCount: analysis._count.gaps,
    stepCount: analysis._count.reasoningSteps,
  });
}
