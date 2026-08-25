"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, History, Mic, Target, User } from "lucide-react";
import { cn } from "@/lib/cn";

const items = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/history", label: "History", icon: History },
  { href: "/scan", label: "", icon: Mic, isMic: true },
  { href: "/gaps", label: "Gaps", icon: Target },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-20 flex items-center justify-between border-t border-navy-50 bg-white/95 px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
      {items.map((item) => {
        const active = pathname?.startsWith(item.href);
        if (item.isMic) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex h-12 w-12 -translate-y-3 items-center justify-center rounded-full bg-navy-900 text-white shadow-floating"
            >
              <item.icon className="h-5 w-5" />
            </Link>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn("flex flex-col items-center gap-1 text-[10px]", active ? "text-navy-900" : "text-ink-faint")}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
