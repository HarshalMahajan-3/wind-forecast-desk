import { BookOpen, Database, FileCheck2 } from "lucide-react";

import type { WindAnalysis } from "@/lib/wind/analysis";

interface DataQualityPanelProps {
  meta: WindAnalysis["meta"];
  coverage: WindAnalysis["kpis"]["coverage"];
}

export function DataQualityPanel({ meta, coverage }: DataQualityPanelProps) {
  const [publishFrom, publishTo] = meta.publishWindow.split("/");
  const halfHourlyGap = coverage.expected - coverage.matched;

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-chart-actual" />
          <h3 className="text-sm font-semibold text-foreground">
            Source datasets
          </h3>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Elexon BMRS · retrieved{" "}
          <span className="font-mono">{meta.retrievedAt.slice(0, 16).replace("T", " ")} UTC</span>
        </p>
        <dl className="mt-3 space-y-2 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Actuals</dt>
            <dd className="text-right font-mono text-foreground">
              FUELHH · fuelType=WIND · {meta.actualCount.toLocaleString("en-GB")} rows
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Actuals resolution</dt>
            <dd className="text-right font-mono text-foreground">half-hourly (:00/:30)</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Forecasts</dt>
            <dd className="text-right font-mono text-foreground">
              WINDFOR · {meta.forecastCount.toLocaleString("en-GB")} vintages
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Forecast resolution</dt>
            <dd className="text-right font-mono text-foreground">hourly (:00 targets)</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Publish window</dt>
            <dd className="text-right font-mono text-foreground">
              {publishFrom?.slice(0, 10)} → {publishTo?.slice(0, 10)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Analysis period</dt>
            <dd className="text-right font-mono text-foreground">
              1–31 Jan 2026 (UTC)
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <FileCheck2 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Data quality
          </h3>
        </div>
        <dl className="mt-3 space-y-2 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Expected periods</dt>
            <dd className="text-right font-mono text-foreground">
              {coverage.expected.toLocaleString("en-GB")} half-hours
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Matched observations</dt>
            <dd className="text-right font-mono text-status-ok">
              {coverage.matched.toLocaleString("en-GB")} ({coverage.pct.toFixed(1)}%)
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Hourly-resolution gap</dt>
            <dd className="text-right font-mono text-status-neutral">
              {halfHourlyGap.toLocaleString("en-GB")} half-hours
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Missing forecasts</dt>
            <dd className="text-right font-mono text-status-missing">
              {Math.max(0, coverage.expected / 2 - coverage.matched).toLocaleString("en-GB")} hourly targets
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Interpolation</dt>
            <dd className="text-right font-mono text-foreground">none (strict timestamps)</dd>
          </div>
        </dl>
        <p className="mt-3 border-t border-border pt-2 text-[11px] leading-snug text-muted-foreground">
          WINDFOR publishes forecast targets on the hour only, while FUELHH
          reports actuals half-hourly. The desk materializes all{" "}
          {coverage.expected.toLocaleString("en-GB")} expected settlement
          periods and marks the :30 half-hours explicitly — no synthetic values
          are created.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-chart-forecast" />
          <h3 className="text-sm font-semibold text-foreground">Methodology</h3>
        </div>
        <ol className="mt-3 list-inside list-decimal space-y-1.5 text-[11px] leading-snug text-muted-foreground">
          <li>
            For delivery date D, the decision cutoff is{" "}
            <span className="text-foreground">D-1 at the configured Europe/London time</span>,
            converted to UTC (GMT/BST aware).
          </li>
          <li>
            For each hourly target, filter vintages to{" "}
            <span className="font-mono text-foreground">startTime == target</span> and{" "}
            <span className="font-mono text-foreground">publishTime ≤ cutoff</span> —
            post-cutoff publications are strictly excluded (no lookahead bias).
          </li>
          <li>
            Select the eligible vintage with the{" "}
            <span className="text-foreground">latest publishTime</span>; ties
            break deterministically by the highest forecast value.
          </li>
          <li>
            Join to FUELHH actuals on exact UTC{" "}
            <span className="font-mono">startTime</span> — never positionally.
          </li>
          <li>
            Metrics over matched intervals: error e = forecast − actual; MAE,
            RMSE, bias (positive = over-forecast), and WAPE = Σ|e| / Σ actual ×
            100 (null when Σ actual = 0).
          </li>
        </ol>
      </div>
    </div>
  );
}
