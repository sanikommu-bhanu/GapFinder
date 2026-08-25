import { NextRequest, NextResponse } from "next/server";

// Route protection: gate every (main) app route behind a valid session
// cookie, while leaving (onboarding), auth API routes, and static assets
// open. Actual JWT verification happens in each API route / server
// component via getSessionUserId() (jose can't run in the edge runtime
// used here without extra config), so this middleware performs a cheap
// presence check and lets each handler do the authoritative check.
const PUBLIC_PATHS = [
  "/splash",
  "/personalize",
  "/login",
  "/register",
  "/api/auth/login",
  "/api/auth/register",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/demo") ||
    pathname.startsWith("/manifest") ||
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  const hasSession = req.cookies.has("gf_session");
  if (!hasSession && pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasSession && !pathname.startsWith("/api")) {
    const url = req.nextUrl.clone();
    url.pathname = "/splash";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
