"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GapFinderMark } from "@/components/brand/GapFinderMark";
import { cn } from "@/lib/cn";

/**
 * The launch screen.
 *
 * Previously `/` redirected straight past the brand: a returning student went
 * from cold start to the home feed and never saw the product identify itself.
 * This gives every launch the same opening — the mark, the name, the promise —
 * and then routes on, so the first seconds say what this is before asking
 * anyone to do anything.
 *
 * It costs nothing in time: the session check runs the moment the component
 * mounts, in parallel with the animation, and navigation happens as soon as
 * both are done. Tapping anywhere skips it, and it plays once per browser
 * session rather than on every internal navigation.
 */

const SESSION_KEY = "gapfinder-intro-played";
const ANIMATION_MS = 1750;

export default function LaunchPage() {
  const router = useRouter();
  const [phase, setPhase] = useState(0);
  const destination = useRef<string | null>(null);
  const readyAt = useRef<number>(Date.now() + ANIMATION_MS);
  const navigated = useRef(false);

  // Resolve where this person belongs while the animation runs, not after it.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) destination.current = d?.user ? "/home" : "/splash";
      })
      .catch(() => {
        if (!cancelled) destination.current = "/splash";
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const alreadyPlayed = (() => {
      try {
        return window.sessionStorage.getItem(SESSION_KEY) === "1";
      } catch {
        return false;
      }
    })();

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (alreadyPlayed || reducedMotion) {
      readyAt.current = Date.now();
      setPhase(3);
    } else {
      try {
        window.sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        // Private browsing — the intro simply plays again next time.
      }
      const timers = [
        setTimeout(() => setPhase(1), 60),
        setTimeout(() => setPhase(2), 620),
        setTimeout(() => setPhase(3), 1150),
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, []);

  // Leave as soon as both the animation and the session check are done.
  useEffect(() => {
    const tick = setInterval(() => {
      if (navigated.current) return;
      if (destination.current && Date.now() >= readyAt.current) {
        navigated.current = true;
        router.replace(destination.current);
      }
    }, 80);
    return () => clearInterval(tick);
  }, [router]);

  function skip() {
    if (navigated.current) return;
    navigated.current = true;
    router.replace(destination.current ?? "/splash");
  }

  return (
    <button
      onClick={skip}
      aria-label="Continue"
      className="relative flex flex-1 cursor-default flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#F7F4FF] via-[#FBF9FF] to-white px-8"
    >
      <div className="pointer-events-none absolute -left-24 top-16 h-64 w-64 rounded-full bg-lavender-200/35 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-24 h-56 w-56 rounded-full bg-peach-200/30 blur-3xl" />

      <GapFinderMark
        size={230}
        className={cn(
          "h-auto w-[min(62vw,230px)] transition-all duration-[900ms] ease-out",
          phase >= 1 ? "scale-100 opacity-100 blur-0" : "scale-90 opacity-0 blur-sm"
        )}
      />

      <h1
        className={cn(
          "relative mt-7 font-display text-[26px] font-bold tracking-tight text-lavender-600 transition-all duration-700",
          phase >= 2 ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        )}
      >
        GapFinder
      </h1>

      <p
        className={cn(
          "relative mt-2 max-w-[16rem] text-center text-[13px] leading-relaxed text-ink-soft transition-all duration-700",
          phase >= 3 ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        )}
      >
        Find where understanding broke.
      </p>
    </button>
  );
}
