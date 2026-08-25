import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const analysis = await prisma.analysis.findFirst({
    where: { id: params.id, userId },
    include: {
      uploadedWork: true,
      extractedSteps: { orderBy: { order: "asc" } },
      reasoningSteps: { orderBy: { order: "asc" } },
      gaps: { include: { concept: true } },
    },
  });

  if (!analysis) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ analysis });
}
