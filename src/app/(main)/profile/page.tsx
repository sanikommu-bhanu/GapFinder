"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Flame, Trophy, Route, Settings as SettingsIcon, FileText, LogOut } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/store/useAppStore";

type Profile = { name: string; email: string; isPremium?: boolean; streakDays?: number };
type Totals = { gapsFound: number; gapsRepaired: number; gapsTransferred: number };

const LINKS = [
  { href: "/achievements", label: "Achievements", icon: Trophy },
  { href: "/roadmap", label: "Learning roadmap", icon: Route },
  { href: "/reports/full", label: "Full report", icon: FileText },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function ProfilePage() {
  const router = useRouter();
  const reset = useAppStore((s) => s.reset);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [mastery, setMastery] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) {
          setProfile({
            name: d.user.name,
            email: d.user.email,
            isPremium: d.user.profile?.isPremium,
            streakDays: d.user.profile?.streakDays,
          });
        }
      })
      .catch(() => {});

    fetch("/api/reports/full")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.totals) setTotals(d.totals);
        if (Array.isArray(d?.mastery) && d.mastery.length > 0) {
          const avg =
            d.mastery.reduce((sum: number, m: { score: number }) => sum + m.score, 0) / d.mastery.length;
          setMastery(Math.round(avg));
        }
      })
      .catch(() => {});
  }, []);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Even if the request fails, clear local state and send them out.
    }
    reset();
    router.replace("/splash");
  }

  // Transfer rate over gaps found — the honest measure, not a flattering one.
  const transferRate =
    totals && totals.gapsFound > 0 ? Math.round((totals.gapsTransferred / totals.gapsFound) * 100) : 0;

  return (
    <div className="pb-6">
      <TopBar title="Profile" back={false} />
      <div className="px-5">
        <Card className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-brand">
            <span className="font-display text-lg font-bold text-white">
              {profile ? initials(profile.name) : "…"}
            </span>
          </div>
          <p className="mt-3 font-display text-lg font-bold text-navy-900">{profile?.name ?? "Loading…"}</p>
          <p className="mt-0.5 text-xs text-ink-soft">{profile?.email ?? ""}</p>
        </Card>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Card className="items-center py-3 text-center">
            <p className="font-display text-lg font-bold text-navy-900">{totals?.gapsRepaired ?? 0}</p>
            <p className="mt-0.5 text-[10px] leading-tight text-ink-soft">Gaps repaired</p>
          </Card>
          <Card className="items-center py-3 text-center">
            <p className="font-display text-lg font-bold text-navy-900">{transferRate}%</p>
            <p className="mt-0.5 text-[10px] leading-tight text-ink-soft">Transfer rate</p>
          </Card>
          <Card className="items-center py-3 text-center">
            <p className="font-display text-lg font-bold text-navy-900">{mastery}%</p>
            <p className="mt-0.5 text-[10px] leading-tight text-ink-soft">Mastery</p>
          </Card>
        </div>

        {(profile?.streakDays ?? 0) > 0 && (
          <Card className="mt-3 flex items-center gap-3 bg-gradient-peach shadow-none">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface">
              <Flame className="h-5 w-5 text-peach-500" />
            </span>
            <div>
              <p className="text-sm font-semibold text-navy-900">
                {profile!.streakDays}-day streak
              </p>
              <p className="text-[11px] text-ink-soft">Keep it going — consistency beats cramming.</p>
            </div>
          </Card>
        )}

        <Card className="mt-3 divide-y divide-navy-50 p-0">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex min-h-[52px] items-center gap-3 px-4 py-3.5 active:bg-surface-muted"
            >
              <l.icon className="h-4 w-4 shrink-0 text-ink-faint" />
              <p className="flex-1 text-sm text-navy-900">{l.label}</p>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
            </Link>
          ))}
        </Card>

        <Button variant="outline" className="mt-5 w-full" onClick={logout} loading={loggingOut}>
          <LogOut className="h-4 w-4" /> Log out
        </Button>
      </div>
    </div>
  );
}
