import { cn } from "@/lib/cn";
import { Check, AlertTriangle, X, HelpCircle, Circle } from "lucide-react";

/**
 * The five verdicts of the Complete Solution Audit, plus a pending state.
 *
 * Showing four equal-looking red crosses would bury the one step the student
 * actually needs to fix. So the first divergence is the only thing that reads
 * as an error; everything it caused reads as a consequence, and a genuinely
 * separate mistake reads differently again.
 */
export type StepVerdict =
  | "correct"
  | "first_divergence"
  | "downstream_consequence"
  | "independent_error"
  | "uncertain"
  | "pending";

const VERDICT_META: Record<
  StepVerdict,
  { icon: JSX.Element; badge: string; label: string | null; title: string }
> = {
  correct: {
    icon: <Check className="h-3.5 w-3.5 text-white" />,
    badge: "bg-success",
    label: null,
    title: "text-ink-soft",
  },
  first_divergence: {
    icon: <X className="h-3.5 w-3.5 text-white" />,
    badge: "bg-danger",
    label: "First divergence",
    title: "text-danger",
  },
  downstream_consequence: {
    icon: <AlertTriangle className="h-3.5 w-3.5 text-white" />,
    badge: "bg-warning",
    label: "Carried from above",
    title: "text-warning",
  },
  independent_error: {
    icon: <X className="h-3.5 w-3.5 text-white" />,
    badge: "bg-danger",
    label: "Separate mistake",
    title: "text-danger",
  },
  uncertain: {
    icon: <HelpCircle className="h-3.5 w-3.5 text-white" />,
    badge: "bg-ink-faint",
    label: "Couldn't check",
    title: "text-ink-faint",
  },
  pending: {
    icon: <Circle className="h-3 w-3 text-ink-faint" />,
    badge: "bg-surface-muted",
    label: null,
    title: "text-ink-faint",
  },
};

export function StepCard({
  title,
  expression,
  statement,
  verdict,
  highlighted,
  dimmed,
  className,
}: {
  title: string;
  expression?: string;
  /** Short plain-language note under the expression, when there is one to make. */
  statement?: string;
  verdict: StepVerdict;
  highlighted?: boolean;
  /** Pulls a step back so the divergence can hold the eye. */
  dimmed?: boolean;
  className?: string;
}) {
  const meta = VERDICT_META[verdict];

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl border p-3.5 transition-all duration-500",
        highlighted
          ? "scale-[1.02] border-danger bg-danger-50 shadow-soft"
          : "border-transparent bg-surface-card shadow-card",
        verdict === "downstream_consequence" && !highlighted && "border-warning-50 bg-warning-50/40",
        dimmed && "opacity-45 saturate-50",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className={cn("text-[11px] font-semibold uppercase tracking-wide", meta.title)}>{title}</p>
          {meta.label && (
            <span
              className={cn(
                "rounded-pill px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                verdict === "downstream_consequence"
                  ? "bg-warning-50 text-warning"
                  : verdict === "uncertain"
                    ? "bg-surface-muted text-ink-faint"
                    : "bg-danger text-white"
              )}
            >
              {meta.label}
            </span>
          )}
        </div>
        {/* Expressions wrap rather than truncate: a student has to be able to
            read their own equation, and long ones are exactly the interesting
            ones. */}
        {expression && (
          <p
            className={cn(
              "mt-0.5 break-words font-display font-semibold leading-snug text-navy-900",
              highlighted ? "text-lg" : "text-base"
            )}
          >
            {expression}
          </p>
        )}
        {statement && <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">{statement}</p>}
      </div>
      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", meta.badge)}>
        {meta.icon}
      </span>
    </div>
  );
}
