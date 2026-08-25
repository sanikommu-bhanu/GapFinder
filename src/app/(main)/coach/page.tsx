"use client";
import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { cn } from "@/lib/cn";

type Msg = { role: "user" | "coach"; text: string };

export default function CoachPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "coach", text: "Why do I keep making sign errors?" },
    {
      role: "coach",
      text: "It looks like you sometimes forget to apply the inverse operation to both sides. Let's practice a bit more.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!input.trim()) return;
    const question = input;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The coach couldn't respond.");
      setMessages((m) => [...m, { role: "coach", text: data.reply.reply }]);
    } catch (err: any) {
      setMessages((m) => [...m, { role: "coach", text: err.message }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col pb-2">
      <TopBar title="AI Coach" subtitle="Ask me anything about your learning." back={false} />
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5">
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
              m.role === "coach" ? "bg-lavender-50 text-navy-900" : "ml-auto bg-navy-900 text-white"
            )}
          >
            {m.text}
          </div>
        ))}
        {loading && <div className="max-w-[70%] rounded-2xl bg-lavender-50 px-4 py-3 text-sm text-ink-soft">Thinking…</div>}
      </div>
      <div className="flex items-center gap-2 border-t border-navy-50 px-5 py-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask anything…"
          className="h-11 flex-1 rounded-pill bg-surface-muted px-4 text-sm outline-none"
        />
        <button onClick={send} className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-900 text-white">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
