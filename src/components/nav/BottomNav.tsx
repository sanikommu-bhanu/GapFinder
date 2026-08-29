"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, History, ScanLine, Target, User } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Only the four places a student goes every day, plus the capture action.
 * Everything else lives in the header menu — a tab bar that tries to hold the
 * whole product ends up holding none of it well.
 *
 * "Ask a concept" is deliberately not here. It answers a topic directly, which
 * is the one thing that makes GapFinder look like a general-purpose chatbot
 * rather than a diagnostic. It stays a tap away in the menu; the tab bar is
 * reserved for the diagnose → repair loop the product is actually about.
 *
 * Every href below must also appear in TAB_ROUTES in (main)/layout.tsx, or the
 * tab bar disappears on arrival at its own tab.
 */
const items = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/gaps", label: "Gaps", icon: Target },
  { href: "/scan", label: "Scan", icon: ScanLine, isAction: true },
  { href: "/history", label: "History", icon: History },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex w-full max-w-[430px] items-stretch justify-between border-t border-navy-50 bg-white/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-md"
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);

        if (item.isAction) {
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label="Analyze new work"
              className="flex min-w-[56px] items-center justify-center"
            >
              <span className="flex h-12 w-12 -translate-y-3 items-center justify-center rounded-full bg-navy-900 text-on-strong shadow-floating transition-transform active:scale-95">
                <item.icon className="h-5 w-5" />
              </span>
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-colors",
              active ? "text-navy-900" : "text-ink-faint"
            )}
          >
            <item.icon className={cn("h-5 w-5", active && "stroke-[2.4]")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
