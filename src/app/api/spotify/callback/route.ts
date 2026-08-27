import { NextRequest } from "next/server";
import { handleSpotifyCallback } from "@/lib/spotify/handle-callback";

/**
 * GET /api/spotify/callback — the original redirect URI, kept working.
 *
 * /spotify/callback is now canonical. This path is retained so an existing
 * Spotify dashboard entry, or a deployment whose SPOTIFY_REDIRECT_URI still
 * points here, does not break on upgrade. Both delegate to the same handler.
 */
export async function GET(req: NextRequest) {
  return handleSpotifyCallback(req);
}
