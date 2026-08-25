import { cn } from "@/lib/cn";
import { Check, AlertTriangle, X, Circle } from "lucide-react";

type StepStatus = "valid" | "warning" | "error" | "pending";

const statusMeta: Record<StepStatus, { icon: JSX.Element; ring: string; title: string }> = {
  valid: { icon: <Check className="h-3.5 w-3.5 text-white" />, ring: "bg-success", title: "text-navy-900" },
  warning: {
    icon: <AlertTriangle className="h-3.5 w-3.5 text-white" />,
    ring: "bg-warning",
    title: "text-navy-900",
  },
  error: { icon: <X className="h-3.5 w-3.5 text-white" />, ring: "bg-danger", title: "text-danger" },
  pending: { icon: <Circle className="h-3 w-3 text-ink-faint" />, ring: "bg-surface-muted", title: "text-ink-faint" },
};

export function StepCard({
  title,
  expression,
  statement,
  status,
  highlighted,
  className,
}: {
  title: string;
  expression?: string;
  /** Short plain-language note under the expression, when there is one to make. */
  statement?: string;
  status: StepStatus;
  highlighted?: boolean;
  className?: string;
}) {
  const meta = statusMeta[status];
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl border p-3.5 transition-colors",
        highlighted
          ? "border-danger bg-danger-50 shadow-soft"
          : "border-transparent bg-surface-card shadow-card",
        className
      )}
    >
      <div className="min-w-0">
        <p className={cn("text-[11px] font-semibold uppercase tracking-wide", meta.title)}>{title}</p>
        {expression && (
          <p className="mt-0.5 truncate font-display text-base font-semibold text-navy-900">{expression}</p>
        )}
        {statement && <p className="mt-0.5 truncate text-[11px] text-ink-soft">{statement}</p>}
      </div>
      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", meta.ring)}>
        {meta.icon}
      </span>
    </div>
  );
}
