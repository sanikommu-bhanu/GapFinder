"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Sparkles } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { GroundedNote } from "@/components/ui/GroundedNote";
import { cn } from "@/lib/cn";

type Msg = {
  role: "user" | "coach";
  text: string;
  chunkIds?: string[];
  offline?: boolean;
  failed?: boolean;
};

const STARTERS = [
  "Why do I keep making sign errors?",
  "What should I work on next?",
  "Explain inverse operations simply",
];

export default function CoachPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "The coach couldn't respond.");
      setMessages((m) => [
        ...m,
        {
          role: "coach",
          text: data.reply.reply,
          chunkIds: data.reply.groundedInChunkIds ?? [],
          offline: data.reply.offline === true,
        },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "coach",
          text: err instanceof Error ? err.message : "The coach couldn't respond.",
          failed: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full min-h-dvh flex-col">
      <TopBar title="AI Coach" />

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 pb-2 scrollbar-none">
        {messages.length === 0 && (
          <div className="pt-2">
            <div className="flex flex-col items-center py-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lavender-50">
                <Sparkles className="h-6 w-6 text-lavender-600" />
              </span>
              <p className="mt-4 font-display text-base font-bold text-navy-900">Ask about your own learning</p>
              <p className="mt-1.5 max-w-[17rem] text-[13px] leading-relaxed text-ink-soft">
                The coach can see which concepts you keep slipping on, and answers from your curated knowledge base —
                so it talks about your work, not in general.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="min-h-[44px] rounded-2xl border border-navy-50 bg-white px-4 py-3 text-left text-sm text-navy-900 shadow-card transition-colors active:bg-surface-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                m.role === "coach"
                  ? m.failed
                    ? "bg-danger-50 text-danger"
                    : "bg-lavender-50 text-navy-900"
                  : "bg-navy-900 text-on-strong"
              )}
            >
              {m.text}
            </div>
            {m.role === "coach" && !m.failed && (
              <div className="mt-1.5 max-w-[85%]">
                {m.offline && (
                  <p className="mb-1 text-[10px] font-medium text-ink-faint">
                    Answered from your knowledge base — live AI is unavailable right now.
                  </p>
                )}
                <GroundedNote chunkIds={m.chunkIds ?? []} />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex max-w-[70%] items-center gap-1.5 rounded-2xl bg-lavender-50 px-4 py-3.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-lavender-400"
                style={{ animationDelay: `${i * 160}ms` }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 flex items-center gap-2 border-t border-navy-50 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          aria-label="Ask the coach a question"
          placeholder="Ask anything…"
          className="h-11 min-w-0 flex-1 rounded-pill bg-surface-muted px-4 text-sm outline-none focus:ring-2 focus:ring-lavender-200"
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading}
          aria-label="Send"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy-900 text-on-strong transition-opacity disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
