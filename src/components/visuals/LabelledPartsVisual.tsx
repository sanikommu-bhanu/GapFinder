"use client";

/**
 * A subject and its named parts, each with the job it does.
 *
 * The shape most "what is X made of" questions want: an organ and its
 * structures, a device and its components, an atom and its particles. A
 * photograph would be prettier and would teach less — what a student needs is
 * the part paired with its function, which is exactly what gets examined.
 *
 * Parts and roles are supplied as text; the layout and the connectors are
 * drawn here.
 */
export function LabelledPartsVisual({
  subject,
  parts,
  caption,
}: {
  subject: string;
  parts: { name: string; role: string }[];
  caption?: string;
}) {
  const items = parts.filter((p) => p.name).slice(0, 6);
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-2xl bg-navy-900 px-3.5 py-2.5">
        <span className="flex h-2 w-2 shrink-0 rounded-full bg-peach-500" />
        <p className="font-display text-sm font-bold text-on-strong">{subject}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        {items.map((part, i) => (
          <div key={part.name} className="flex gap-2">
            {/* A spine down the left, joining each part back to the subject. */}
            <div className="flex w-4 shrink-0 flex-col items-center" aria-hidden="true">
              <span className="h-3 w-px bg-navy-50" />
              <span className="h-2 w-2 rounded-full border-2 border-lavender-500 bg-surface" />
              {i < items.length - 1 && <span className="w-px flex-1 bg-navy-50" />}
            </div>
            <div className="flex-1 rounded-2xl bg-surface-muted p-2.5">
              <p className="text-[12px] font-semibold text-navy-900">{part.name}</p>
              {part.role && <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">{part.role}</p>}
            </div>
          </div>
        ))}
      </div>

      {caption && <p className="text-center text-xs leading-relaxed text-ink-soft">{caption}</p>}
    </div>
  );
}
