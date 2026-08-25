import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";

/**
 * Serves a student's uploaded work from the database.
 *
 * The image lives in a column rather than on disk because a serverless host
 * gives you no writable, persistent filesystem — anything written during a
 * request is gone by the next one. Reading it back through an authenticated
 * route also means one student's homework can't be fetched by guessing a URL,
 * which a public /uploads directory would have allowed.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return new NextResponse("Not authenticated.", { status: 401 });

  const work = await prisma.uploadedWork.findFirst({
    // Scoped by owner: the id alone is not authorisation.
    where: { analysisId: params.id, analysis: { userId } },
    select: { imageData: true },
  });

  if (!work?.imageData) return new NextResponse("Not found.", { status: 404 });

  const bytes = Buffer.from(work.imageData, "base64");

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(bytes.byteLength),
      // The bytes for a given analysis never change, and the response is
      // per-user, so it is safe to keep privately for a long time.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
