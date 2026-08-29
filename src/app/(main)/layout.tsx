"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/nav/BottomNav";
import { cn } from "@/lib/cn";

/**
 * The tab bar belongs to the app's top level. Task flows — analyzing, the gap
 * walkthrough, practice, transfer, teach-back, focus — are single-purpose
 * screens that end in one primary action, and a tab bar underneath that action
 * both competes with it and invites the student to abandon the flow halfway.
 */
const TAB_ROUTES = ["/home", "/history", "/gaps", "/profile", "/scan"];

function showsTabBar(pathname: string | null): boolean {
  if (!pathname) return false;
  // "/gaps" is a tab; "/gaps/<id>/practice" is a flow.
  return TAB_ROUTES.includes(pathname);
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const withTabs = showsTabBar(pathname);

  /**
   * The document scrolls, not a container inside it.
   *
   * An earlier version nested the app inside its own `overflow-y-auto` element
   * to keep the tab bar pinned. That element took its height from its content,
   * so its scrollHeight always equalled its clientHeight — there was nothing to
   * scroll, and anything past the fold was simply clipped. A sticky tab bar
   * pins just as well over a normally scrolling page, and native scrolling
   * brings momentum, address-bar behaviour and scroll restoration back with it.
   */
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col [min-height:100dvh]">
      <div className={cn("flex-1", withTabs && "pb-20 pb-[calc(5rem+env(safe-area-inset-bottom))]")}>
        {children}
      </div>
      {withTabs && <BottomNav />}
    </div>
  );
}
