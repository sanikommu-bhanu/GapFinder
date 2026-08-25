"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, ScanLine, Camera as CameraIcon, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { useAppStore } from "@/store/useAppStore";

const TOPICS = ["Math", "Physics", "Chemistry", "Biology"];

type OpenGap = {
  id: string;
  underlyingGap: string;
  status: string;
  concept: { name: string };
  masteryScore: number;
};

export default function HomePage() {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const [greetName, setGreetName] = useState("there");
  const [topic, setTopic] = useState("Math");
  const [overallMastery, setOverallMastery] = useState<number | null>(null);
  const [currentGap, setCurrentGap] = useState<OpenGap | null>(null);
  const [gapsLoading, setGapsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setGreetName(d.user.name?.split(" ")[0] ?? "there");
          setUser({ id: d.user.id, name: d.user.name, email: d.user.email, isPremium: d.user.profile?.isPremium, streakDays: d.user.profile?.streakDays });
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
    <div className="px-5 pt-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">
            Good morning, {user?.name?.split(" ")[0] ?? greetName}! 👋
          </h1>
          <p className="text-xs text-ink-soft">Let&apos;s fix learning gaps today.</p>
        </div>
      </div>

      {!gapsLoading && currentGap && (
        <Link href={`/gaps/${currentGap.id}/practice`}>
          <Card className="mt-4 flex items-center gap-3">
            <ProgressRing value={overallMastery ?? 0} size={56} strokeWidth={6} label="" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-lavender-600">
                Continue Learning
              </p>
              <p className="truncate text-sm font-semibold text-navy-900">{currentGap.concept.name}</p>
              <p className="truncate text-[11px] text-ink-soft">{currentGap.underlyingGap}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />
          </Card>
        </Link>
      )}

      {!gapsLoading && !currentGap && (
        <Card className="mt-4 flex items-center gap-3 bg-surface-muted">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
            <Sparkles className="h-4 w-4 text-lavender-500" />
          </span>
          <div>
            <p className="text-sm font-semibold text-navy-900">No open gaps right now</p>
            <p className="text-[11px] text-ink-soft">Scan your work to find your next one.</p>
          </div>
        </Card>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link href="/coach">
          <Card className="flex flex-col gap-2 bg-gradient-lavender">
            <Sparkles className="h-5 w-5 text-lavender-600" />
            <p className="text-sm font-semibold text-navy-900">AI Coach</p>
            <p className="text-[11px] text-ink-soft">Ask anything</p>
          </Card>
        </Link>
        <Link href="/scan?mode=gallery">
          <Card className="flex flex-col gap-2 bg-gradient-peach">
            <ScanLine className="h-5 w-5 text-peach-500" />
            <p className="text-sm font-semibold text-navy-900">Image Analyzer</p>
            <p className="text-[11px] text-ink-soft">Upload work</p>
          </Card>
        </Link>
      </div>

      <Link href="/scan">
        <Card className="mt-3 flex items-center gap-3 bg-navy-900 text-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <CameraIcon className="h-5 w-5" />
          </span>
          <span>
            <p className="text-sm font-semibold">Upload Your Handwriting</p>
            <p className="text-xs text-white/60">Analyze handwritten solutions</p>
          </span>
        </Card>
      </Link>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm font-semibold text-navy-900">Topics</p>
        <Link href="/gaps" className="text-xs font-medium text-lavender-600">
          See All
        </Link>
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto scrollbar-none">
        {TOPICS.map((t) => (
          <Chip key={t} active={topic === t} onClick={() => setTopic(t)}>
            {t}
          </Chip>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link href="/scan">
          <Card className="flex h-full flex-col gap-1">
            <p className="text-sm font-semibold text-navy-900">Find The First Gap</p>
            <p className="text-[11px] text-ink-soft">We locate the exact step where reasoning changed.</p>
            <span className="mt-2 text-xs font-semibold text-lavender-600">Learn more →</span>
          </Card>
        </Link>
        <Link href="/gaps">
          <Card className="flex h-full flex-col gap-1">
            <p className="text-sm font-semibold text-navy-900">Close The Gap</p>
            <p className="text-[11px] text-ink-soft">Personalized practice to strengthen understanding.</p>
            <span className="mt-2 text-xs font-semibold text-lavender-600">Learn more →</span>
          </Card>
        </Link>
      </div>

      <div className="mb-4 mt-6 rounded-2xl bg-surface-muted p-3 text-xs text-ink-soft">
        💡 Tip: Clear steps help us give more accurate analysis.
      </div>
    </div>
  );
}
