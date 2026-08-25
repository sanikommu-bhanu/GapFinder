"use client";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, Music, Wind, VolumeX } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";

export default function FocusModePage() {
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [music, setMusic] = useState("none");
  const [ambient, setAmbient] = useState("none");
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds((s) => (s > 0 ? s - 1 : 0));
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  async function saveFocusSettings(next: { focusMusic?: string; focusAmbient?: string }) {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-navy-900 px-5 pb-8 pt-4 text-white">
      <TopBar title="Focus Mode" subtitle="Stay focused. We'll handle the rest." className="w-full text-white [&_h1]:text-white [&_p]:text-white/60 [&_svg]:text-white" />

      <p className="mt-10 font-display text-6xl font-bold tracking-tight">{mm}:{ss}</p>

      <button
        onClick={() => setRunning((r) => !r)}
        className="mt-8 flex h-16 w-16 items-center justify-center rounded-full bg-white text-navy-900 shadow-floating"
      >
        {running ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 pl-0.5" />}
      </button>

      <div className="mt-10 grid w-full grid-cols-3 gap-3">
        <button
          onClick={() => {
            const next = music === "lofi" ? "none" : "lofi";
            setMusic(next);
            saveFocusSettings({ focusMusic: next });
          }}
          className={`flex flex-col items-center gap-2 rounded-2xl py-4 text-xs ${music !== "none" ? "bg-white/20" : "bg-white/5"}`}
        >
          <Music className="h-5 w-5" /> Music
        </button>
        <button
          onClick={() => {
            const next = ambient === "rain" ? "none" : "rain";
            setAmbient(next);
            saveFocusSettings({ focusAmbient: next });
          }}
          className={`flex flex-col items-center gap-2 rounded-2xl py-4 text-xs ${ambient !== "none" ? "bg-white/20" : "bg-white/5"}`}
        >
          <Wind className="h-5 w-5" /> Ambient
        </button>
        <button
          onClick={() => {
            setMusic("none");
            setAmbient("none");
            saveFocusSettings({ focusMusic: "none", focusAmbient: "none" });
          }}
          className="flex flex-col items-center gap-2 rounded-2xl bg-white/5 py-4 text-xs"
        >
          <VolumeX className="h-5 w-5" /> Silence
        </button>
      </div>
    </div>
  );
}
