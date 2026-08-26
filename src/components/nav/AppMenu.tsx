"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Home,
  ScanLine,
  Target,
  Route,
  Compass,
  Sparkles,
  GraduationCap,
  MessageCircle,
  History,
  Trophy,
  Timer,
  Settings as SettingsIcon,
  User,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/cn";

const SECTIONS: { heading: string; items: { href: string; label: string; icon: typeof Home }[] }[] = [
  {
    heading: "Learn",
    items: [
      { href: "/home", label: "Home", icon: Home },
      { href: "/learn", label: "Ask a concept", icon: Sparkles },
      { href: "/solve", label: "Solve with me", icon: Compass },
      { href: "/scan", label: "Check my work", icon: ScanLine },
      { href: "/gaps", label: "My learning gaps", icon: Target },
      { href: "/exam", label: "Exam mode", icon: GraduationCap },
      { href: "/roadmap", label: "Learning roadmap", icon: Route },
      { href: "/coach", label: "AI Coach", icon: MessageCircle },
    ],
  },
  {
    heading: "Progress",
    items: [
      { href: "/history", label: "History", icon: History },
      { href: "/reports/full", label: "Full report", icon: FileText },
      { href: "/achievements", label: "Achievements", icon: Trophy },
      { href: "/focus", label: "Focus mode", icon: Timer },
    ],
  },
  {
    heading: "You",
    items: [
      { href: "/profile", label: "Profile", icon: User },
      { href: "/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

/**
 * The menu behind the header icon.
 *
 * The app has more surfaces than a five-slot tab bar can hold, and the deeper
 * ones (roadmap, reports, focus, achievements) were previously reachable only
 * by guessing a URL. This is where they live, so the tab bar can stay at the
 * four places a student goes daily.
 */
export function AppMenu({ tone = "light" }: { tone?: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on route change so the panel never survives a navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);

    // The document is the scrolling element, so this is what holds the page
    // still behind the open panel. Always handed back on close.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full transition-colors active:bg-black/5",
          tone === "dark" ? "text-white" : "text-navy-900"
        )}
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-navy-950/40 backdrop-blur-[2px] animate-fade-up"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            className="relative ml-auto flex h-full w-[min(20rem,85vw)] flex-col overflow-y-auto overscroll-contain bg-white pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-floating scrollbar-none"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-navy-50 bg-white px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
              <p className="font-display text-lg font-bold text-lavender-600">GapFinder</p>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-11 w-11 items-center justify-center rounded-full text-navy-900 active:bg-surface-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="px-3 pt-2">
              {SECTIONS.map((section) => (
                <div key={section.heading} className="mb-3">
                  <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                    {section.heading}
                  </p>
                  {section.items.map((item) => {
                    const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex min-h-[44px] items-center gap-3 rounded-2xl px-3 text-sm transition-colors",
                          active ? "bg-lavender-50 font-semibold text-lavender-600" : "text-navy-900 active:bg-surface-muted"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
