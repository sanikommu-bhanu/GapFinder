"use client";

/**
 * Deterministic coordinate-plane visual.
 *
 * Plots points that were already computed elsewhere, and — when asked — joins
 * them in order. The axis labels matter more than they look: an unlabelled line
 * through the origin can be made to mean anything, so a physics relationship
 * drawn without saying what is on each axis would be decoration rather than a
 * diagram. Nothing here calculates a value; it only draws the ones it is given.
 */
export function CoordinatePlaneVisual({
  points,
  range = 6,
  connect = false,
  xLabel,
  yLabel,
  equation,
  caption,
}: {
  points: { x: number; y: number; label?: string; color?: string }[];
  range?: number;
  connect?: boolean;
  xLabel?: string;
  yLabel?: string;
  equation?: string;
  caption?: string;
}) {
  const size = 220;
  const scale = size / (range * 2);
  const cx = (x: number) => size / 2 + x * scale;
  const cy = (y: number) => size / 2 - y * scale;

  const path = points.map((p) => `${cx(p.x)},${cy(p.y)}`).join(" ");

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[240px]" role="img">
        {/* Gridlines at every unit, so a gradient can actually be read off. */}
        {Array.from({ length: range * 2 + 1 }, (_, i) => i - range).map((n) => (
          <g key={n}>
            <line x1={cx(n)} y1="0" x2={cx(n)} y2={size} stroke="#EEF0F8" strokeWidth="1" />
            <line x1="0" y1={cy(n)} x2={size} y2={cy(n)} stroke="#EEF0F8" strokeWidth="1" />
          </g>
        ))}

        <line x1="0" y1={size / 2} x2={size} y2={size / 2} stroke="#D3D5E6" strokeWidth="1.5" />
        <line x1={size / 2} y1="0" x2={size / 2} y2={size} stroke="#D3D5E6" strokeWidth="1.5" />

        {connect && points.length > 1 && (
          <polyline points={path} fill="none" stroke="#8B5CF6" strokeWidth="2.5" strokeLinejoin="round" />
        )}

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

      {(xLabel || yLabel || equation) && (
        <div className="flex flex-col items-center gap-0.5">
          {equation && <p className="font-display text-[13px] font-bold text-navy-900">{equation}</p>}
          {(xLabel || yLabel) && (
            <p className="text-[10px] text-ink-faint">
              {yLabel && <span className="font-medium">{yLabel}</span>}
              {yLabel && xLabel && " against "}
              {xLabel && <span className="font-medium">{xLabel}</span>}
            </p>
          )}
        </div>
      )}

      {caption && <p className="text-center text-xs leading-relaxed text-ink-soft">{caption}</p>}
    </div>
  );
}
