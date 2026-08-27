"use client";
import { useCallback, useEffect, useState } from "react";
import { Music, SkipBack, SkipForward, Play, Pause, ExternalLink, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

/**
 * "Focus with music" — a GapFinder card that happens to be driven by Spotify.
 *
 * It uses the app's own radius, surfaces, type scale and spacing, because the
 * container must belong to GapFinder even when the content belongs to Spotify.
 * The only Spotify branding is the link out to the track itself.
 *
 * Every state below is a real state this card can be in, and each one says
 * something the student can act on:
 *
 *   unconfigured  → render nothing at all (the server has no Spotify keys)
 *   disconnected  → "Connect Spotify"
 *   idle          → connected, but nothing is playing anywhere
 *   playing       → track, artist, artwork; controls only if Premium
 *   unreachable   → Spotify didn't answer; offer a retry
 *
 * Nothing here is required for Focus Mode to work. If this card renders
 * nothing, the timer and the gap it repairs are entirely unaffected.
 */

type PlayerState = "loading" | "unconfigured" | "disconnected" | "idle" | "playing" | "unreachable";

interface PlayerPayload {
  state: Exclude<PlayerState, "loading">;
  isPremium?: boolean;
  isPlaying?: boolean;
  title?: string | null;
  artist?: string | null;
  artwork?: string | null;
  url?: string | null;
}

/** Poll slowly: this is ambient information, not a transport UI that must be exact. */
const POLL_MS = 10_000;

export function FocusMusicCard({ className }: { className?: string }) {
  const [player, setPlayer] = useState<PlayerPayload>({ state: "idle" });
  const [state, setState] = useState<PlayerState>("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/spotify/player");
      if (!res.ok) {
        setState("unreachable");
        return;
      }
      const data = (await res.json()) as PlayerPayload;
      setPlayer(data);
      setState(data.state);
    } catch {
      setState("unreachable");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Only poll while there is something to watch. A disconnected or unconfigured
  // card has no reason to make a request every ten seconds forever.
  useEffect(() => {
    if (state !== "playing" && state !== "idle") return;
    const id = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(id);
  }, [state, load]);

  const control = useCallback(
    async (action: "play" | "pause" | "next" | "previous") => {
      setBusy(true);
      setNotice(null);
      try {
        const res = await fetch("/api/spotify/control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          setNotice(body?.error ?? "Spotify refused that just now.");
        } else {
          // Spotify applies the change asynchronously; a short beat before
          // re-reading avoids showing the previous track as still current.
          setTimeout(() => void load(), 350);
        }
      } catch {
        setNotice("Couldn't reach Spotify.");
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  // The server has no Spotify credentials — the feature doesn't exist here, so
  // it isn't advertised. This is what keeps the app from depending on Spotify.
  if (state === "unconfigured") return null;

  if (state === "loading") {
    return <div className={cn("h-[92px] animate-pulse rounded-card bg-surface-card", className)} />;
  }

  return (
    <Card className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-1.5">
        <Music className="h-3.5 w-3.5 text-lavender-600" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-lavender-600">
          Focus with music
        </p>
      </div>

      {state === "disconnected" && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] leading-relaxed text-ink-soft">
            Connect Spotify to keep your own focus music playing while you work.
          </p>
          <a
            href="/api/spotify/login"
            className="shrink-0 rounded-pill bg-navy-900 px-4 py-2 text-xs font-semibold text-on-strong active:scale-[0.98]"
          >
            Connect
          </a>
        </div>
      )}

      {state === "unreachable" && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] leading-relaxed text-ink-soft">
            Spotify didn&apos;t answer just now. Your timer is unaffected.
          </p>
          <button
            onClick={() => void load()}
            className="flex shrink-0 items-center gap-1.5 rounded-pill bg-surface-muted px-3 py-2 text-xs font-semibold text-ink-soft"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}

      {state === "idle" && (
        <p className="text-[11px] leading-relaxed text-ink-soft">
          Connected. Press play in Spotify on any device and it&apos;ll show up here.
        </p>
      )}

      {state === "playing" && (
        <>
          <div className="flex items-center gap-3">
            {player.artwork ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={player.artwork}
                alt=""
                width={52}
                height={52}
                className="h-[52px] w-[52px] shrink-0 rounded-xl object-cover"
              />
            ) : (
              <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-surface-muted">
                <Music className="h-5 w-5 text-ink-faint" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-navy-900">{player.title}</p>
              <p className="truncate text-[11px] text-ink-soft">{player.artist}</p>
            </div>
            {player.url && (
              <a
                href={player.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open in Spotify"
                className="shrink-0 p-1 text-ink-faint"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          {/* Spotify requires Premium for every control endpoint. Rather than
              show buttons that would 403, a free account gets the reason. */}
          {player.isPremium ? (
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => void control("previous")}
                disabled={busy}
                aria-label="Previous track"
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors active:bg-surface-muted disabled:opacity-40"
              >
                <SkipBack className="h-4 w-4" />
              </button>
              <button
                onClick={() => void control(player.isPlaying ? "pause" : "play")}
                disabled={busy}
                aria-label={player.isPlaying ? "Pause" : "Play"}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-900 text-on-strong shadow-soft transition-transform active:scale-95 disabled:opacity-40"
              >
                {player.isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5 pl-0.5" />
                )}
              </button>
              <button
                onClick={() => void control("next")}
                disabled={busy}
                aria-label="Next track"
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors active:bg-surface-muted disabled:opacity-40"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <p className="text-[10px] leading-relaxed text-ink-faint">
              Spotify only allows apps to control playback on Premium accounts — showing what&apos;s
              playing works on any plan.
            </p>
          )}
        </>
      )}

      {notice && <p className="text-[10px] leading-relaxed text-warning">{notice}</p>}
    </Card>
  );
}
