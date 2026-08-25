"use client";
import { cn } from "@/lib/cn";

export function ProgressRing({
  value,
  size = 120,
  strokeWidth = 10,
  label,
  sublabel,
  className,
  colorFrom = "#C3B4F7",
  colorTo = "#FFB27A",
}: {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  className?: string;
  colorFrom?: string;
  colorTo?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;
  const gradId = `pr-grad-${colorFrom.replace("#", "")}-${colorTo.replace("#", "")}`;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorFrom} />
            <stop offset="100%" stopColor={colorTo} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#EDEEF5" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-bold text-navy-900">{label ?? `${value}%`}</span>
        {sublabel && <span className="text-xs text-ink-soft">{sublabel}</span>}
      </div>
    </div>
  );
}
