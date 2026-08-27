"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Play, Pause, RotateCcw, Check, Target, ArrowRight } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { FocusMusicCard } from "@/components/focus/FocusMusicCard";
import { cn } from "@/lib/cn";

const PRESETS = [
  { minutes: 15, label: "15 min" },
  { minutes: 25, label: "25 min" },
  { minutes: 45, label: "45 min" },
];

/**
 * Focus Mode.
 *
 * A timer alone is a utility any phone already has. What makes this GapFinder's
 * is the second line: the block is *about* something — a named misconception
 * from the student's own work, with the mastery it is meant to move. That
 * objective is loaded from the gap, not typed by the student, so the screen
 * can't drift out of sync with what the diagnosis actually found.
 *
 * The music card is strictly additive. It renders nothing when the server has
 * no Spotify credentials, and everything on this page works identically
 * whether or not it appears — no state here depends on it.
 *
 * An earlier version of this screen had music and ambient-sound buttons that
 * saved a setting and played nothing. That is the bar the Spotify card had to
 * clear to exist: real playback of the student's own account, or no control at
 * all.
 */

/** What the OAuth callback redirects back with, in words a student can act on. */
const SPOTIFY_OUTCOMES: Record<string, { tone: "ok" | "warn"; message: string }> = {
  connected: { tone: "ok", message: "Spotify connected." },
  denied: { tone: "warn", message: "Spotify access wasn't granted — Focus Mode works without it." },
  state_mismatch: { tone: "warn", message: "That sign-in link had expired. Try connecting again." },
  exchange_failed: { tone: "warn", message: "Spotify couldn't complete the sign-in. Try again." },
  unauthenticated: { tone: "warn", message: "Your session expired during sign-in. Sign in and try again." },
  misconfigured: { tone: "warn", message: "Spotify isn't set up on this server — Focus Mode works without it." },
};

interface FocusGap {
  id: string;
  underlyingGap: string;
  classification: string;
  concept: { name: string };
  masteryScore: number;
}

