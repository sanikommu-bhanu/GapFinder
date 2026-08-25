import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { getResources } from "@/lib/resources";
import { MISCONCEPTIONS } from "@/lib/diagnosis/misconceptions";

/** External providers set the pace here, not us. */
export const maxDuration = 30;

/**
 * Videos and papers for a concept a student asked to have explained.
 *
 * The gap version of this route sharpens its query with the misconception the
 * pipeline proved. There is no proved misconception here, so it uses the
 * catalogue's most common one for the concept — a documented starting point
 * rather than a guess about this particular student.
 */
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const concept = await prisma.concept.findUnique({ where: { slug: params.slug } });
  if (!concept) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const misconception = MISCONCEPTIONS.find((m) => m.conceptSlug === concept.slug);

  const bundle = await getResources({
    conceptName: concept.name,
    conceptSlug: concept.slug,
    subject: concept.subject,
    misconceptionName: misconception?.name,
    studentRule: misconception?.studentRule,
  });

  return NextResponse.json(bundle);
}
