"use client";
import { useEffect, useState } from "react";
import { Play, FileText, ExternalLink, Search, Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { LearningResource, ResourceBundle } from "@/lib/resources/types";
import { cn } from "@/lib/cn";

/**
 * Videos and research for a diagnosed gap.
 *
 * Loads on its own after the diagnosis is already on screen — a student never
 * waits on an external API to find out what they got wrong.
 *
 * A result marked `search` is a query, not a recommendation, and is labelled as
 * one. The distinction is the whole point: claiming a specific video teaches a
 * specific misconception, without having checked, is how a tool loses a
 * student's trust permanently.
 */
export function ResourcePanel({ gapId, className }: { gapId: string; className?: string }) {
  const [bundle, setBundle] = useState<ResourceBundle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/gaps/${gapId}/resources`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setBundle(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gapId]);

  if (loading) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="h-20 animate-pulse rounded-card bg-surface-card" />
        <div className="h-20 animate-pulse rounded-card bg-surface-card" />
      </div>
    );
  }

  if (!bundle) return null;

  const hasAnything = bundle.videos.length > 0 || bundle.papers.length > 0;
  if (!hasAnything && bundle.unavailable.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {bundle.videos.length > 0 && (
        <Card>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
            <Play className="h-3.5 w-3.5" /> Watch
          </p>
          <div className="mt-2.5 flex flex-col gap-2.5">
            {bundle.videos.map((r) => (
              <ResourceRow key={r.id} resource={r} />
            ))}
          </div>
        </Card>
      )}

      {bundle.papers.length > 0 && (
        <Card>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
            <FileText className="h-3.5 w-3.5" /> Research &amp; evidence
          </p>
          <div className="mt-2.5 flex flex-col gap-3">
            {bundle.papers.map((r) => (
              <ResourceRow key={r.id} resource={r} />
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-ink-faint">
            Retrieved live from Crossref and arXiv. Titles, authors and DOIs are theirs, not ours.
          </p>
        </Card>
      )}

      {bundle.unavailable.length > 0 && (
        <div className="flex items-start gap-2 rounded-2xl bg-surface-muted p-3">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
          <div className="min-w-0">
            {bundle.unavailable.map((u) => (
              <p key={u.provider} className="text-[11px] leading-relaxed text-ink-soft">
                <span className="font-medium">{u.provider}:</span> {u.reason}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ResourceRow({ resource }: { resource: LearningResource }) {
  const isSearch = resource.provenance === "search";

  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-2xl bg-surface-muted p-3 transition-colors active:bg-navy-50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {isSearch && (
            <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
              <Search className="h-2.5 w-2.5" /> Search — we haven&apos;t vetted specific videos
            </p>
          )}
          <p className="text-[13px] font-semibold leading-snug text-navy-900">{resource.title}</p>

          {(resource.source || resource.year || resource.authors.length > 0) && (
            <p className="mt-0.5 truncate text-[11px] text-ink-soft">
              {[
                resource.authors.length > 0
                  ? `${resource.authors[0]}${resource.authors.length > 1 ? " et al." : ""}`
                  : null,
                resource.source,
                resource.year,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}

          {resource.summary && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-soft">{resource.summary}</p>
          )}

          <p className="mt-1.5 text-[11px] leading-relaxed text-lavender-600">{resource.why}</p>
        </div>
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
      </div>
    </a>
  );
}
