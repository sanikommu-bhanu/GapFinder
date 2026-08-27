import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getAccessToken, getStatus, spotifyFetch } from "@/lib/spotify/client";

/**
 * What is playing right now.
 *
 * Returns only what the card renders — track, artist, artwork, playing state.
 * The access token is used here and stays here.
 *
 * Spotify answers 204 with an empty body when nothing is playing and no device
 * is active, which is the common case for a student who has just connected. It
 * is reported as `idle`, not as an error, because the card's job then is to say
 * "start something in Spotify" rather than to look broken.
 */
interface SpotifyTrackResponse {
  is_playing?: boolean;
  progress_ms?: number | null;
  item?: {
    name?: string;
    duration_ms?: number;
    external_urls?: { spotify?: string };
    artists?: { name?: string }[];
    album?: { name?: string; images?: { url?: string; width?: number }[] };
  } | null;
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const status = await getStatus(userId);
  if (!status.configured) return NextResponse.json({ state: "unconfigured" });
  if (!status.connected) return NextResponse.json({ state: "disconnected" });

  const token = await getAccessToken(userId);
  // getAccessToken deletes the row when a refresh is rejected, so a null here
  // after a "connected" status means the link has just been revoked.
  if (!token) return NextResponse.json({ state: "disconnected" });

  const res = await spotifyFetch("/me/player/currently-playing", token);
  if (!res) return NextResponse.json({ state: "unreachable" });
  if (res.status === 204) return NextResponse.json({ state: "idle", isPremium: status.isPremium });
  if (res.status === 401) return NextResponse.json({ state: "disconnected" });
  if (!res.ok) return NextResponse.json({ state: "unreachable" });

  let body: SpotifyTrackResponse;
  try {
    body = (await res.json()) as SpotifyTrackResponse;
  } catch {
    return NextResponse.json({ state: "idle", isPremium: status.isPremium });
  }

  const item = body.item;
  if (!item?.name) return NextResponse.json({ state: "idle", isPremium: status.isPremium });

  // Smallest image that still looks right at 56px, to keep the card light.
  const images = item.album?.images ?? [];
  const artwork =
    images.find((i) => (i.width ?? 0) <= 300)?.url ?? images[images.length - 1]?.url ?? null;

  return NextResponse.json({
    state: "playing",
    isPremium: status.isPremium,
    isPlaying: Boolean(body.is_playing),
    title: item.name,
    artist: (item.artists ?? []).map((a) => a.name).filter(Boolean).join(", ") || null,
    album: item.album?.name ?? null,
    artwork,
    url: item.external_urls?.spotify ?? null,
    progressMs: body.progress_ms ?? null,
    durationMs: item.duration_ms ?? null,
  });
}
