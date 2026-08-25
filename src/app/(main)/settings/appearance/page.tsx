"use client";
import { Check, Sun, Moon, Monitor } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { useAppearance, type ThemeChoice } from "@/components/ThemeProvider";
import { cn } from "@/lib/cn";

const THEMES: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Each accent re-points the app's whole lavender family — see theme.css. */
const ACCENTS = [
  { name: "purple", hex: "#8B5CF6" },
  { name: "pink", hex: "#EC4899" },
  { name: "orange", hex: "#FB8A3C" },
  { name: "teal", hex: "#14B8A6" },
  { name: "blue", hex: "#3B82F6" },
];

const FONT_STEPS = [0.9, 1, 1.1, 1.25];

export default function AppearancePage() {
  const { theme, accentColor, fontScale, resolvedTheme, update } = useAppearance();

  return (
    <div className="pb-8">
      <TopBar title="Appearance" />
      <div className="px-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Theme</p>
        <Card className="flex gap-2 p-2">
          {THEMES.map((t) => (
            <button
              key={t.value}
              onClick={() => update({ theme: t.value })}
              aria-pressed={theme === t.value}
              className={cn(
                "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2 text-xs font-medium transition-colors",
                theme === t.value ? "bg-navy-900 text-on-strong" : "text-ink-soft"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </Card>
        {theme === "system" && (
          <p className="mt-1.5 px-1 text-[11px] text-ink-faint">
            Following your device, which is currently {resolvedTheme}.
          </p>
        )}

        <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-ink-faint">Accent colour</p>
        <Card className="flex items-center justify-between p-4">
          {ACCENTS.map((a) => (
            <button
              key={a.name}
              onClick={() => update({ accentColor: a.name })}
              aria-label={`${a.name} accent`}
              aria-pressed={accentColor === a.name}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-90",
                accentColor === a.name && "ring-2 ring-navy-900 ring-offset-2 ring-offset-surface-card"
              )}
              style={{ backgroundColor: a.hex }}
            >
              {accentColor === a.name && <Check className="h-4 w-4 text-white" />}
            </button>
          ))}
        </Card>

        <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-ink-faint">Text size</p>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-faint">A</span>
            <div className="flex flex-1 gap-2">
              {FONT_STEPS.map((step) => (
                <button
                  key={step}
                  onClick={() => update({ fontScale: step })}
                  aria-label={`Text size ${Math.round(step * 100)} percent`}
                  aria-pressed={Math.abs(fontScale - step) < 0.01}
                  className={cn(
                    "min-h-[44px] flex-1 rounded-xl text-sm font-semibold transition-colors",
                    Math.abs(fontScale - step) < 0.01
                      ? "bg-lavender-500 text-white"
                      : "bg-surface-muted text-ink-soft"
                  )}
                >
                  {Math.round(step * 100)}%
                </button>
              ))}
            </div>
            <span className="text-lg text-ink-faint">A</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-navy-900">
            This sentence shows the size you&apos;ve picked. Everything in the app scales with it.
          </p>
        </Card>
      </div>
    </div>
  );
}
