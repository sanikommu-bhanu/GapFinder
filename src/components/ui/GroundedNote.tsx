"use client";
import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Shows what an explanation was actually grounded in.
 *
 * Every explanation in GapFinder is generated against retrieved knowledge
 * chunks, and this is where that stops being an implementation detail: a
 * student (or a judge) can see how many curated sources fed the answer and
 * read them. If retrieval returned nothing, this renders nothing rather than
 * implying a grounding that did not happen.
 */
export function GroundedNote({ chunkIds, className }: { chunkIds: string[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<{ id: string; title: string; content: string; kind: string }[] | null>(null);
  const [loading, setLoading] = useState(false);

  if (!chunkIds.length) return null;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !sources && !loading) {
      setLoading(true);
      try {
        const res = await fetch(`/api/knowledge?ids=${encodeURIComponent(chunkIds.join(","))}`);
        const data = await res.json();
        setSources(data.chunks ?? []);
      } catch {
        setSources([]);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className={cn("rounded-2xl bg-surface-muted p-3", className)}>
      <button onClick={toggle} className="flex w-full items-center gap-2 text-left" aria-expanded={open}>
        <BookOpen className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
        <span className="flex-1 text-[11px] font-medium text-ink-soft">
          Grounded in {chunkIds.length} source{chunkIds.length === 1 ? "" : "s"} from your knowledge base
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-ink-faint transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-2.5 flex flex-col gap-2 border-t border-navy-50 pt-2.5">
          {loading && <p className="text-[11px] text-ink-faint">Loading sources…</p>}
          {sources?.length === 0 && !loading && (
            <p className="text-[11px] text-ink-faint">These sources are no longer available.</p>
          )}
          {sources?.map((s) => (
            <div key={s.id}>
              <p className="text-[11px] font-semibold text-navy-900">{s.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">{s.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
