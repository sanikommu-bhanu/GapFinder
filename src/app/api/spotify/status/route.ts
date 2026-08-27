import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getStatus } from "@/lib/spotify/client";

// Whether the Focus card should show "Connect Spotify", full controls, or
// nothing at all. Deliberately returns no token and no credential.
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  return NextResponse.json(await getStatus(userId));
}
