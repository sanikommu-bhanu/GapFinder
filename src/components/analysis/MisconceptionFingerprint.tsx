"use client";
import { Fingerprint, Check, Crosshair } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export interface FingerprintStat {
  code: string;
  name: string;
  subject: string;
  occurrences: number;
  proved: number;
  overcome: number;
  dormant: boolean;
  share: number;
}

/**
 * The shape of one learner's errors.
 *
 * Mastery percentages say how well someone is doing; they don't say what is
 * actually going wrong. This does — and it can, because every diagnosis
 * resolves to a code from a closed catalogue rather than a sentence, so the
 * same slip is recognisable across weeks and countable.
 *
 * Two things are worth a student's attention here. The bar at the top is the
 * mistake most likely to happen next. The "no longer happening" list is the
 * one that matters: errors that used to recur and have stopped, which is the
 * only honest way to show that something was learned rather than covered.
 */
export function MisconceptionFingerprint({
  stats,
  brokenHabits,
  totalDiagnoses,
  className,
}: {
  stats: FingerprintStat[];
  brokenHabits: { code: string; name: string; occurrences: number }[];
  totalDiagnoses: number;
  className?: string;
}) {
  if (totalDiagnoses === 0) return null;

  const active = stats.filter((s) => !s.dormant).slice(0, 4);

  return (
    <Card className={className}>
      <div className="flex items-center gap-1.5">
        <Fingerprint className="h-3.5 w-3.5 text-ink-faint" />
        <p className="text-xs font-semibold text-ink-soft">Your error fingerprint</p>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
        Built from {totalDiagnoses} diagnosed {totalDiagnoses === 1 ? "error" : "errors"}, each matched to a
        documented misconception.
      </p>

      {active.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          {active.map((s, i) => (
            <div key={s.code}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  {i === 0 && <Crosshair className="h-3 w-3 shrink-0 text-peach-500" />}
                  <p className="truncate text-[13px] text-navy-900">{s.name}</p>
                </div>
                <p className="shrink-0 text-[11px] tabular-nums text-ink-soft">
                  {s.occurrences}×
                  {s.proved === s.occurrences && (
                    <span className="ml-1 text-success" title="Every instance proved by algebra">
                      ✓
                    </span>
                  )}
                </p>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-pill bg-surface-muted">
                <div
                  className={cn("h-full rounded-pill", i === 0 ? "bg-gradient-brand" : "bg-navy-100")}
                  style={{ width: `${Math.max(4, s.share)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {brokenHabits.length > 0 && (
        <div className="mt-4 rounded-2xl bg-success-50 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-success">
            <Check className="h-3 w-3" /> No longer happening
          </p>
          <div className="mt-1.5 flex flex-col gap-1">
            {brokenHabits.map((h) => (
              <p key={h.code} className="text-[12px] leading-relaxed text-navy-900">
                {h.name}{" "}
                <span className="text-ink-soft">
                  — happened {h.occurrences}×, then stopped
                </span>
              </p>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
