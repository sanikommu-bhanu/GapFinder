"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/nav/BottomNav";

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
  const scroller = useRef<HTMLDivElement>(null);

  /**
   * Put every new screen back at the top.
   *
   * The app scrolls inside this div rather than the document, which is what
   * keeps the tab bar pinned — but it also means Next's own scroll restoration,
   * which moves the *window*, does nothing here. Without this, navigating away
   * from a long analysis leaves the next screen parked hundreds of pixels down,
   * often past the end of its content. It reads exactly like a frozen page: you
   * are already at the bottom, so nothing moves.
   */
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-1 flex-col overflow-hidden">
      <div
        ref={scroller}
        data-app-scroller
        className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-none"
      >
        {children}
      </div>
      {withTabs && <BottomNav />}
    </div>
  );
}
