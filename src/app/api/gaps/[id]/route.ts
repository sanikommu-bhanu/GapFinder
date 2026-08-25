import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const gap = await prisma.gap.findFirst({
    where: { id: params.id, analysis: { userId } },
    include: { concept: true, analysis: { include: { reasoningSteps: { orderBy: { order: "asc" } } } } },
  });
  if (!gap) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({
    gap: {
      ...gap,
      evidence: JSON.parse(gap.evidence),
      explanation: gap.explanationText ? JSON.parse(gap.explanationText) : null,
    },
  });
}
