"use client";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowDown } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { cn } from "@/lib/cn";

type Step = {
  order: number;
  expression: string;
  correctedExpression: string | null;
  verificationNote: string | null;
};

/**
 * The moment the product exists for.
 *
 * The student's line and the line it should have been are put side by side, in
 * that order, at the same size — so the single changed character is the only
 * difference the eye has to find. Everything arrives in sequence rather than
 * at once: the step they wrote, then the correction, then why it matters.
 *
 * The restraint is deliberate. Nothing here decorates; the animation exists
 * only to control the order in which the comparison is read.
 */
export function FirstGapReveal({
  step,
  previousExpression,
  conceptName,
  confidence,
  imageUrl,
  downstreamCount,
  onBack,
  onContinue,
}: {
  step: Step;
  previousExpression: string | null;
  conceptName: string | null;
  confidence: "high" | "medium" | "low" | null;
  imageUrl: string | null;
  downstreamCount: number;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setPhase(4);
      return;
    }
    const timers = [
      setTimeout(() => setPhase(1), 80),
      setTimeout(() => setPhase(2), 620),
      setTimeout(() => setPhase(3), 1120),
      setTimeout(() => setPhase(4), 1520),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="pb-8">
      <TopBar title="First Gap Found" onBack={onBack} />

      <div className="px-5">
        {previousExpression && (
          <div className={cn("transition-opacity duration-500", phase >= 1 ? "opacity-100" : "opacity-0")}>
            <Card className="bg-surface-muted shadow-none">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-success">
                Correct up to here
              </p>
              <p className="mt-0.5 font-display text-base text-ink-soft">{previousExpression}</p>
            </Card>
            <div className="flex justify-center py-1.5">
              <ArrowDown className="h-4 w-4 text-ink-faint" />
            </div>
          </div>
        )}

        {/* What they wrote. */}
        <div
          className={cn(
            "transition-all duration-500",
            phase >= 1 ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          )}
        >
          <Card className="border-2 border-danger bg-white">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-danger">
                Step {step.order} · You wrote
              </p>
              {confidence && <ConfidenceBadge level={confidence} />}
            </div>
            <p className="mt-1.5 font-display text-[26px] font-bold leading-tight text-navy-900">
              {step.expression}
            </p>
          </Card>
        </div>

        {/* What it should have been. */}
        {step.correctedExpression ? (
          <div
            className={cn(
              "transition-all duration-500",
              phase >= 2 ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
            )}
          >
            <div className="flex justify-center py-1.5">
              <ArrowDown className="h-4 w-4 text-ink-faint" />
            </div>
            <Card className="border-2 border-success bg-success-50">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-success">But it should be</p>
              <p className="mt-1.5 font-display text-[26px] font-bold leading-tight text-navy-900">
                {step.correctedExpression}
              </p>
            </Card>
          </div>
        ) : (
          <div className={cn("transition-opacity duration-500", phase >= 2 ? "opacity-100" : "opacity-0")}>
            <Card className="mt-3 bg-surface-muted shadow-none">
              <p className="text-xs font-semibold text-ink-soft">Why this step fails</p>
              <p className="mt-1 text-sm text-navy-900">{step.verificationNote}</p>
            </Card>
          </div>
        )}

        {/* What it means. */}
        <div
          className={cn(
            "transition-all duration-500",
            phase >= 3 ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          )}
        >
          {conceptName && (
            <Card className="mt-3 bg-lavender-50 shadow-none">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-lavender-600">
                The concept underneath
              </p>
              <p className="mt-0.5 text-sm font-semibold text-navy-900">{conceptName}</p>
            </Card>
          )}

          <p className="mt-3 px-1 text-[11px] leading-relaxed text-ink-faint">
            Verified algebraically — the two lines have different solutions, so this step cannot follow from the one
            above it.
            {downstreamCount > 0 &&
              ` Everything after it was worked correctly, from here. That's ${downstreamCount} step${downstreamCount === 1 ? "" : "s"} you don't need to relearn.`}
          </p>

          {imageUrl && (
            <Card className="mt-3 overflow-hidden p-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Your original work" className="max-h-36 w-full object-contain" />
            </Card>
          )}
        </div>

        <div
          className={cn(
            "transition-opacity duration-300",
            phase >= 4 ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          <Button className="mt-5 w-full" onClick={onContinue}>
            See the full audit <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
