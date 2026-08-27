import { NextRequest } from "next/server";
import { handleSpotifyCallback } from "@/lib/spotify/handle-callback";

/**
 * GET /spotify/callback — the canonical Spotify redirect URI.
 *
 * A Route Handler, not a page: it performs a token exchange and redirects, and
 * never renders anything, so there is no markup for a student to see mid-flow.
 * It sits outside the (main) route group deliberately — that group's layout
 * paints the app chrome, which would be wrong for a URL nobody lands on twice.
 *
 * The work lives in lib/spotify/handle-callback.ts, shared with the older
 * /api/spotify/callback path so both behave identically.
 */
export async function GET(req: NextRequest) {
  return handleSpotifyCallback(req);
}
