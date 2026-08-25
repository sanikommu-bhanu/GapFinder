"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function SplashPage() {
  return (
    <div className="flex flex-1 flex-col justify-between bg-gradient-lavender px-6 pb-10 pt-16">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-lavender-600">GapFinder</h1>
          <Link href="/home" className="text-sm font-medium text-ink-soft">
            Skip
          </Link>
        </div>

        <div className="mx-auto mt-10 flex h-52 w-52 items-center justify-center rounded-full bg-gradient-brand shadow-floating">
          <div className="h-28 w-28 rounded-full bg-white/30 backdrop-blur-sm" />
        </div>
      </div>

      <div>
        <p className="text-sm text-ink-soft">Don&apos;t just find</p>
        <p className="text-sm text-ink-soft">the wrong answer.</p>
        <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-navy-900">
          Find where
          <br />
          understanding
          <br />
          broke.
        </h2>

        <Link
          href="/register"
          className="mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-navy-900 text-white shadow-floating"
        >
          <ArrowRight className="h-5 w-5" />
        </Link>
      </div>
    </div>
  );
}
