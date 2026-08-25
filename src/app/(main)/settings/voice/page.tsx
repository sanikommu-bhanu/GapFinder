"use client";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";

export default function VoiceSettingsPage() {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceSpeed, setVoiceSpeed] = useState(1);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setVoiceEnabled(d.settings?.voiceEnabled ?? true);
        setVoiceSpeed(d.settings?.voiceSpeed ?? 1);
      });
  }, []);

  async function save(patch: Record<string, unknown>) {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  return (
    <div className="pb-6">
      <TopBar title="Voice" back={false} />
      <div className="px-5">
        <Card className="flex-row items-center justify-between">
          <p className="text-sm text-navy-900">Voice input & output</p>
          <button
            onClick={() => {
              const next = !voiceEnabled;
              setVoiceEnabled(next);
              save({ voiceEnabled: next });
            }}
            className={`h-6 w-11 rounded-pill ${voiceEnabled ? "bg-navy-900" : "bg-navy-50"}`}
          >
            <span className={`block h-5 w-5 translate-x-0.5 rounded-full bg-white transition-transform ${voiceEnabled ? "translate-x-[22px]" : ""}`} />
          </button>
        </Card>

        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-ink-faint">Speed</p>
        <Card className="p-4">
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={voiceSpeed}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVoiceSpeed(v);
              save({ voiceSpeed: v });
            }}
            className="w-full accent-navy-900"
          />
          <p className="mt-1 text-sm text-navy-900">{voiceSpeed.toFixed(1)}x</p>
        </Card>
      </div>
    </div>
  );
}
