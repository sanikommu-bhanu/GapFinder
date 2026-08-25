"use client";
import { Crosshair, Check, X, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export interface Prediction {
  code: string;
  name: string;
  studentRule: string;
  likelihood: number;
  occurrences: number;
  because: string;
}

/**
 * The prediction, stated before the student writes anything.
 *
 * Naming the expected mistake up front does two things at once. It puts the
 * student's own pattern in front of them as a fact with a count attached, and
 * it commits GapFinder to a claim that can be checked in the next thirty
 * seconds. A diagnosis made after the fact is easy; one made beforehand and
 * then verified is evidence.
 *
 * The framing matters: this is a pattern in the work, not a statement about the
 * student. It says what the record shows and how often, and it explicitly
 * invites them to prove it wrong — because that outcome is the good one.
 */
export function PredictionCard({ prediction, className }: { prediction: Prediction; className?: string }) {
  return (
    <Card className={cn("border border-peach-200 bg-gradient-peach shadow-none", className)}>
      <div className="flex items-center gap-1.5">
        <Crosshair className="h-3.5 w-3.5 text-peach-500" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-navy-900">
          We&apos;re watching for one thing
        </p>
      </div>

      <p className="mt-2 text-sm font-semibold text-navy-900">{prediction.name}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-navy-900/80">
        &ldquo;{prediction.studentRule}&rdquo;
      </p>

      <div className="mt-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-white/60">
          <div
            className="h-full rounded-pill bg-navy-900/70"
            style={{ width: `${Math.max(6, prediction.likelihood)}%` }}
          />
        </div>
        <p className="shrink-0 text-[11px] font-semibold tabular-nums text-navy-900">
          {prediction.likelihood}%
        </p>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-navy-900/70">{prediction.because}</p>

      <p className="mt-2.5 text-[11px] font-medium text-navy-900">Prove us wrong.</p>
    </Card>
  );
}

/**
 * The result of that claim, shown after the attempt.
 *
 * "Broke the pattern" is the headline outcome and gets the emphasis, because a
 * prediction that fails is the only hard evidence a learning tool can offer
 * that something actually changed.
 */
export function PredictionOutcome({
  outcome,
  message,
  predictionName,
  className,
}: {
  outcome: "broke-pattern" | "repeated" | "different-slip" | "none";
  message: string;
  predictionName: string;
  className?: string;
}) {
  if (outcome === "none") return null;

  const broke = outcome === "broke-pattern";

  return (
    <Card
      className={cn(
        "border",
        broke ? "border-success bg-success-50" : "border-warning-50 bg-warning-50/60",
        "shadow-none",
        className
      )}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full",
            broke ? "bg-success" : "bg-warning"
          )}
        >
          {broke ? <Check className="h-3 w-3 text-white" /> : <X className="h-3 w-3 text-white" />}
        </span>
        <p
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wider",
            broke ? "text-success" : "text-warning"
          )}
        >
          {broke ? "Pattern broken" : outcome === "repeated" ? "It happened again" : "A different slip"}
        </p>
      </div>

      {broke && (
        <div className="mt-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-success" />
          <p className="text-sm font-semibold text-navy-900">
            You didn&apos;t make it this time.
          </p>
        </div>
      )}

      <p className="mt-1.5 text-[12px] leading-relaxed text-navy-900">{message}</p>

      <p className="mt-2 text-[10px] uppercase tracking-wide text-ink-faint">
        Predicted before you started: {predictionName}
      </p>
    </Card>
  );
}
