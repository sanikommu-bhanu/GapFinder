import { cn } from "@/lib/cn";

const map: Record<string, string> = {
  high: "bg-success-50 text-success",
  medium: "bg-warning-50 text-warning",
  low: "bg-danger-50 text-danger",
};

export function ConfidenceBadge({ level, className }: { level: "high" | "medium" | "low"; className?: string }) {
  return (
    <span className={cn("rounded-pill px-2.5 py-1 text-xs font-semibold capitalize", map[level], className)}>
      {level} confidence
    </span>
  );
}
