"use client";
import { useState } from "react";
import { HelpCircle, ArrowRight, Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { WorkInput } from "@/components/ui/WorkInput";

/**
 * Ask before telling.
 *
 * Handing a student the explanation is the fastest way to end the session and
 * the slowest way to change what they understand — they read it, agree with it,
 * and make the same mistake next week. A student who works out *why* their step
 * failed has to reorganise the rule they were using, which is the thing that
 * actually sticks.
 *
 * So the explanation is held back behind one question, aimed precisely at the
 * misconception the audit identified. Two guards keep this from becoming
 * obstruction: the student can reveal the explanation at any time, and after
 * one attempt the answer is offered rather than withheld. Scaffolding that
 * won't let go is just stalling.
 */
export function SocraticPrompt({
  question,
  hint,
  onReveal,
}: {
  question: string;
  /** Shown after the first attempt — a nudge, still not the answer. */
  hint?: string;
  onReveal: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [attempted, setAttempted] = useState(false);

  return (
    <div className="px-5">
      <p className="text-center text-[13px] leading-relaxed text-ink-soft">
        Before we explain it — see if you can spot it yourself.
      </p>

      <Card className="mt-4 bg-lavender-50 shadow-none">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface">
          <HelpCircle className="h-4 w-4 text-lavender-600" />
        </span>
        <p className="mt-2.5 text-sm font-semibold leading-relaxed text-navy-900">{question}</p>
      </Card>

      <WorkInput
        className="mt-4"
        label="Your answer"
        value={answer}
        onChange={setAnswer}
        voice
        rows={4}
        placeholder="In your own words…"
      />

      {attempted && hint && (
        <Card className="mt-3 bg-peach-50 shadow-none">
          <div className="flex items-start gap-2">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-peach-500" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-peach-500">A nudge</p>
              <p className="mt-0.5 text-sm leading-relaxed text-navy-900">{hint}</p>
            </div>
          </div>
        </Card>
      )}

      {!attempted ? (
        <>
          <Button
            className="mt-4 w-full"
            onClick={() => setAttempted(true)}
            disabled={!answer.trim()}
          >
            That&apos;s my answer
          </Button>
          <Button variant="ghost" className="mt-2 w-full" onClick={onReveal}>
            Just show me
          </Button>
        </>
      ) : (
        <>
          <p className="mt-4 px-1 text-center text-[12px] leading-relaxed text-ink-soft">
            Whatever you landed on, here&apos;s what the algebra says — compare it with your answer.
          </p>
          <Button className="mt-3 w-full" onClick={onReveal}>
            Show me the explanation <ArrowRight className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}
