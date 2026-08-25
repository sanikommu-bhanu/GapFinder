"use client";
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

  return (
    <div className="flex min-h-dvh flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-none">{children}</div>
      {withTabs && <BottomNav />}
    </div>
  );
}
