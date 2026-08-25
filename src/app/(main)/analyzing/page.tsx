"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { ProgressRing } from "@/components/ui/ProgressRing";

const STAGES = ["Reading handwriting", "Reconstructing steps", "Analyzing reasoning", "Finding the first gap"];

export default function AnalyzingPage() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const [stageIdx, setStageIdx] = useState(0);

  useEffect(() => {
    if (!id) return;
    const interval = setInterval(() => {
      setStageIdx((i) => Math.min(i + 1, STAGES.length));
    }, 700);
    const timeout = setTimeout(() => {
      router.replace(`/analysis/${id}`);
    }, STAGES.length * 700 + 400);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [id, router]);

  return (
    <div className="pb-6">
      <TopBar title="Analyzing your work..." subtitle="This usually takes 5-10 seconds" back={false} />
      <div className="flex flex-col items-center px-5 pt-4">
        <ProgressRing value={Math.round((stageIdx / STAGES.length) * 100)} size={140} colorFrom="#C3B4F7" colorTo="#FFB27A" />

        <div className="mt-8 flex w-full flex-col gap-3">
          {STAGES.map((s, i) => (
            <div key={s} className="flex items-center gap-3 rounded-2xl bg-surface-card p-3 shadow-card">
              {i < stageIdx ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success">
                  <Check className="h-4 w-4 text-white" />
                </span>
              ) : i === stageIdx ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-lavender-100">
                  <Loader2 className="h-4 w-4 animate-spin text-lavender-600" />
                </span>
              ) : (
                <span className="h-6 w-6 rounded-full border-2 border-navy-50" />
              )}
              <p className="text-sm text-navy-900">{s}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
