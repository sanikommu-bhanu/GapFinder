"use client";

/**
 * Deterministic number-line visual. Shows a start value and a jump of a
 * given size/direction — used for sign-handling / inverse-operation gaps
 * where "moved the wrong way" is the misconception.
 */
export function NumberLineVisual({
  from,
  to,
  min,
  max,
  caption,
}: {
  from: number;
  to: number;
  min?: number;
  max?: number;
  caption?: string;
}) {
  const lo = min ?? Math.min(from, to) - 3;
  const hi = max ?? Math.max(from, to) + 3;
  const span = hi - lo;
  const x = (v: number) => 10 + ((v - lo) / span) * 280;
  const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

  return (
    <div className="flex flex-col gap-2">
      <svg viewBox="0 0 300 70" className="w-full">
        <line x1="10" y1="40" x2="290" y2="40" stroke="#D3D5E6" strokeWidth="2" />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} y1="34" x2={x(t)} y2="46" stroke="#A0A3BD" strokeWidth={t === 0 ? 2 : 1} />
            {(t % Math.max(1, Math.round(span / 10)) === 0 || t === 0) && (
              <text x={x(t)} y="60" textAnchor="middle" fontSize="9" fill="#6B6E8A">
                {t}
              </text>
            )}
          </g>
        ))}
        {/* arc showing the jump */}
        <path
          d={`M ${x(from)} 34 Q ${(x(from) + x(to)) / 2} ${from === to ? 34 : 10} ${x(to)} 34`}
          fill="none"
          stroke="#FB8A3C"
          strokeWidth="2"
          markerEnd="url(#arrow)"
        />
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#FB8A3C" />
          </marker>
        </defs>
        <circle cx={x(from)} cy="40" r="4" fill="#8B5CF6" />
        <circle cx={x(to)} cy="40" r="4" fill="#2FBF71" />
        <text x={x(from)} y="26" textAnchor="middle" fontSize="10" fontWeight={700} fill="#8B5CF6">
          {from}
        </text>
        <text x={x(to)} y="26" textAnchor="middle" fontSize="10" fontWeight={700} fill="#2FBF71">
          {to}
        </text>
      </svg>
      {caption && <p className="text-center text-xs text-ink-soft">{caption}</p>}
    </div>
  );
}
