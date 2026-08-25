import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";

/** Every analysis the student has run, newest first, with its outcome. */
export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 50) || 50));

  const analyses = await prisma.analysis.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      gaps: { include: { concept: true } },
      uploadedWork: { select: { sourceType: true, rawText: true } },
      reasoningSteps: { select: { id: true } },
    },
  });

  return NextResponse.json({
    analyses: analyses.map((a) => ({
      id: a.id,
      subject: a.subject,
      status: a.status,
      createdAt: a.createdAt,
      sourceType: a.uploadedWork?.sourceType ?? "camera",
      stepCount: a.reasoningSteps.length,
      gapCount: a.gaps.length,
      // What the student was working on, for a scannable list row.
      title: a.gaps[0]?.concept.name ?? a.uploadedWork?.rawText?.split("\n")[0] ?? a.subject,
      concepts: a.gaps.map((g) => g.concept.name),
      // open -> found but untouched; repaired -> practice passed; closed -> transferred.
      outcome:
        a.gaps.length === 0
          ? a.status === "complete"
            ? "clean"
            : a.status
          : a.gaps.every((g) => g.status === "closed")
            ? "closed"
            : a.gaps.some((g) => g.status !== "open")
              ? "repaired"
              : "open",
    })),
  });
}
