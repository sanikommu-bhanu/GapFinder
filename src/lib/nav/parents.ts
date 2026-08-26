/**
 * Where "back" goes.
 *
 * Browser history is the wrong model for an app with flows. A student who
 * finishes an analysis has `/analyzing` behind them — a screen whose only job is
 * to redirect forward again — so `router.back()` bounces them straight back to
 * where they were. Refreshing mid-flow is worse: there is no history at all, and
 * back walks out of the app entirely.
 *
 * So back is defined by structure rather than by history: every screen declares
 * its parent, and the button returns to the operation the student started. It is
 * the same up-navigation model native apps use, and it behaves identically
 * whether the screen was reached by tapping, by deep link, or after a refresh.
 */

/** Ordered: the first pattern that matches wins, so put specific rules first. */
const PARENTS: { match: RegExp; parent: string }[] = [
  // Flows that end in a result — back returns to where the flow began, never to
  // the loading screen in between.
  { match: /^\/analysis\/[^/]+$/, parent: "/home" },
  { match: /^\/analyzing$/, parent: "/scan" },

  // Everything hanging off a single gap belongs to that gap's list.
  { match: /^\/gaps\/[^/]+\/(practice|transfer|teach-back)$/, parent: "/gaps" },
  { match: /^\/gaps\/[^/]+$/, parent: "/gaps" },

  { match: /^\/settings\/.+$/, parent: "/settings" },
  { match: /^\/reports\/.+$/, parent: "/home" },
  { match: /^\/dev\/observability\/[^/]+$/, parent: "/dev/observability" },
];

/** Screens reachable straight from the tab bar or the menu. */
const TOP_LEVEL = new Set([
  "/home",
  "/history",
  "/gaps",
  "/profile",
  "/scan",
  "/learn",
  "/exam",
  "/solve",
  "/coach",
  "/roadmap",
  "/achievements",
  "/focus",
  "/settings",
]);

/**
 * The screen a back press should return to.
 *
 * `search` is read so a flow launched from somewhere specific returns there: a
 * concept check opened from an explanation goes back to the explanation, while
 * the same screen opened from the menu goes back to Home.
 */
export function parentOf(pathname: string | null, search?: string | null): string {
  if (!pathname) return "/home";

  if (pathname === "/exam" && search) {
    const concept = new URLSearchParams(search).get("concept");
    if (concept) return `/learn?q=${encodeURIComponent(concept.replace(/-/g, " "))}`;
  }

  for (const rule of PARENTS) {
    if (rule.match.test(pathname)) return rule.parent;
  }

  // A top-level screen has no parent above Home, and Home is its own floor.
  if (TOP_LEVEL.has(pathname)) return "/home";

  return "/home";
}

/** True when this screen is the bottom of the stack and needs no back control. */
export function isRootScreen(pathname: string | null): boolean {
  return pathname === "/home";
}
