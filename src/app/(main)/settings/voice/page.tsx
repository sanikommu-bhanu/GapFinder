"use client";
import { useEffect, useState } from "react";
import { Mic, Volume2, CheckCircle2, XCircle } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useSpeechInput } from "@/hooks/useSpeechInput";
import { cn } from "@/lib/cn";

const SPEEDS = [0.75, 1, 1.25, 1.5];

/**
 * Voice settings that tell the truth about what this browser can do.
 *
 * Speech recognition is not available everywhere, and a toggle that silently
 * does nothing is worse than no toggle. Support is detected and stated, and the
 * student can test the microphone here rather than discovering it fails
 * mid-explanation.
 */
export default function VoiceSettingsPage() {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceSpeed, setVoiceSpeed] = useState(1);
  const [heard, setHeard] = useState<string | null>(null);

  const speech = useSpeechInput({ onTranscript: (text) => setHeard(text) });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setVoiceEnabled(d?.settings?.voiceEnabled ?? true);
        setVoiceSpeed(d?.settings?.voiceSpeed ?? 1);
      })
      .catch(() => {});
  }, []);

  function save(patch: Record<string, unknown>) {
    void fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {});
  }

  return (
    <div className="pb-8">
      <TopBar title="Voice" />
      <div className="px-5">
        <Card className="flex items-start gap-3">
          {speech.supported ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-navy-900">
              {speech.supported ? "Voice input is available" : "Voice input isn't available here"}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">
              {speech.supported
                ? "You can speak your teach-back explanations instead of typing them."
                : "This browser doesn't support speech recognition. Everything still works by typing — nothing is locked behind voice."}
            </p>
          </div>
        </Card>

        {speech.supported && (
          <>
            <Card className="mt-3 flex items-center gap-3 py-3">
              <Mic className="h-4 w-4 shrink-0 text-ink-faint" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-navy-900">Offer voice input</p>
                <p className="text-[11px] text-ink-soft">Shows a microphone on explanation screens</p>
              </div>
              <button
                role="switch"
                aria-checked={voiceEnabled}
                aria-label="Offer voice input"
                onClick={() => {
                  const next = !voiceEnabled;
                  setVoiceEnabled(next);
                  save({ voiceEnabled: next });
                }}
                className={cn(
                  "relative h-7 w-12 shrink-0 rounded-pill transition-colors",
                  voiceEnabled ? "bg-lavender-500" : "bg-navy-50"
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 h-5 w-5 rounded-full bg-white shadow-card transition-transform",
                    voiceEnabled ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </Card>

            <p className="mb-2 mt-6 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
              Playback speed
            </p>
            <Card className="flex gap-2 p-3">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setVoiceSpeed(s);
                    save({ voiceSpeed: s });
                  }}
                  aria-pressed={Math.abs(voiceSpeed - s) < 0.01}
                  className={cn(
                    "min-h-[44px] flex-1 rounded-xl text-sm font-semibold transition-colors",
                    Math.abs(voiceSpeed - s) < 0.01
                      ? "bg-navy-900 text-on-strong"
                      : "bg-surface-muted text-ink-soft"
                  )}
                >
                  {s}×
                </button>
              ))}
            </Card>

            <p className="mb-2 mt-6 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
              Test your microphone
            </p>
            <Card>
              <Button
                variant={speech.listening ? "secondary" : "outline"}
                className="w-full"
                onClick={speech.toggle}
              >
                <Volume2 className="h-4 w-4" />
                {speech.listening ? "Listening — say something" : "Start test"}
              </Button>
              {heard && (
                <p className="mt-3 rounded-2xl bg-surface-muted p-3 text-sm text-navy-900">
                  We heard: &ldquo;{heard}&rdquo;
                </p>
              )}
              {speech.error && <p className="mt-2 text-xs text-danger">{speech.error}</p>}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
