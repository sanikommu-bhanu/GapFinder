"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Play, Pause, RotateCcw, Check } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const PRESETS = [
  { minutes: 15, label: "15 min" },
  { minutes: 25, label: "25 min" },
  { minutes: 45, label: "45 min" },
];

/**
 * A focus timer, and only that.
 *
 * The earlier version had music and ambient-sound buttons that saved a setting
 * and played nothing — three controls that looked like features and weren't.
 * Rather than ship silent buttons, this does the one thing it can do properly:
 * count down accurately, survive a backgrounded tab, and hand the student
 * straight into the work they came to do.
 */
export default function FocusModePage() {
  const [duration, setDuration] = useState(25 * 60);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const endsAtRef = useRef<number | null>(null);

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

  return (
    <div className="pb-8">
      <TopBar title="Focus Mode" />
      <div className="flex flex-col items-center px-5">
        <p className="text-center text-[13px] text-ink-soft">One block, one problem. We&apos;ll keep time.</p>

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
            <p className="mt-1 text-xs text-ink-soft">{running ? "Focusing" : done ? "Done" : "Ready"}</p>
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
              Take a short break, then come back to the gap you left open.
            </p>
            <div className="mt-4 flex w-full gap-2">
              <Button variant="outline" className="flex-1" onClick={() => reset()}>
                <RotateCcw className="h-4 w-4" /> Again
              </Button>
              <Link href="/gaps" className="flex-1">
                <Button className="w-full">My gaps</Button>
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

        <Link href="/scan" className="mt-8">
          <p className="text-xs font-medium text-lavender-600">Analyze a problem instead →</p>
        </Link>
      </div>
    </div>
  );
}
