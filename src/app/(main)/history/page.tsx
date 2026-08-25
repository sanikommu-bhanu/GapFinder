"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";

type Row = { id: string; subject: string; status: string; createdAt: string; gapCount: number; concepts: string[] };

function groupByDay(rows: Row[]) {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groups: Record<string, Row[]> = {};
  for (const r of rows) {
    const d = new Date(r.createdAt).toDateString();
    const key = d === today ? "Today" : d === yesterday ? "Yesterday" : d;
    groups[key] = groups[key] ?? [];
    groups[key].push(r);
  }
  return groups;
}

export default function HistoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => setRows(d.analyses ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter((r) => r.subject.toLowerCase().includes(query.toLowerCase()) || r.concepts.some((c) => c.toLowerCase().includes(query.toLowerCase())));
  const groups = groupByDay(filtered);

  return (
    <div className="pb-6">
      <TopBar title="History" back={false} />
      <div className="px-5">
        <div className="flex items-center gap-2 rounded-pill bg-surface-muted px-4 py-2.5">
          <Search className="h-4 w-4 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search history…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-ink-soft">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">No sessions yet.</p>
        ) : (
          Object.entries(groups).map(([day, items]) => (
            <div key={day} className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{day}</p>
              <div className="flex flex-col gap-2">
                {items.map((r) => (
                  <Link key={r.id} href={`/analysis/${r.id}`}>
                    <Card className="flex-row items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-semibold text-navy-900">{r.concepts[0] ?? r.subject}</p>
                        <p className="text-xs text-ink-soft">{r.gapCount} gap{r.gapCount === 1 ? "" : "s"} found</p>
                      </div>
                      <p className="text-xs text-ink-faint">{new Date(r.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
