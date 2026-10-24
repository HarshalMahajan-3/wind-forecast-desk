import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CircleCheck,
  Gauge,
  Sigma,
  Waves,
} from "lucide-react";

import type { WindAnalysis } from "@/lib/wind/analysis";
import { fmtMW, fmtPct, fmtSignedMW } from "@/lib/wind/format";
import { cn } from "@/lib/utils";

interface KpiCardsProps {
  kpis: WindAnalysis["kpis"];
}

export function KpiCards({ kpis }: KpiCardsProps) {
  const biasPositive = kpis.bias > 0;
  const cards = [
    {
      label: "Mean actual wind",
      value: fmtMW(kpis.meanActual),
      unit: "MW",
      hint: `FUELHH outturn over ${kpis.coverage.matched} matched intervals`,
      icon: Waves,
      tone: "text-chart-actual",
    },
    {
      label: "Mean forecast wind",
      value: fmtMW(kpis.meanForecast),
      unit: "MW",
      hint: "Decision-time WINDFOR vintage",
      icon: Activity,
      tone: "text-chart-forecast",
    },
    {
      label: "MAE",
      value: fmtMW(kpis.mae),
      unit: "MW",
      hint: "Mean absolute error",
      icon: Sigma,
      tone: "text-foreground",
    },
    {
      label: "RMSE",
      value: fmtMW(kpis.rmse),
      unit: "MW",
      hint: "Root mean squared error",
      icon: Gauge,
      tone: "text-foreground",
    },
    {
      label: "Forecast bias",
      value: fmtSignedMW(kpis.bias),
      unit: "MW",
      hint: biasPositive
        ? "Forecast − actual · over-forecast on average"
        : "Forecast − actual · under-forecast on average",
      icon: biasPositive ? ArrowUpRight : ArrowDownRight,
      tone: biasPositive ? "text-status-missing" : "text-status-ok",
    },
    {
      label: "Valid interval coverage",
      value: fmtPct(kpis.coverage.pct),
      unit: "",
      hint: `${kpis.coverage.matched} of ${kpis.coverage.expected} half-hour periods matched`,
      icon: CircleCheck,
      tone: "text-status-ok",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border border-border bg-card px-4 py-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {c.label}
            </span>
            <c.icon className={cn("h-3.5 w-3.5", c.tone)} />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className={cn("font-mono text-2xl font-semibold", c.tone)}>
              {c.value}
            </span>
            {c.unit ? (
              <span className="font-mono text-xs text-muted-foreground">
                {c.unit}
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
            {c.hint}
          </p>
        </div>
      ))}
    </div>
  );
}
