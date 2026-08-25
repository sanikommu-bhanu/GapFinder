"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Mic } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function TeachBackPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ rubricScore: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!explanation.trim()) {
      setError("Type or speak your explanation first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/gaps/${params.id}/teach-back`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentExplanation: explanation, inputMode: "text" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't evaluate your explanation.");
      setResult({ rubricScore: data.result.rubricScore });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="pb-6">
        <TopBar title="Teach It Back" back={false} />
        <div className="px-5 pt-4">
          <Card className="text-center">
            <p className="text-xs font-semibold text-ink-soft">Your explanation scored</p>
            <p className="mt-1 font-display text-4xl font-bold text-navy-900">{result.rubricScore}%</p>
            <p className="mt-2 text-sm text-ink-soft">
              {result.rubricScore >= 80
                ? "Strong explanation — you clearly understand why this works."
                : "Good attempt — review the concept card and try explaining it once more."}
            </p>
          </Card>
          <Button className="mt-6 w-full" onClick={() => router.push("/gaps")}>
            Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <TopBar title="Teach It Back" subtitle="Explain it in your own words." />
      <div className="px-5">
        <Card>
          <p className="text-sm font-semibold text-navy-900">Why did we subtract 7 from both sides?</p>
        </Card>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Tap to speak or type your explanation…"
          className="mt-4 h-40 w-full rounded-2xl border border-navy-50 bg-surface-muted p-4 text-sm outline-none focus:border-lavender-400"
        />
        <div className="mt-2 flex justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-900 text-white">
            <Mic className="h-5 w-5" />
          </span>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <Button className="mt-4 w-full" onClick={submit} loading={loading}>
          Submit
        </Button>
      </div>
    </div>
  );
}
