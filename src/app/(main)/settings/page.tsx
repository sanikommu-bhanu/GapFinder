"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Bell, Palette, Mic, Timer, BookOpen, Activity } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

const SECTIONS: {
  heading: string;
  rows: { label: string; hint: string; href: string; icon: typeof Bell }[];
}[] = [
  {
    heading: "Study",
    rows: [
      {
        label: "Study preferences",
        hint: "Subject, daily goal, pace",
        href: "/settings/study-preferences",
        icon: BookOpen,
      },
      { label: "Focus mode", hint: "A timer for one session", href: "/focus", icon: Timer },
    ],
  },
  {
    heading: "App",
    rows: [
      { label: "Appearance", hint: "Accent colour and text size", href: "/settings/appearance", icon: Palette },
      { label: "Voice", hint: "Speak your explanations", href: "/settings/voice", icon: Mic },
    ],
  },
  {
    heading: "Under the hood",
    rows: [
      {
        label: "AI observability",
        hint: "Every model call, cached or live",
        href: "/dev/observability",
        icon: Activity,
      },
    ],
  },
];

export default function SettingsPage() {
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setNotificationsOn(d?.settings?.notificationsOn ?? true))
      .catch(() => {});
  }, []);

  async function toggleNotifications() {
    const next = !notificationsOn;
    setNotificationsOn(next);
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationsOn: next }),
      });
    } catch {
      // Roll the switch back rather than showing a state we failed to save.
      setNotificationsOn(!next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-8">
      <TopBar title="Settings" />
      <div className="px-5">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Notifications</p>
        <Card className="flex items-center gap-3 py-3">
          <Bell className="h-4 w-4 shrink-0 text-ink-faint" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-navy-900">Practice reminders</p>
            <p className="text-[11px] text-ink-soft">A nudge when a gap has been open a while</p>
          </div>
          <button
            role="switch"
            aria-checked={notificationsOn}
            aria-label="Practice reminders"
            onClick={toggleNotifications}
            disabled={saving}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-pill transition-colors",
              notificationsOn ? "bg-lavender-500" : "bg-navy-50"
            )}
          >
            <span
              className={cn(
                "absolute top-1 h-5 w-5 rounded-full bg-white shadow-card transition-transform",
                notificationsOn ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </Card>

        {SECTIONS.map((section) => (
          <div key={section.heading} className="mt-5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
              {section.heading}
            </p>
            <Card className="divide-y divide-navy-50 p-0">
              {section.rows.map((row) => (
                <Link
                  key={row.href + row.label}
                  href={row.href}
                  className="flex min-h-[56px] items-center gap-3 px-4 py-3 active:bg-surface-muted"
                >
                  <row.icon className="h-4 w-4 shrink-0 text-ink-faint" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-navy-900">{row.label}</p>
                    <p className="truncate text-[11px] text-ink-soft">{row.hint}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
                </Link>
              ))}
            </Card>
          </div>
        ))}

        <p className="mt-6 px-1 text-[11px] leading-relaxed text-ink-faint">
          GapFinder stores your work so it can tell what you&apos;ve already learned. Analyses, gaps and mastery
          scores live in your account and are never shared.
        </p>
      </div>
    </div>
  );
}
