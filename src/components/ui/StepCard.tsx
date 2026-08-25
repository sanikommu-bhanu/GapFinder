import { cn } from "@/lib/cn";
import { Check, AlertTriangle, X, Circle } from "lucide-react";

type StepStatus = "valid" | "warning" | "error" | "pending";

const statusMeta: Record<StepStatus, { icon: JSX.Element; ring: string; text: string }> = {
  valid: { icon: <Check className="h-4 w-4 text-white" />, ring: "bg-success", text: "text-navy-900" },
  warning: { icon: <AlertTriangle className="h-4 w-4 text-white" />, ring: "bg-warning", text: "text-navy-900" },
  error: { icon: <X className="h-4 w-4 text-white" />, ring: "bg-danger", text: "text-danger" },
  pending: { icon: <Circle className="h-3 w-3 text-ink-faint" />, ring: "bg-surface-muted", text: "text-ink-faint" },
};

export function StepCard({
  title,
  expression,
  status,
  highlighted,
  className,
}: {
  title: string;
  expression?: string;
  status: StepStatus;
  highlighted?: boolean;
  className?: string;
}) {
  const meta = statusMeta[status];
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-2xl border p-3.5",
        highlighted ? "border-danger bg-danger-50" : "border-transparent bg-surface-card shadow-card",
        className
      )}
    >
      <div>
        <p className={cn("text-sm font-semibold", meta.text)}>{title}</p>
        {expression && <p className="font-display text-sm text-ink-soft mt-0.5">{expression}</p>}
      </div>
      <span className={cn("flex h-6 w-6 items-center justify-center rounded-full", meta.ring)}>{meta.icon}</span>
    </div>
  );
}
