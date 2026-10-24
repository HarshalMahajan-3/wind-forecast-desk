import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { IntervalStatus, Observation } from "@/lib/wind/analysis";
import { fmtMW, fmtSignedMW, isoTime } from "@/lib/wind/format";
import { cn } from "@/lib/utils";

interface ObservationsTableProps {
  observations: Observation[];
  onInspect: (targetTime: string) => void;
}

type SortKey = "startTime" | "actual" | "forecast" | "error";
type StatusFilter = "all" | "matched" | "missing";

const PAGE_SIZE = 50;

const STATUS_META: Record<
  IntervalStatus,
  { label: string; className: string; bucket: "matched" | "missing" }
> = {
  MATCHED: {
    label: "Matched",
    className: "border-status-ok/40 text-status-ok",
    bucket: "matched",
  },
  MISSING_FORECAST: {
    label: "No eligible forecast",
    className: "border-status-missing/40 text-status-missing",
    bucket: "missing",
  },
  RESOLUTION_GAP: {
    label: "Hourly-resolution gap",
    className: "border-border text-muted-foreground",
    bucket: "missing",
  },
};

function toCsv(observations: Observation[]): string {
  const header =
    "start_time_utc,settlement_date,settlement_period,status,actual_mw,forecast_mw,error_mw";
  const lines = observations.map((o) =>
    [
      o.startTime,
      o.settlementDate,
      o.settlementPeriod,
      o.status,
      o.actual,
      o.forecast ?? "",
      o.error ?? "",
    ].join(","),
  );
  return `${header}\n${lines.join("\n")}\n`;
}

export function ObservationsTable({
  observations,
  onInspect,
}: ObservationsTableProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("startTime");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim();
    let rows = observations;
    if (statusFilter !== "all") {
      rows = rows.filter(
        (o) => STATUS_META[o.status].bucket === statusFilter,
      );
    }
    if (q) {
      rows = rows.filter(
        (o) =>
          o.startTime.includes(q) ||
          o.settlementDate.includes(q) ||
          String(o.settlementPeriod) === q,
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av =
        sortKey === "startTime" ? a.startTime : (a[sortKey] ?? Number.NaN);
      const bv =
        sortKey === "startTime" ? b.startTime : (b[sortKey] ?? Number.NaN);
      if (typeof av === "string" && typeof bv === "string")
        return av < bv ? -dir : av > bv ? dir : 0;
      const an = Number(av);
      const bn = Number(bv);
      if (Number.isNaN(an) && Number.isNaN(bn)) return 0;
      if (Number.isNaN(an)) return 1;
      if (Number.isNaN(bn)) return -1;
      return (an - bn) * dir;
    });
  }, [observations, query, statusFilter, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE,
  );

  const matched = observations.filter(
    (o) => STATUS_META[o.status].bucket === "matched",
  ).length;

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "startTime" ? "asc" : "desc");
    }
    setPage(0);
  };

  const downloadCsv = () => {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wind-forecast-desk-observations.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortHeader = ({
    label,
    k,
    numeric,
  }: {
    label: string;
    k: SortKey;
    numeric?: boolean;
  }) => (
    <th className={cn("px-3 py-2 text-left", numeric && "text-right")}>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => toggleSort(k)}
      >
        {label}
        {sortKey === k ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : null}
      </button>
    </th>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search time or date (e.g. 2026-01-05 or 14:00)"
            className="h-8 w-64 bg-background pl-8 font-mono text-xs"
          />
        </div>
        <div className="flex items-center gap-1">
          {(["all", "matched", "missing"] as StatusFilter[]).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={statusFilter === f ? "secondary" : "ghost"}
              className={cn(
                "h-8 px-2.5 text-xs capitalize",
                statusFilter === f && "border border-primary/50 text-primary",
              )}
              onClick={() => {
                setStatusFilter(f);
                setPage(0);
              }}
            >
              {f}
            </Button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {filtered.length} intervals · {matched} matched
        </span>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-8 gap-1.5 text-xs"
          onClick={downloadCsv}
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-border">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-secondary/60">
            <tr>
              <SortHeader label="Start time (UTC)" k="startTime" />
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Date
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Period
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </th>
              <SortHeader label="Actual (MW)" k="actual" numeric />
              <SortHeader label="Forecast (MW)" k="forecast" numeric />
              <SortHeader label="Error (MW)" k="error" numeric />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((o) => {
              const meta = STATUS_META[o.status];
              const hourly = o.settlementPeriod % 2 === 1;
              return (
                <tr
                  key={o.startTime}
                  onClick={() =>
                    hourly ? onInspect(o.startTime) : undefined
                  }
                  className={cn(
                    "border-t border-border/70",
                    hourly && "cursor-pointer hover:bg-accent/50",
                  )}
                >
                  <td className="px-3 py-1.5 font-mono text-foreground">
                    {isoTime(o.startTime)}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">
                    {o.settlementDate}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">
                    {o.settlementPeriod}
                  </td>
                  <td className="px-3 py-1.5">
                    <Badge
                      variant="outline"
                      className={cn("text-[10px]", meta.className)}
                    >
                      {meta.label}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-chart-actual">
                    {fmtMW(o.actual)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-chart-forecast">
                    {o.forecast === null ? "—" : fmtMW(o.forecast)}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-1.5 text-right font-mono",
                      o.error === null
                        ? "text-muted-foreground"
                        : o.error > 0
                          ? "text-status-missing"
                          : o.error < 0
                            ? "text-status-ok"
                            : "text-muted-foreground",
                    )}
                  >
                    {fmtSignedMW(o.error)}
                  </td>
                </tr>
              );
            })}
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No intervals match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span className="font-mono">
          {filtered.length === 0
            ? "0 results"
            : `${safePage * PAGE_SIZE + 1}–${Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Prev
          </Button>
          <span className="font-mono">
            {safePage + 1} / {pageCount}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
