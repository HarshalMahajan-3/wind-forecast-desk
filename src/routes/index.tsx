import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarRange, LayoutList } from "lucide-react";

import { CutoffControl } from "@/components/wind/cutoff-control";
import { DataQualityPanel } from "@/components/wind/data-quality-panel";
import { DeskHeader } from "@/components/wind/desk-header";
import { ForecastChart } from "@/components/wind/forecast-chart";
import { KpiCards } from "@/components/wind/kpi-cards";
import { ObservationsTable } from "@/components/wind/observations-table";
import { VintagesDialog } from "@/components/wind/vintages-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { analysisQueryOptions } from "@/lib/wind/queries";
import { shortDate } from "@/lib/wind/format";
import { cn } from "@/lib/utils";

const HOUR_TARGET_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:00:00Z$/;

function parseIntParam(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

interface DashboardSearch {
  cutoffHour: number;
  cutoffMinute: number;
  target?: string;
}

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): DashboardSearch => {
    const cutoffHour = parseIntParam(search["cutoffHour"], 10, 0, 23);
    const cutoffMinute = parseIntParam(search["cutoffMinute"], 0, 0, 59);
    const raw = search["target"];
    const target =
      typeof raw === "string" && HOUR_TARGET_RE.test(raw) ? raw : undefined;
    return target
      ? { cutoffHour, cutoffMinute, target }
      : { cutoffHour, cutoffMinute };
  },
  head: () => ({
    meta: [
      {
        title: "Wind Forecast Desk — UK Day-Ahead Wind Procurement Analytics",
      },
      {
        name: "description",
        content:
          "Compare decision-time WINDFOR forecasts against FUELHH outturn wind generation for January 2026, with auditable D-1 cutoff selection, forecast vintages, and data quality reporting from Elexon BMRS.",
      },
      {
        property: "og:title",
        content: "Wind Forecast Desk — UK Day-Ahead Wind Procurement Analytics",
      },
      {
        property: "og:description",
        content:
          "Auditable D-1 wind forecast accuracy desk: MAE, RMSE, bias and vintage inspection on verified Elexon BMRS data for January 2026.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { cutoffHour, cutoffMinute, target } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data } = useSuspenseQuery(
    analysisQueryOptions(cutoffHour, cutoffMinute),
  );

  const days = useMemo(
    () => [...new Set(data.observations.map((o) => o.settlementDate))],
    [data.observations],
  );
  const [view, setView] = useState<"month" | "day">("month");
  const [selectedDay, setSelectedDay] = useState<string>(days[0] ?? "");

  const setCutoff = (hour: number, minute: number) => {
    void navigate({
      search: (prev) => ({ ...prev, cutoffHour: hour, cutoffMinute: minute }),
      replace: true,
    });
  };

  const setTarget = (targetTime: string | null) => {
    void navigate({
      search: (prev) =>
        targetTime
          ? { ...prev, target: targetTime }
          : {
              cutoffHour: prev.cutoffHour,
              cutoffMinute: prev.cutoffMinute,
            },
      replace: true,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <DeskHeader
        retrievedAt={data.meta.retrievedAt}
        datasets="FUELHH + WINDFOR"
        analysisPeriod={data.meta.analysisPeriod}
      />

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6">
        <CutoffControl
          cutoffHour={cutoffHour}
          cutoffMinute={cutoffMinute}
          onChange={setCutoff}
        />

        <KpiCards kpis={data.kpis} />

        <section className="rounded-lg border border-border bg-card px-4 py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Forecast vs actual wind generation
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Decision-time forecast at D-1{" "}
                <span className="font-mono text-primary">
                  {data.cutoff.label}
                </span>{" "}
                Europe/London vs FUELHH outturn · January 2026
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(
                    "h-7 gap-1.5 px-2.5 text-xs",
                    view === "month" && "bg-secondary text-primary",
                  )}
                  onClick={() => setView("month")}
                >
                  <CalendarRange className="h-3.5 w-3.5" />
                  Full month
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(
                    "h-7 gap-1.5 px-2.5 text-xs",
                    view === "day" && "bg-secondary text-primary",
                  )}
                  onClick={() => setView("day")}
                >
                  <LayoutList className="h-3.5 w-3.5" />
                  Delivery day
                </Button>
              </div>
              <Select
                value={selectedDay}
                onValueChange={(v) => {
                  setSelectedDay(v);
                  setView("day");
                }}
                disabled={view === "month"}
              >
                <SelectTrigger className="h-8 w-40 font-mono text-xs">
                  <SelectValue placeholder="Delivery day" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {days.map((d) => (
                    <SelectItem key={d} value={d} className="font-mono text-xs">
                      {shortDate(d)} 2026
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <ForecastChart
            observations={data.observations}
            day={view === "day" ? selectedDay : null}
            onPointClick={(t) => setTarget(t)}
          />
        </section>

        <section className="rounded-lg border border-border bg-card px-4 py-4">
          <div className="mb-3 px-1">
            <h2 className="text-sm font-semibold text-foreground">
              Interval observations
            </h2>
            <p className="text-[11px] text-muted-foreground">
              All {data.observations.length.toLocaleString("en-GB")} half-hour
              settlement periods · click an hourly row to inspect forecast
              vintages
            </p>
          </div>
          <ObservationsTable
            observations={data.observations}
            onInspect={(t) => setTarget(t)}
          />
        </section>

        <DataQualityPanel meta={data.meta} coverage={data.kpis.coverage} />

        <footer className="pb-4 pt-1 text-center text-[11px] text-muted-foreground">
          Source data © Elexon BMRS (FUELHH, WINDFOR) · Snapshot for January
          2026 · Decision cutoff default 10:00 Europe/London on D-1
        </footer>
      </main>

      <VintagesDialog
        targetTime={target ?? null}
        cutoffHour={cutoffHour}
        cutoffMinute={cutoffMinute}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
      />
    </div>
  );
}