function FocusModeInner() {
  const params = useSearchParams();
  const gapId = params.get("gapId");
  const spotifyOutcome = params.get("spotify");

  const [duration, setDuration] = useState(25 * 60);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const endsAtRef = useRef<number | null>(null);

  const [gap, setGap] = useState<FocusGap | null>(null);

  /**
   * The objective. An explicit gapId wins; otherwise the oldest open gap is
   * the one that has been waiting longest, which is the honest default for
   * "what should I work on".
   */
  useEffect(() => {
    let cancelled = false;
    const endpoint = gapId ? `/api/gaps/${gapId}` : "/api/gaps?status=open";

    fetch(endpoint)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        const found: FocusGap | null = gapId ? d.gap ?? null : d.gaps?.[0] ?? null;
        setGap(found);
      })
      // A missing objective is not an error — Focus Mode is still a timer.
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [gapId]);

  // Driven by wall-clock time rather than tick counting, so a backgrounded tab
  // (where browsers throttle timers) still shows the correct remaining time.
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      if (endsAtRef.current === null) return;
      const left = Math.max(0, Math.round((endsAtRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setRunning(false);
        setDone(true);
        endsAtRef.current = null;
      }
    }, 250);
    return () => clearInterval(interval);
  }, [running]);

  const start = useCallback(() => {
    endsAtRef.current = Date.now() + remaining * 1000;
    setDone(false);
    setRunning(true);
  }, [remaining]);

  const pause = useCallback(() => {
    setRunning(false);
    endsAtRef.current = null;
  }, []);

  const reset = useCallback(
    (seconds = duration) => {
      setRunning(false);
      setDone(false);
      endsAtRef.current = null;
      setRemaining(seconds);
    },
    [duration]
  );

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const progress = duration > 0 ? 1 - remaining / duration : 0;
  const circumference = 2 * Math.PI * 120;

  const outcome = spotifyOutcome ? SPOTIFY_OUTCOMES[spotifyOutcome] : undefined;

  return (
    <div className="pb-8">
      <TopBar title="Focus Mode" />
      <div className="flex flex-col items-center px-5">
        <p className="text-center text-[13px] text-ink-soft">
          One block, one problem. We&apos;ll keep time.
        </p>

        {outcome && (
          <p
            className={cn(
              "mt-3 w-full rounded-2xl bg-surface-muted p-3 text-center text-[11px] leading-relaxed",
              outcome.tone === "ok" ? "text-success" : "text-ink-soft"
            )}
          >
            {outcome.message}
          </p>
        )}

        {/* The objective. This is what separates a focus block from a stopwatch. */}
        {gap && (
          <Card className="mt-4 flex w-full items-center gap-3">
            <ProgressRing value={gap.masteryScore} size={48} strokeWidth={5} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-lavender-600">
                Repairing
              </p>
              <p className="truncate text-sm font-semibold text-navy-900">{gap.concept.name}</p>
              <p className="line-clamp-2 text-[11px] leading-relaxed text-ink-soft">
                {gap.underlyingGap}
              </p>
            </div>
          </Card>
        )}

        <div className="relative mt-6 flex items-center justify-center">
          <svg width="264" height="264" className="-rotate-90" aria-hidden="true">
            <circle cx="132" cy="132" r="120" stroke="rgb(var(--c-navy-50))" strokeWidth="10" fill="none" />
            <circle
              cx="132"
              cy="132"
              r="120"
              stroke="url(#focus-ring)"
              strokeWidth="10"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              style={{ transition: "stroke-dashoffset 0.3s linear" }}
            />
            <defs>
              <linearGradient id="focus-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#C3B4F7" />
                <stop offset="100%" stopColor="#FFB27A" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute flex flex-col items-center">
            <p
              className="font-display text-[56px] font-bold leading-none tabular-nums tracking-tight text-navy-900"
              aria-live="off"
            >
              {mm}:{ss}
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              {running ? "Focusing" : done ? "Done" : "Ready"}
            </p>
          </div>
        </div>

        {!running && !done && (
          <div className="mt-6 flex w-full gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.minutes}
                onClick={() => {
                  setDuration(p.minutes * 60);
                  reset(p.minutes * 60);
                }}
                aria-pressed={duration === p.minutes * 60}
                className={cn(
                  "min-h-[44px] flex-1 rounded-2xl text-sm font-semibold transition-colors",
                  duration === p.minutes * 60
                    ? "bg-navy-900 text-on-strong"
                    : "bg-surface-muted text-ink-soft"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {done ? (
          <Card className="mt-6 w-full items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-50">
              <Check className="h-7 w-7 text-success" />
            </span>
            <p className="mt-3 font-display text-base font-bold text-navy-900">Block finished</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              {gap
                ? `Take a short break, then close the gap in ${gap.concept.name}.`
                : "Take a short break, then come back to the gap you left open."}
            </p>
            <div className="mt-4 flex w-full gap-2">
              <Button variant="outline" className="flex-1" onClick={() => reset()}>
                <RotateCcw className="h-4 w-4" /> Again
              </Button>
              <Link href={gap ? `/gaps/${gap.id}/practice` : "/gaps"} className="flex-1">
                <Button className="w-full">{gap ? "Practice" : "My gaps"}</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="mt-7 flex items-center gap-4">
            {(running || remaining !== duration) && (
              <button
                onClick={() => reset()}
                aria-label="Reset timer"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-ink-soft"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={running ? pause : start}
              aria-label={running ? "Pause timer" : "Start timer"}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-navy-900 text-on-strong shadow-floating transition-transform active:scale-95"
            >
              {running ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 pl-0.5" />}
            </button>
          </div>
        )}

        {/* Additive. Renders nothing at all when Spotify isn't configured. */}
        <FocusMusicCard className="mt-7 w-full" />

        {gap ? (
          <Link href={`/gaps/${gap.id}/practice`} className="mt-6 w-full">
            <Card className="flex items-center gap-3 active:scale-[0.99]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lavender-50">
                <Target className="h-4 w-4 text-lavender-600" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-navy-900">Continue learning</p>
                <p className="truncate text-[11px] text-ink-soft">Practice {gap.concept.name}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />
            </Card>
          </Link>
        ) : (
          <Link href="/scan" className="mt-8">
            <p className="text-xs font-medium text-lavender-600">Analyze a problem instead →</p>
          </Link>
        )}
      </div>
    </div>
  );
}

export default function FocusModePage() {
  // useSearchParams needs a Suspense boundary for static rendering.
  return (
    <Suspense fallback={<div className="h-screen" />}>
      <FocusModeInner />
    </Suspense>
  );
}
