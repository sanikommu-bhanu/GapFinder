"use client";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

const THEMES = ["light", "dark", "system"] as const;
const ACCENTS = [
  { name: "purple", hex: "#8B5CF6" },
  { name: "pink", hex: "#EC4899" },
  { name: "orange", hex: "#FB8A3C" },
  { name: "yellow", hex: "#F5C518" },
  { name: "teal", hex: "#2DD4BF" },
];

export default function AppearancePage() {
  const [theme, setTheme] = useState<(typeof THEMES)[number]>("system");
  const [accentColor, setAccentColor] = useState("purple");
  const [fontScale, setFontScale] = useState(1);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setTheme(d.settings?.theme ?? "system");
        setAccentColor(d.settings?.accentColor ?? "purple");
        setFontScale(d.settings?.fontScale ?? 1);
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
      <TopBar title="Appearance" back={false} />
      <div className="px-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Theme</p>
        <Card className="flex-row justify-between p-2">
          {THEMES.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTheme(t);
                save({ theme: t });
              }}
              className={cn(
                "flex-1 rounded-2xl py-2 text-center text-sm capitalize",
                theme === t ? "bg-navy-900 text-white" : "text-ink-soft"
              )}
            >
              {t}
            </button>
          ))}
        </Card>

        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-ink-faint">Accent Color</p>
        <Card className="flex-row gap-3 p-4">
          {ACCENTS.map((a) => (
            <button
              key={a.name}
              onClick={() => {
                setAccentColor(a.name);
                save({ accentColor: a.name });
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ backgroundColor: a.hex }}
            >
              {accentColor === a.name && <Check className="h-4 w-4 text-white" />}
            </button>
          ))}
        </Card>

        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-ink-faint">Font Size</p>
        <Card className="p-4">
          <input
            type="range"
            min={0.8}
            max={1.4}
            step={0.1}
            value={fontScale}
            onChange={(e) => {
              const v = Number(e.target.value);
              setFontScale(v);
              save({ fontScale: v });
            }}
            className="w-full accent-navy-900"
          />
          <div className="mt-1 flex justify-between text-xs text-ink-faint">
            <span>A</span>
            <span>A</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
