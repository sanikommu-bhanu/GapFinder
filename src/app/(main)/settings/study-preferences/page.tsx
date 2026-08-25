"use client";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";

const SUBJECTS = ["Math", "Physics", "Chemistry"];
const PACE = ["relaxed", "standard", "intense"] as const;

export default function StudyPreferencesPage() {
  const [defaultSubject, setDefaultSubject] = useState("Math");
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(15);
  const [preferredPace, setPreferredPace] = useState<(typeof PACE)[number]>("standard");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setDefaultSubject(d.studyPreference?.defaultSubject ?? "Math");
        setDailyGoalMinutes(d.studyPreference?.dailyGoalMinutes ?? 15);
        setPreferredPace(d.studyPreference?.preferredPace ?? "standard");
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
      <TopBar title="Study Preferences" back={false} />
      <div className="px-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Default Subject</p>
        <div className="flex gap-2">
          {SUBJECTS.map((s) => (
            <Chip
              key={s}
              active={defaultSubject === s}
              onClick={() => {
                setDefaultSubject(s);
                save({ defaultSubject: s });
              }}
            >
              {s}
            </Chip>
          ))}
        </div>

        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-ink-faint">Daily Goal (min)</p>
        <Card className="p-4">
          <input
            type="range"
            min={5}
            max={60}
            step={5}
            value={dailyGoalMinutes}
            onChange={(e) => {
              const v = Number(e.target.value);
              setDailyGoalMinutes(v);
              save({ dailyGoalMinutes: v });
            }}
            className="w-full accent-navy-900"
          />
          <p className="mt-1 text-sm text-navy-900">{dailyGoalMinutes} min / day</p>
        </Card>

        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-ink-faint">Pace</p>
        <div className="flex gap-2">
          {PACE.map((p) => (
            <Chip
              key={p}
              active={preferredPace === p}
              onClick={() => {
                setPreferredPace(p);
                save({ preferredPace: p });
              }}
            >
              {p}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}
