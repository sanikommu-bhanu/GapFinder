"use client";

/**
 * The GapFinder mark: an iridescent woven ribbon.
 *
 * Five thin loops set at different angles around one centre, sharing a
 * lavender → pink → peach gradient so the strands read as a single band folded
 * through itself. Pure SVG — crisp at any size, nothing to download.
 */

/** angle, radiusX, radiusY, stroke width, gradient, opacity */
const STRANDS: [number, number, number, number, string, number][] = [
  [-22, 86, 50, 11, "gf-band-1", 0.95],
  [34, 84, 46, 10, "gf-band-2", 0.92],
  [88, 80, 44, 10, "gf-band-3", 0.85],
  [128, 76, 40, 9, "gf-band-2", 0.8],
  [-64, 70, 34, 8, "gf-band-1", 0.7],
];

export function GapFinderMark({ size = 240, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size * 0.86}
      viewBox="0 0 240 208"
      fill="none"
      className={className}
      role="img"
      aria-label="GapFinder"
    >
      <defs>
        <linearGradient id="gf-band-1" x1="4%" y1="12%" x2="96%" y2="88%">
          <stop offset="0%" stopColor="#AC93F6" />
          <stop offset="40%" stopColor="#C9A6EF" />
          <stop offset="72%" stopColor="#F3A6C1" />
          <stop offset="100%" stopColor="#FFB176" />
        </linearGradient>
        <linearGradient id="gf-band-2" x1="94%" y1="6%" x2="10%" y2="94%">
          <stop offset="0%" stopColor="#FFC189" />
          <stop offset="36%" stopColor="#F6ACC3" />
          <stop offset="74%" stopColor="#C2B1F8" />
          <stop offset="100%" stopColor="#9C82F7" />
        </linearGradient>
        <linearGradient id="gf-band-3" x1="8%" y1="90%" x2="92%" y2="10%">
          <stop offset="0%" stopColor="#D3C4FB" />
          <stop offset="48%" stopColor="#F8BFD1" />
          <stop offset="100%" stopColor="#FFD2AC" />
        </linearGradient>
        <radialGradient id="gf-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F0E8FF" stopOpacity="0.9" />
          <stop offset="58%" stopColor="#FFE8DA" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* The mark sits in light rather than on top of it. */}
      <ellipse cx="120" cy="104" rx="118" ry="102" fill="url(#gf-halo)" />

      <g fill="none" strokeLinecap="round">
        {STRANDS.map(([angle, rx, ry, width, grad, opacity], i) => (
          <g key={i} transform={`rotate(${angle} 120 104)`}>
            <ellipse
              cx="120"
              cy="104"
              rx={rx}
              ry={ry}
              stroke={`url(#${grad})`}
              strokeWidth={width}
              opacity={opacity}
            />
            {/* A hairline of white along each band gives the ribbon its sheen. */}
            <ellipse
              cx="120"
              cy="104"
              rx={rx}
              ry={ry}
              stroke="#FFFFFF"
              strokeWidth={1.4}
              opacity={0.34}
            />
          </g>
        ))}
      </g>
    </svg>
  );
}
