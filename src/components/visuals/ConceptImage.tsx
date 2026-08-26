"use client";
import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * The generated illustration, loaded after everything else is already on screen.
 *
 * Three states, and only two of them are visible. While it loads there is a
 * quiet placeholder; when it arrives it fades in; when there is no image — the
 * provider was Groq, or Gemini was rate-limited — this renders nothing at all
 * and the diagram beside it carries the screen on its own.
 */
export function ConceptImage({
  topic,
  subject,
  className,
}: {
  topic: string;
  subject: string;
  className?: string;
}) {
  const [state, setState] = useState<"loading" | "ready" | "absent">("loading");
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    setState("loading");
    setSrc(null);

    fetch(`/api/concept-image?topic=${encodeURIComponent(topic)}&subject=${encodeURIComponent(subject)}`)
      .then(async (res) => {
        // 204 is the honest "no picture this time".
        if (!res.ok || res.status === 204) throw new Error("no image");
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("absent");
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [topic, subject]);

  if (state === "absent") return null;

  return (
    <figure className={cn("flex flex-col gap-1.5", className)}>
      <div className="relative overflow-hidden rounded-card bg-surface-muted">
        {state === "loading" ? (
          <div className="flex aspect-[4/3] items-center justify-center gap-2">
            <ImageIcon className="h-4 w-4 text-ink-faint" />
            <p className="text-[11px] text-ink-faint">Drawing an illustration…</p>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src ?? ""}
            alt={`Illustration of ${topic}`}
            className="w-full animate-fade-up object-cover"
          />
        )}
      </div>
      {state === "ready" && (
        <figcaption className="px-1 text-[10px] leading-relaxed text-ink-faint">
          AI-generated illustration. Wordless on purpose — the labelled diagram above carries the facts.
        </figcaption>
      )}
    </figure>
  );
}
