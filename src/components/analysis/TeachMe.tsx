"use client";
import { useEffect, useRef, useState } from "react";
import { Volume2, Pause, Play, Square, GraduationCap } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useSpeechOutput } from "@/hooks/useSpeechOutput";
import { lessonToSpeech, type LessonLine } from "@/lib/teaching/build-lesson";
import { cn } from "@/lib/cn";

const ROLE_STYLE: Record<LessonLine["role"], { label: string; tone: string }> = {
  mistake: { label: "What you wrote", tone: "text-danger" },
  why: { label: "Why it happened", tone: "text-warning" },
  concept: { label: "The concept", tone: "text-lavender-600" },
  correct: { label: "The correct reasoning", tone: "text-success" },
  avoid: { label: "Next time", tone: "text-ink-soft" },
};

/**
 * "Teach Me" — the lesson delivered a line at a time.
 *
 * One component covers both modalities the addendum asks for. The lesson always
 * animates in as written teaching; where the browser can speak, it reads along
 * and the line being spoken is the line highlighted. That keeps the two in sync
 * without a second implementation, and means a device with no speech engine
 * loses the audio but not the lesson.
 *
 * Nothing here is generated at render time — every line comes from the proved
 * diagnosis, which is what makes it safe to say out loud.
 */
export function TeachMe({
  lines,
  rate = 1,
  className,
}: {
  lines: LessonLine[];
  rate?: number;
  className?: string;
}) {
  const speech = useSpeechOutput({ rate });
  const [revealed, setRevealed] = useState(0);
  const [started, setStarted] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Written teaching paces itself; spoken teaching sets the pace instead, so
  // the highlight always matches what the student is hearing.
  useEffect(() => {
    if (!started) return;
    if (speech.speaking && speech.currentIndex >= 0) {
      setRevealed(speech.currentIndex + 1);
      return;
    }
    if (speech.speaking || revealed >= lines.length) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setRevealed(lines.length);
      return;
    }
    // Roughly reading speed for the line just shown.
    const words = lines[revealed]?.text.split(/\s+/).length ?? 8;
    timer.current = setTimeout(() => setRevealed((n) => n + 1), Math.min(4200, 900 + words * 110));
    return () => clearTimeout(timer.current);
  }, [started, revealed, lines, speech.speaking, speech.currentIndex]);

  function start() {
    setStarted(true);
    setRevealed(0);
    if (speech.supported) speech.speak(lessonToSpeech(lines));
  }

  function stopAll() {
    speech.stop();
    setStarted(false);
    setRevealed(0);
    clearTimeout(timer.current);
  }

  if (lines.length === 0) return null;

  return (
    <Card className={cn("border border-lavender-200", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lavender-50">
            <GraduationCap className="h-4 w-4 text-lavender-600" />
          </span>
          <div>
            <p className="text-sm font-semibold text-navy-900">Teach me this</p>
            <p className="text-[11px] text-ink-soft">
              {speech.supported ? "Read aloud, step by step" : "Step by step"}
            </p>
          </div>
        </div>

        {!started ? (
          <Button size="md" className="shrink-0 px-4" onClick={start}>
            {speech.supported ? <Volume2 className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            Start
          </Button>
        ) : (
          <div className="flex shrink-0 items-center gap-1.5">
            {speech.supported && speech.speaking && (
              <button
                onClick={speech.paused ? speech.resume : speech.pause}
                aria-label={speech.paused ? "Resume" : "Pause"}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-navy-900"
              >
                {speech.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </button>
            )}
            <button
              onClick={stopAll}
              aria-label="Stop"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-navy-900"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {started && (
        <div className="mt-4 flex flex-col gap-3" aria-live="polite">
          {lines.slice(0, revealed).map((line, i) => {
            const style = ROLE_STYLE[line.role];
            const heading = line.label ?? style.label;
            const active = speech.speaking && speech.currentIndex === i;
            return (
              <div
                key={i}
                className={cn(
                  "rounded-2xl p-3 transition-all duration-300 animate-fade-up",
                  active ? "bg-lavender-50 shadow-card" : "bg-surface-muted"
                )}
              >
                <p className={cn("text-[10px] font-semibold uppercase tracking-wide", style.tone)}>
                  {heading}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-navy-900">{line.text}</p>
                {line.expression && (
                  <p className="mt-1.5 font-display text-lg font-bold text-navy-900">{line.expression}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {started && !speech.supported && (
        <p className="mt-3 text-[11px] text-ink-faint">
          This browser can&apos;t read aloud, so the lesson is written out instead.
        </p>
      )}
    </Card>
  );
}
