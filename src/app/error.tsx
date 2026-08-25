"use client";
import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * The last line of defence. Anything that escapes a screen's own handling lands
 * here as a readable message with a way out, rather than as a white page or a
 * stack trace — a judge poking at the app should never see either.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[gapfinder] unhandled error", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-50">
        <AlertTriangle className="h-7 w-7 text-danger" />
      </span>
      <h1 className="mt-5 font-display text-xl font-bold text-navy-900">Something went wrong</h1>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">
        That screen hit an error. Your work is saved — nothing you analyzed has been lost.
      </p>
      <Button className="mt-7 w-full max-w-xs" onClick={reset}>
        Try again
      </Button>
      <Link href="/home" className="mt-2 w-full max-w-xs">
        <Button variant="outline" className="w-full">
          Back to home
        </Button>
      </Link>
    </div>
  );
}
