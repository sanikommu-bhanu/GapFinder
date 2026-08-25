"use client";

/** Deterministic coordinate-plane visual, plots a small list of already-computed points. */
export function CoordinatePlaneVisual({
  points,
  range = 6,
  caption,
}: {
  points: { x: number; y: number; label?: string; color?: string }[];
  range?: number;
  caption?: string;
}) {
  const size = 220;
  const scale = size / (range * 2);
  const cx = (x: number) => size / 2 + x * scale;
  const cy = (y: number) => size / 2 - y * scale;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[240px]">
        <line x1="0" y1={size / 2} x2={size} y2={size / 2} stroke="#D3D5E6" strokeWidth="1.5" />
        <line x1={size / 2} y1="0" x2={size / 2} y2={size} stroke="#D3D5E6" strokeWidth="1.5" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={cx(p.x)} cy={cy(p.y)} r="4.5" fill={p.color ?? "#8B5CF6"} />
            {p.label && (
              <text x={cx(p.x) + 7} y={cy(p.y) - 6} fontSize="10" fontWeight={700} fill="#151833">
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      {caption && <p className="text-center text-xs text-ink-soft">{caption}</p>}
    </div>
  );
}
