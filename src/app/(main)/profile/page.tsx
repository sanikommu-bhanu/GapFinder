"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Flame } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/store/useAppStore";

export default function ProfilePage() {
  const router = useRouter();
  const reset = useAppStore((s) => s.reset);
  const [profile, setProfile] = useState<{ name: string; email: string; isPremium?: boolean; streakDays?: number } | null>(null);
  const [gapsClosed, setGapsClosed] = useState(0);
  const [transferRate, setTransferRate] = useState(0);
  const [mastery, setMastery] = useState(0);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setProfile({ name: d.user.name, email: d.user.email, isPremium: d.user.profile?.isPremium, streakDays: d.user.profile?.streakDays });
      });
    fetch("/api/gaps")
      .then((r) => r.json())
      .then((d) => {
        setMastery(d.overallMastery ?? 0);
        const closed = (d.gaps ?? []).filter((g: any) => g.status !== "open").length;
        setGapsClosed(closed);
        setTransferRate(d.gaps?.length ? Math.round((closed / d.gaps.length) * 100) : 0);
      });
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    reset();
    router.push("/splash");
  }

  return (
    <div className="pb-6">
      <TopBar title="Profile" back={false} />
      <div className="px-5">
        <Card className="items-center text-center">
          <div className="h-16 w-16 rounded-full bg-gradient-brand" />
          <p className="mt-3 font-display text-lg font-bold text-navy-900">{profile?.name ?? "…"}</p>
          <p className="text-xs text-ink-soft">{profile?.isPremium ? "Premium User" : profile?.email}</p>
        </Card>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Card className="items-center py-3 text-center">
            <p className="text-lg font-bold text-navy-900">{gapsClosed}</p>
            <p className="text-[10px] text-ink-soft">Gaps Repaired</p>
          </Card>
          <Card className="items-center py-3 text-center">
            <p className="text-lg font-bold text-navy-900">{transferRate}%</p>
            <p className="text-[10px] text-ink-soft">Transfer Rate</p>
          </Card>
          <Card className="items-center py-3 text-center">
            <p className="flex items-center gap-1 text-lg font-bold text-navy-900">
              {profile?.streakDays ?? 0}
              <Flame className="h-4 w-4 text-peach-500" />
            </p>
            <p className="text-[10px] text-ink-soft">Day Streak</p>
          </Card>
        </div>

        <Card className="mt-3 p-0 divide-y divide-navy-50">
          <Link href="/achievements" className="flex items-center justify-between px-4 py-3.5">
            <p className="text-sm text-navy-900">Achievements</p>
            <ChevronRight className="h-4 w-4 text-ink-faint" />
          </Link>
          <Link href="/roadmap" className="flex items-center justify-between px-4 py-3.5">
            <p className="text-sm text-navy-900">Learning Roadmap</p>
            <ChevronRight className="h-4 w-4 text-ink-faint" />
          </Link>
          <Link href="/settings" className="flex items-center justify-between px-4 py-3.5">
            <p className="text-sm text-navy-900">Settings</p>
            <ChevronRight className="h-4 w-4 text-ink-faint" />
          </Link>
        </Card>

        <Button variant="outline" className="mt-5 w-full" onClick={logout}>
          Log out
        </Button>
      </div>
    </div>
  );
}
