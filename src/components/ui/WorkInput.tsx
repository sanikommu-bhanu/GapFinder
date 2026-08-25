"use client";
import { Mic, Square } from "lucide-react";
import { useSpeechInput } from "@/hooks/useSpeechInput";
import { cn } from "@/lib/cn";

/**
 * The shared writing surface for practice, transfer and teach-back.
 *
 * It keeps the keyboard from covering the submit button on a phone (the field
 * scrolls itself into view on focus), and offers voice where the browser
 * supports it — appending to what's already typed rather than replacing it, so
 * a student can mix the two.
 */
export function WorkInput({
  value,
  onChange,
  placeholder,
  rows = 6,
  voice = false,
  label,
  errorLine,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  /** Enables the microphone control where the browser can do speech input. */
  voice?: boolean;
  label: string;
  /** 1-based line to mark as the first thing that went wrong, if any. */
  errorLine?: number | null;
  className?: string;
}) {
  const speech = useSpeechInput({
    onTranscript: (text) => onChange(value ? `${value.trimEnd()} ${text}` : text),
  });

  return (
    <div className={className}>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => {
            // On a phone the on-screen keyboard covers the lower half of the
            // viewport; nudging the field into view keeps it above the fold.
            setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 250);
          }}
          rows={rows}
          aria-label={label}
          placeholder={placeholder}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className={cn(
            "w-full resize-none rounded-2xl border bg-surface-muted p-4 font-display text-base leading-relaxed text-navy-900 outline-none transition-colors placeholder:font-body placeholder:text-sm placeholder:text-ink-faint focus:border-lavender-400 focus:bg-white",
            errorLine ? "border-danger" : "border-navy-50",
            voice && speech.supported && "pb-14"
          )}
        />

        {voice && speech.supported && (
          <button
            type="button"
            onClick={speech.toggle}
            aria-label={speech.listening ? "Stop recording" : "Speak your explanation"}
            aria-pressed={speech.listening}
            className={cn(
              "absolute bottom-3 left-3 flex h-10 items-center gap-2 rounded-pill px-4 text-xs font-semibold transition-colors",
              speech.listening ? "bg-danger text-white" : "bg-navy-900 text-white"
            )}
          >
            {speech.listening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            {speech.listening ? "Stop" : "Speak"}
          </button>
        )}

        {speech.listening && (
          <span className="absolute bottom-6 left-28 flex items-center gap-1" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="w-0.5 animate-pulse rounded-pill bg-danger"
                style={{ height: `${6 + ((i * 7) % 14)}px`, animationDelay: `${i * 110}ms` }}
              />
            ))}
          </span>
        )}
      </div>

      {speech.error && <p className="mt-2 text-xs text-danger">{speech.error}</p>}
      {voice && !speech.supported && (
        <p className="mt-2 text-[11px] text-ink-faint">
          Voice input isn&apos;t available in this browser — typing works just as well.
        </p>
      )}
    </div>
  );
}
