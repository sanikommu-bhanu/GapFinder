"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GapFinderMark } from "@/components/brand/GapFinderMark";

/**
 * The first screen, built to the design reference: pale lavender wash, the
 * looped mark floating in the upper half, the promise set in three lines with
 * "understanding" carried in lavender, and a single dark circular action.
 */
export default function SplashPage() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-gradient-to-b from-[#F7F4FF] via-[#FBF9FF] to-white px-6 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))]">
      {/* Ambient wash behind the mark, matching the reference's soft corners. */}
      <div className="pointer-events-none absolute -left-24 top-8 h-64 w-64 rounded-full bg-lavender-200/35 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-40 h-56 w-56 rounded-full bg-peach-200/30 blur-3xl" />

      <div className="relative flex items-center justify-between">
        <h1 className="font-display text-[22px] font-bold tracking-tight text-lavender-600">GapFinder</h1>
        <Link
          href="/register"
          className="-mr-2 flex h-11 items-center px-2 text-sm font-medium text-ink-soft transition-colors active:text-navy-900"
        >
          Skip
        </Link>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center py-2">
        <GapFinderMark
          size={248}
          className="h-auto w-[min(68vw,248px)] max-h-[38dvh] animate-pop-in"
        />
      </div>

      <div className="relative">
        <p className="text-[15px] leading-snug text-ink-soft">Don&apos;t just find</p>
        <p className="text-[15px] leading-snug text-ink-soft">the wrong answer.</p>

        <h2 className="mt-3 font-display text-[clamp(28px,8.2vw,34px)] font-bold leading-[1.12] tracking-tight text-navy-900">
          Find where
          <br />
          <span className="text-lavender-500">understanding</span>
          <br />
          broke.
        </h2>

        <div className="mt-5 flex items-center gap-1.5" aria-hidden="true">
          <span className="h-1.5 w-5 rounded-pill bg-navy-900" />
          <span className="h-1.5 w-1.5 rounded-pill bg-navy-100" />
          <span className="h-1.5 w-1.5 rounded-pill bg-navy-100" />
        </div>

        <Link
          href="/register"
          aria-label="Get started"
          className="mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-navy-900 text-on-strong shadow-floating transition-transform active:scale-95"
        >
          <ArrowRight className="h-5 w-5" />
        </Link>
      </div>
    </div>
  );
}
