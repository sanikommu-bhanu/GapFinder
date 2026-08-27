import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * A regression guard for a bug that was live in the app: BottomNav listed a
 * route that MainLayout's TAB_ROUTES did not, so tapping that tab navigated to
 * a page with no tab bar and no obvious way back.
 *
 * The two lists are in different files for good reasons — one renders the bar,
 * the other decides where it shows — which is exactly why nothing stopped them
 * drifting apart. This test is the thing that stops it.
 *
 * Both are parsed from source rather than imported because BottomNav is a
 * client component whose module graph pulls in next/navigation.
 */

const root = join(__dirname, "..");

function hrefsIn(relativePath: string, constName: string): string[] {
  const source = readFileSync(join(root, relativePath), "utf8");
  const start = source.indexOf(`const ${constName}`);
  if (start === -1) throw new Error(`${constName} not found in ${relativePath}`);
  const block = source.slice(start, source.indexOf("];", start));
  return [...block.matchAll(/["'](\/[a-z-]*)["']/g)].map((m) => m[1]!);
}

describe("tab bar routing", () => {
  const tabs = hrefsIn("src/components/nav/BottomNav.tsx", "items");
  const tabRoutes = hrefsIn("src/app/(main)/layout.tsx", "TAB_ROUTES");

  it("finds both lists", () => {
    expect(tabs.length).toBeGreaterThan(0);
    expect(tabRoutes.length).toBeGreaterThan(0);
  });

  it("shows the tab bar on every route the tab bar links to", () => {
    // The failure this catches: a tab that hides the bar on arrival.
    const missing = tabs.filter((href) => !tabRoutes.includes(href));
    expect(missing, `these tabs are missing from TAB_ROUTES: ${missing.join(", ")}`).toEqual([]);
  });

  it("does not keep the bar visible on a route no tab links to", () => {
    // Not a bug, but a stale entry here means a task flow (practice, transfer,
    // teach-back) could quietly regain a tab bar that competes with its own
    // primary action.
    const orphaned = tabRoutes.filter((href) => !tabs.includes(href));
    expect(orphaned, `TAB_ROUTES entries with no tab: ${orphaned.join(", ")}`).toEqual([]);
  });
});
