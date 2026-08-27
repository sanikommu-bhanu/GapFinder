"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, ImageIcon, ArrowRight, Lightbulb, Target, Compass, GraduationCap } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { AppMenu } from "@/components/nav/AppMenu";
import { FocusMusicCard } from "@/components/focus/FocusMusicCard";
import { useAppStore } from "@/store/useAppStore";
import { SUBJECTS } from "@/lib/subjects";



type OpenGap = {
  id: string;
  underlyingGap: string;
  status: string;
  concept: { name: string };
  masteryScore: number;
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const [name, setName] = useState<string | null>(user?.name?.split(" ")[0] ?? null);
  const [topic, setTopic] = useState("Math");
  const [overallMastery, setOverallMastery] = useState<number | null>(null);
  const [currentGap, setCurrentGap] = useState<OpenGap | null>(null);
  const [gapsLoading, setGapsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) {
          setName(d.user.name?.split(" ")[0] ?? null);
          setUser({
            id: d.user.id,
            name: d.user.name,
            email: d.user.email,
            isPremium: d.user.profile?.isPremium,
            streakDays: d.user.profile?.streakDays,
          });
        }
      })
      .catch(() => {});
  }, [setUser]);

  useEffect(() => {
    fetch("/api/gaps?status=open")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setOverallMastery(d.overallMastery ?? 0);
          setCurrentGap(d.gaps?.[0] ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setGapsLoading(false));
  }, []);

  return (
    <div className="px-5 pb-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 pt-1">
          <h1 className="truncate font-display text-[21px] font-bold leading-tight text-navy-900">
            {greeting()}
            {name ? `, ${name}` : ""}! <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-0.5 text-xs text-ink-soft">Let&apos;s fix learning gaps today.</p>
        </div>
        <div className="-mr-2 shrink-0">
          <AppMenu />
        </div>
      </div>

      {/* Continue where the student left off — shown only when a real open gap exists. */}
      {!gapsLoading && currentGap && (
        <Link href={`/gaps/${currentGap.id}/practice`} className="mt-4 block">
          <Card className="flex items-center gap-3">
            <ProgressRing value={currentGap.masteryScore} size={54} strokeWidth={6} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-lavender-600">
                Continue learning
              </p>
              <p className="truncate text-sm font-semibold text-navy-900">{currentGap.concept.name}</p>
              <p className="truncate text-[11px] text-ink-soft">{currentGap.underlyingGap}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />
          </Card>
        </Link>
      )}

      {/* The two ways in, side by side. A student either has a question they
          can't start, or working they want checked — neither should be buried. */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link href="/solve">
          <Card className="flex h-full flex-col gap-2 active:scale-[0.99]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-peach-50">
              <Compass className="h-4 w-4 text-peach-500" />
            </span>
            <div>
              <p className="text-sm font-semibold text-navy-900">Solve With Me</p>
              <p className="text-[11px] text-ink-soft">Stuck on a question</p>
            </div>
          </Card>
        </Link>
        <Link href="/scan">
          <Card className="flex h-full flex-col gap-2 active:scale-[0.99]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lavender-50">
              <ImageIcon className="h-4 w-4 text-lavender-600" />
            </span>
            <div>
              <p className="text-sm font-semibold text-navy-900">Check My Work</p>
              <p className="text-[11px] text-ink-soft">Find where it broke</p>
            </div>
          </Card>
        </Link>
      </div>

      {/* Focus, with the student's own music when Spotify is linked.
          Renders nothing at all when the server has no Spotify credentials, so
          the homepage never advertises a service this deployment can't reach. */}
      <FocusMusicCard className="mt-3" />

      <div className="mt-3 grid grid-cols-2 gap-3">
        {/* Two tiles both offering to "ask anything" taught nobody where to
            go. This is the one with the diagram, the voice and the check;
            the coach stays a tap away in the menu. */}
        <Link href="/learn">
          <Card className="flex h-full flex-col gap-2 active:scale-[0.99]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lavender-50">
              <Sparkles className="h-4 w-4 text-lavender-600" />
            </span>
            <div>
              <p className="text-sm font-semibold text-navy-900">Ask a Concept</p>
              <p className="text-[11px] text-ink-soft">Explain any topic</p>
            </div>
          </Card>
        </Link>
        <Link href="/exam">
          <Card className="flex h-full flex-col gap-2 active:scale-[0.99]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-muted">
              <GraduationCap className="h-4 w-4 text-navy-900" />
            </span>
            <div>
              <p className="text-sm font-semibold text-navy-900">Exam Mode</p>
              <p className="text-[11px] text-ink-soft">No hints</p>
            </div>
          </Card>
        </Link>
      </div>

      <Link href="/scan" className="mt-3 block">
        <Card className="flex items-center gap-3 active:scale-[0.99]">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-navy-900">Upload Your Work</p>
            <p className="mt-0.5 text-[11px] text-ink-soft">Analyze handwritten solutions</p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy-900 text-on-strong shadow-soft">
            <ArrowRight className="h-4 w-4" />
          </span>
        </Card>
      </Link>

      {!gapsLoading && !currentGap && overallMastery === 0 && (
        <Card className="mt-3 flex items-center gap-3 bg-surface-muted shadow-none">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">
            <Target className="h-4 w-4 text-lavender-500" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-navy-900">No gaps found yet</p>
            <p className="text-[11px] leading-relaxed text-ink-soft">
              Upload a worked problem and we&apos;ll find the exact step where your reasoning changed.
            </p>
          </div>
        </Card>
      )}

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm font-semibold text-navy-900">Topics</p>
        <Link href="/gaps" className="text-xs font-medium text-lavender-600">
          See All
        </Link>
      </div>
      <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 scrollbar-none">
        {SUBJECTS.map((s) => (
          <Chip key={s.name} active={topic === s.name} onClick={() => setTopic(s.name)} className="shrink-0">
            {s.name}
          </Chip>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link href="/scan">
          <Card className="flex h-full flex-col active:scale-[0.99]">
            <p className="text-sm font-semibold leading-snug text-navy-900">Find The First Gap</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
              We locate the exact step where your reasoning changed.
            </p>
            <span className="mt-auto pt-2 text-xs font-semibold text-lavender-600">Learn more →</span>
          </Card>
        </Link>
        <Link href="/gaps">
          <Card className="flex h-full flex-col active:scale-[0.99]">
            <p className="text-sm font-semibold leading-snug text-navy-900">Close The Gap</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
              Practice built for the concept that actually broke.
            </p>
            <span className="mt-auto pt-2 text-xs font-semibold text-lavender-600">Learn more →</span>
          </Card>
        </Link>
      </div>

      <div className="mt-5 flex items-start gap-2 rounded-2xl bg-surface-muted p-3">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-peach-500" />
        <p className="text-xs leading-relaxed text-ink-soft">
          Clear, complete steps help us reconstruct your reasoning instead of guessing at it.
        </p>
      </div>
    </div>
  );
}
