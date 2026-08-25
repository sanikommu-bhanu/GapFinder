import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { getMisconception } from "@/lib/diagnosis/misconceptions";
import { getResources } from "@/lib/resources";

/** External providers, not Gemini — but still worth headroom over the default. */
export const maxDuration = 30;

/**
 * Resources for one diagnosed gap.
 *
 * Deliberately a separate endpoint from the analysis itself. The diagnosis is
 * the product and must appear immediately; videos and papers are enrichment and
 * load alongside it. Folding them into the analysis pipeline would put a
 * Crossref timeout between a student and the answer they came for.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const gap = await prisma.gap.findFirst({
    where: { id: params.id, analysis: { userId } },
    include: { concept: true, analysis: { select: { subject: true } } },
  });
  if (!gap) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const misconception = gap.misconceptionCode ? getMisconception(gap.misconceptionCode) : null;

  const bundle = await getResources({
    conceptName: gap.concept.name,
    conceptSlug: gap.concept.slug,
    subject: gap.analysis.subject,
    misconceptionName: misconception?.name,
    studentRule: misconception?.studentRule,
  });

  return NextResponse.json(bundle);
}
