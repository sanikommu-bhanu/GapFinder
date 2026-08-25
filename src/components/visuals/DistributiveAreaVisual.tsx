"use client";

/**
 * Deterministic area-model visual for a(b + c) = ab + ac style distribution.
 * Renders a rectangle split into two labeled sub-rectangles proportional to
 * b and c so the "same multiplier hits both terms" idea is visual, not just
 * verbal.
 */
export function DistributiveAreaVisual({
  a,
  b,
  c,
  caption,
}: {
  a: number;
  b: number;
  c: number;
  caption?: string;
}) {
  const total = Math.max(b + c, 1);
  const wB = (b / total) * 220;
  const wC = (c / total) * 220;
  const h = Math.min(24 + Math.abs(a) * 8, 90);

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 260 150" className="w-full max-w-[280px]">
        <text x="18" y={30 + h / 2} textAnchor="middle" fontSize="13" fontWeight={700} fill="#151833">
          {a}
        </text>
        <rect x="30" y="20" width={wB} height={h} fill="#EDE9FD" stroke="#A78BFA" strokeWidth="2" />
        <rect x={30 + wB} y="20" width={wC} height={h} fill="#FFF6EF" stroke="#FFB27A" strokeWidth="2" />
        <text x={30 + wB / 2} y={20 + h / 2 + 4} textAnchor="middle" fontSize="11" fontWeight={700} fill="#7C4DEF">
          {a}·{b} = {a * b}
        </text>
        <text x={30 + wB + wC / 2} y={20 + h / 2 + 4} textAnchor="middle" fontSize="11" fontWeight={700} fill="#FB8A3C">
          {a}·{c} = {a * c}
        </text>
        <text x={30 + wB / 2} y="14" textAnchor="middle" fontSize="10" fill="#6B6E8A">
          {b}
        </text>
        <text x={30 + wB + wC / 2} y="14" textAnchor="middle" fontSize="10" fill="#6B6E8A">
          {c}
        </text>
      </svg>
      <p className="text-sm font-display text-navy-900">
        {a}({b} + {c}) = {a * b} + {a * c} = {a * b + a * c}
      </p>
      {caption && <p className="text-center text-xs text-ink-soft">{caption}</p>}
    </div>
  );
}
