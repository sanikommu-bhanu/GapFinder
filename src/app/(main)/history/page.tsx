"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ScanLine, Keyboard, Camera, History as HistoryIcon } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { cn } from "@/lib/cn";

type Row = {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  sourceType: string;
  stepCount: number;
  gapCount: number;
  title: string;
  concepts: string[];
  outcome: "clean" | "open" | "repaired" | "closed" | string;
};

const OUTCOME_META: Record<string, { label: string; tone: string }> = {
  clean: { label: "No gaps", tone: "bg-success-50 text-success" },
  open: { label: "Open", tone: "bg-warning-50 text-warning" },
  repaired: { label: "Repaired", tone: "bg-lavender-50 text-lavender-600" },
  closed: { label: "Transferred", tone: "bg-success-50 text-success" },
  failed: { label: "Didn't finish", tone: "bg-danger-50 text-danger" },
};

const FILTERS = ["All", "Open", "Repaired", "Transferred"] as const;

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  const day = date.toDateString();
  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function HistoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Couldn't load your history."))))
      .then((d) => setRows(d.analyses ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQuery =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q) ||
        r.concepts.some((c) => c.toLowerCase().includes(q));
      const matchesFilter =
        filter === "All" ||
        (filter === "Open" && r.outcome === "open") ||
        (filter === "Repaired" && r.outcome === "repaired") ||
        (filter === "Transferred" && r.outcome === "closed");
      return matchesQuery && matchesFilter;
    });
  }, [rows, query, filter]);

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of filtered) {
      const key = dayLabel(r.createdAt);
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="pb-6">
      <TopBar title="History" back={false} />
      <div className="px-5">
        <div className="flex items-center gap-2 rounded-pill bg-surface-muted px-4 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search your history"
            placeholder="Search by concept or subject…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>

        <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 scrollbar-none">
          {FILTERS.map((f) => (
            <Chip key={f} active={filter === f} onClick={() => setFilter(f)} className="shrink-0">
              {f}
            </Chip>
          ))}
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        {loading ? (
          <div className="mt-5 flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-card bg-surface-card" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-10 flex flex-col items-center px-4 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-lavender-50">
              <HistoryIcon className="h-7 w-7 text-lavender-500" />
            </span>
            <p className="mt-4 font-display text-base font-bold text-navy-900">Nothing here yet</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              Every problem you analyze is saved here, so you can see how your reasoning changes over time.
            </p>
            <Link href="/scan" className="mt-5 w-full">
              <Button className="w-full">
                <ScanLine className="h-4 w-4" /> Analyze your work
              </Button>
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <p className="mt-6 text-center text-sm text-ink-soft">Nothing matches that.</p>
        ) : (
          groups.map(([day, items]) => (
            <div key={day} className="mt-5">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">{day}</p>
              <div className="flex flex-col gap-2">
                {items.map((r) => {
                  const meta = OUTCOME_META[r.outcome] ?? OUTCOME_META.open!;
                  const SourceIcon = r.sourceType === "typed" ? Keyboard : Camera;
                  return (
                    <Link key={r.id} href={`/analysis/${r.id}`}>
                      <Card className="flex items-center justify-between gap-3 py-3 active:scale-[0.99]">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-navy-900">{r.title}</p>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-soft">
                            <SourceIcon className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {r.stepCount} step{r.stepCount === 1 ? "" : "s"}
                              {r.gapCount > 0 && ` · ${r.gapCount} gap${r.gapCount === 1 ? "" : "s"}`}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span
                            className={cn("rounded-pill px-2 py-0.5 text-[10px] font-semibold", meta.tone)}
                          >
                            {meta.label}
                          </span>
                          <p className="text-[10px] text-ink-faint">
                            {new Date(r.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
