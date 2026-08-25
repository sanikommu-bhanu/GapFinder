"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useAppStore } from "@/store/useAppStore";

const SUBJECTS = ["Math", "Physics", "Chemistry"];
const LEVELS = ["Middle School", "High School", "College"];

export default function PersonalizePage() {
  const router = useRouter();
  const setOnboarding = useAppStore((s) => s.setOnboarding);
  const [subject, setSubject] = useState("Math");
  const [level, setLevel] = useState("High School");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onContinue() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjects: [subject], gradeLevel: level }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Couldn't save your preferences.");
      }
      setOnboarding([subject], level);
      router.push("/home");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-white px-6 pb-8 pt-10">
      <div className="flex items-center justify-between">
        <div />
        <button
          className="text-sm font-medium text-ink-soft"
          onClick={() => router.push("/home")}
        >
          Skip
        </button>
      </div>

      <h1 className="mt-4 font-display text-2xl font-bold leading-snug text-navy-900">
        Let&apos;s personalize
        <br />
        your experience
      </h1>

      <p className="mt-6 text-sm font-semibold text-navy-900">What are you here to improve?</p>
      <div className="mt-3 flex flex-col gap-2">
        {SUBJECTS.map((s) => (
          <button
            key={s}
            onClick={() => setSubject(s)}
            className={cn(
              "flex items-center justify-between rounded-2xl border px-4 py-3.5 text-sm font-medium",
              subject === s ? "border-lavender-400 bg-lavender-50 text-navy-900" : "border-navy-50 text-ink-soft"
            )}
          >
            {s}
            {subject === s && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-lavender-500">
                <Check className="h-3.5 w-3.5 text-white" />
              </span>
            )}
          </button>
        ))}
      </div>

      <p className="mt-6 text-sm font-semibold text-navy-900">Select your level</p>
      <div className="mt-3 flex flex-col gap-2">
        {LEVELS.map((l) => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            className={cn(
              "flex items-center justify-between rounded-2xl border px-4 py-3.5 text-sm font-medium",
              level === l ? "border-lavender-400 bg-lavender-50 text-navy-900" : "border-navy-50 text-ink-soft"
            )}
          >
            {l}
            {level === l && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-lavender-500">
                <Check className="h-3.5 w-3.5 text-white" />
              </span>
            )}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <Button onClick={onContinue} loading={loading} className="mt-auto w-full">
        Continue
      </Button>
    </div>
  );
}
