"use client";
import { Check } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { useAppearance } from "@/components/ThemeProvider";
import { cn } from "@/lib/cn";

/** Each accent re-points the app's whole brand hue — see theme.css. */
const ACCENTS = [
  { name: "purple", hex: "#8B5CF6", label: "Purple" },
  { name: "pink", hex: "#EC4899", label: "Pink" },
  { name: "orange", hex: "#FB8A3C", label: "Orange" },
  { name: "teal", hex: "#14B8A6", label: "Teal" },
  { name: "blue", hex: "#3B82F6", label: "Blue" },
];

const FONT_STEPS = [
  { value: 0.9, label: "S" },
  { value: 1, label: "M" },
  { value: 1.1, label: "L" },
  { value: 1.25, label: "XL" },
];

export default function AppearancePage() {
  const { accentColor, fontScale, update } = useAppearance();

  return (
    <div className="pb-8">
      <TopBar title="Appearance" />
      <div className="px-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Accent colour</p>
        <Card className="flex items-center justify-between p-4">
          {ACCENTS.map((a) => (
            <button
              key={a.name}
              onClick={() => update({ accentColor: a.name })}
              aria-label={`${a.label} accent`}
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
        <p className="mt-1.5 px-1 text-[11px] text-ink-faint">
          Recolours progress rings, links and highlights across the app.
        </p>

        <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-ink-faint">Text size</p>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-faint">A</span>
            <div className="flex flex-1 gap-2">
              {FONT_STEPS.map((step) => (
                <button
                  key={step.value}
                  onClick={() => update({ fontScale: step.value })}
                  aria-label={`Text size ${step.label}`}
                  aria-pressed={Math.abs(fontScale - step.value) < 0.01}
                  className={cn(
                    "min-h-[44px] flex-1 rounded-xl text-sm font-semibold transition-colors",
                    Math.abs(fontScale - step.value) < 0.01
                      ? "bg-lavender-500 text-white"
                      : "bg-surface-muted text-ink-soft"
                  )}
                >
                  {step.label}
                </button>
              ))}
            </div>
            <span className="text-lg text-ink-faint">A</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-navy-900">
            This sentence is set at the size you&apos;ve chosen. Everything in the app scales with it.
          </p>
        </Card>
      </div>
    </div>
  );
}
