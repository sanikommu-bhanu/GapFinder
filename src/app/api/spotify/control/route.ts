import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/session";
import { getAccessToken, getStatus, spotifyFetch } from "@/lib/spotify/client";

/**
 * Transport control: play, pause, next, previous.
 *
 * Spotify requires Premium for every endpoint used here and enforces it with a
 * 403. We check `product` first anyway so a free-tier student is told what is
 * actually true — "playback control needs Spotify Premium" — instead of being
 * shown a button that fails silently. No attempt is made to work around the
 * requirement, and no audio is ever proxied, downloaded or re-hosted: these
 * calls only tell Spotify's own player what to do.
 */
const ActionSchema = z.object({
  action: z.enum(["play", "pause", "next", "previous"]),
  /** The Web Playback SDK device to target, when the browser is the player. */
  deviceId: z.string().min(1).max(200).optional(),
});

const ENDPOINTS: Record<string, { path: string; method: string }> = {
  play: { path: "/me/player/play", method: "PUT" },
  pause: { path: "/me/player/pause", method: "PUT" },
  next: { path: "/me/player/next", method: "POST" },
  previous: { path: "/me/player/previous", method: "POST" },
};

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  const status = await getStatus(userId);
  if (!status.connected) {
    return NextResponse.json({ error: "Spotify isn't connected." }, { status: 409 });
  }
  if (!status.isPremium) {
    return NextResponse.json(
      { error: "Playback control needs Spotify Premium.", reason: "premium_required" },
      { status: 403 }
    );
  }

  const token = await getAccessToken(userId);
  if (!token) return NextResponse.json({ error: "Spotify isn't connected." }, { status: 409 });

  const { path, method } = ENDPOINTS[parsed.data.action]!;
  const query = parsed.data.deviceId ? `?device_id=${encodeURIComponent(parsed.data.deviceId)}` : "";

  const res = await spotifyFetch(`${path}${query}`, token, { method });
  if (!res) return NextResponse.json({ error: "Spotify is unreachable." }, { status: 502 });

  // 404 from these endpoints means "no active device" — the student has Spotify
  // open nowhere. That is a fixable situation, so it is named as one.
  if (res.status === 404) {
    return NextResponse.json(
      { error: "No active Spotify device. Open Spotify and press play once.", reason: "no_device" },
      { status: 409 }
    );
  }
  if (res.status === 403) {
    return NextResponse.json(
      { error: "Playback control needs Spotify Premium.", reason: "premium_required" },
      { status: 403 }
    );
  }
  if (!res.ok && res.status !== 204) {
    return NextResponse.json({ error: "Spotify refused that just now." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
