import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

/**
 * Route protection.
 *
 * This file must live in `src/` — with a src directory, Next.js does not look
 * for middleware at the repo root, and a root copy is silently ignored, which
 * is exactly how every protected page ended up publicly reachable.
 *
 * `jose` is edge-compatible, so the signature is actually verified here rather
 * than only checking that some cookie exists. Each API route still calls
 * getSessionUserId() itself — middleware is the outer gate, not the only one.
 */

const SESSION_COOKIE = "gf_session";

const PUBLIC_PAGES = ["/splash", "/login", "/register"];
const PUBLIC_API = ["/api/auth/login", "/api/auth/register", "/api/auth/me", "/api/auth/logout"];

/**
 * The Spotify redirect URIs are exempt from the session gate — but only so the
 * handler itself can run, not because they are unauthenticated endpoints.
 *
 * Blocking them here would have middleware redirect an expired session to
 * /splash before the route ever executes, leaving both single-use PKCE cookies
 * behind and giving the student no explanation. Letting the handler run means
 * it checks the session itself, spends the cookies, and redirects with an
 * outcome the Focus card can explain.
 *
 * This exposes nothing: handleSpotifyCallback links an account to a session,
 * and without a session it does exactly nothing.
 */
const SPOTIFY_CALLBACKS = ["/spotify/callback", "/api/spotify/callback"];

function isPublicAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/demo") ||
    pathname.startsWith("/uploads") ||
    pathname === "/manifest.json" ||
    pathname === "/favicon.ico" ||
    /\.(png|jpg|jpeg|svg|webp|ico|txt|xml|webmanifest)$/.test(pathname)
  );
}

async function hasValidSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  // No fallback secret: a deploy that forgot SESSION_SECRET must reject every
  // session rather than verify them against a value published in this file.
  const configured = process.env.SESSION_SECRET;
  if (!configured || configured.length < 16) return false;
  try {
    const secret = new TextEncoder().encode(configured);
    const { payload } = await jwtVerify(token, secret);
    return typeof payload.userId === "string" && payload.userId.length > 0;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicAsset(pathname) || pathname === "/") return NextResponse.next();
  if (SPOTIFY_CALLBACKS.includes(pathname)) return NextResponse.next();
  if (PUBLIC_API.some((p) => pathname === p)) return NextResponse.next();
  if (PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  if (await hasValidSession(req)) return NextResponse.next();

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/splash";
  url.search = "";
  const res = NextResponse.redirect(url);
  // A cookie that failed verification is stale or forged either way — clear it
  // so the student isn't stuck in a redirect loop.
  if (req.cookies.has(SESSION_COOKIE)) res.cookies.delete(SESSION_COOKIE);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
