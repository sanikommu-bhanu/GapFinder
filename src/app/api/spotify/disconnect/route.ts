import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { disconnect } from "@/lib/spotify/client";

// Deletes the stored token pair outright. There is no "linked but inactive".
export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  await disconnect(userId);
  return NextResponse.json({ ok: true });
}
