"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";

const rows: { label: string; href: string; section: string }[] = [
  { label: "Default Subject", href: "/settings/study-preferences", section: "General" },
  { label: "Study Preferences", href: "/settings/study-preferences", section: "General" },
  { label: "Appearance", href: "/settings/appearance", section: "Appearance" },
  { label: "Voice", href: "/settings/voice", section: "Appearance" },
  { label: "Focus Mode", href: "/focus", section: "Appearance" },
  { label: "AI Observability", href: "/dev/observability", section: "Developer" },
];

export default function SettingsPage() {
  const [notificationsOn, setNotificationsOn] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setNotificationsOn(d.settings?.notificationsOn ?? true));
  }, []);

  async function toggleNotifications() {
    const next = !notificationsOn;
    setNotificationsOn(next);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationsOn: next }),
    });
  }

  const grouped = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    const bucket = (acc[r.section] ??= []);
    bucket.push(r);
    return acc;
  }, {});

  return (
    <div className="pb-6">
      <TopBar title="Settings" back={false} />
      <div className="px-5">
        {Object.entries(grouped).map(([section, items]) => (
          <div key={section} className="mb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{section}</p>
            <Card className="divide-y divide-navy-50 p-0">
              {section === "General" && (
                <div className="flex items-center justify-between px-4 py-3.5">
                  <p className="text-sm text-navy-900">Notifications</p>
                  <button
                    onClick={toggleNotifications}
                    className={`h-6 w-11 rounded-pill transition-colors ${notificationsOn ? "bg-navy-900" : "bg-navy-50"}`}
                  >
                    <span
                      className={`block h-5 w-5 translate-x-0.5 rounded-full bg-white transition-transform ${
                        notificationsOn ? "translate-x-[22px]" : ""
                      }`}
                    />
                  </button>
                </div>
              )}
              {[...new Map(items.map((i) => [i.label, i])).values()].map((r) => (
                <Link key={r.label} href={r.href} className="flex items-center justify-between px-4 py-3.5">
                  <p className="text-sm text-navy-900">{r.label}</p>
                  <ChevronRight className="h-4 w-4 text-ink-faint" />
                </Link>
              ))}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
