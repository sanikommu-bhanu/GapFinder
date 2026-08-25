"use client";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

/**
 * The complete correct path, written out one line at a time.
 *
 * Knowing where you went wrong isn't the same as knowing how it should have
 * gone, so the audit ends by showing the whole solution — written the way a
 * tutor would write it on a board, a line at a time, rather than dropped in
 * as a finished block the student's eye slides off.
 *
 * Every line here is derived algebraically from the student's own opening
 * equation. None of it is generated text.
 */
export function CorrectedSolution({
  lines,
  divergenceExpression,
  className,
}: {
  lines: string[];
  /** The student's wrong line, so we can mark where the paths separated. */
  divergenceExpression?: string;
  className?: string;
}) {
  const [written, setWritten] = useState(0);

  useEffect(() => {
    if (lines.length === 0) return;
    const reduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setWritten(lines.length);
      return;
    }
    if (written >= lines.length) return;
    const timer = setTimeout(() => setWritten((n) => n + 1), written === 0 ? 200 : 420);
    return () => clearTimeout(timer);
  }, [lines.length, written]);

  if (lines.length === 0) return null;

  return (
    <Card className={cn("border border-success-50", className)}>
      <div className="flex items-center gap-1.5">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success">
          <Check className="h-2.5 w-2.5 text-white" />
        </span>
        <p className="text-xs font-semibold text-success">How it should have gone</p>
      </div>

      <ol className="mt-3 flex flex-col gap-2">
        {lines.map((line, i) => {
          const isDivergencePoint =
            divergenceExpression !== undefined &&
            i === 1 &&
            line.replace(/\s/g, "") !== divergenceExpression.replace(/\s/g, "");
          return (
            <li
              key={`${line}-${i}`}
              className={cn(
                "flex items-center gap-2.5 transition-all duration-300",
                i < written ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
              )}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[10px] font-bold text-ink-soft">
                {i + 1}
              </span>
              <p
                className={cn(
                  "min-w-0 flex-1 break-words font-display text-base leading-snug",
                  isDivergencePoint ? "font-bold text-success" : "text-navy-900"
                )}
              >
                {line}
              </p>
              {isDivergencePoint && (
                <span className="shrink-0 rounded-pill bg-success-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-success">
                  Your turn-off
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-[10px] leading-relaxed text-ink-faint">
        Derived from your own first line by algebra — not generated.
      </p>
    </Card>
  );
}
