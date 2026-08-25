"use client";

/** Deterministic fraction bar model: shaded numerator segments out of denominator total. */
export function FractionModelVisual({
  numerator,
  denominator,
  label,
  caption,
}: {
  numerator: number;
  denominator: number;
  label?: string;
  caption?: string;
}) {
  const segs = Math.max(1, Math.min(denominator, 12));
  const w = 260 / segs;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 260 60" className="w-full max-w-[280px]">
        {Array.from({ length: segs }, (_, i) => (
          <rect
            key={i}
            x={i * w + 1}
            y="10"
            width={w - 2}
            height="30"
            fill={i < numerator ? "#A78BFA" : "#EDE9FD"}
            stroke="#8B5CF6"
            strokeWidth="1.5"
            rx="3"
          />
        ))}
      </svg>
      <p className="text-sm font-display text-navy-900">
        {label ?? `${numerator}/${denominator}`}
      </p>
      {caption && <p className="text-center text-xs text-ink-soft">{caption}</p>}
    </div>
  );
}
