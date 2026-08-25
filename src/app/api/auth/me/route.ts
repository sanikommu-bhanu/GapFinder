import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ user: null }, { status: 200 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, studyPreference: true, settings: true },
  });
  if (!user) return NextResponse.json({ user: null }, { status: 200 });

  const { passwordHash: _omit, ...safe } = user;
  return NextResponse.json({ user: safe });
}
