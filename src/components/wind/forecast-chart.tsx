import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";

import type { Observation, WindAnalysis } from "@/lib/wind/analysis";
import { fmtMW, fmtSignedMW, isoTime, shortDate } from "@/lib/wind/format";

interface ForecastChartProps {
  observations: Observation[];
  /** Settlement date for day view, or null for the full month. */
  day: string | null;
  onPointClick: (targetTime: string) => void;
}

interface ChartPoint {
  startTime: string;
  label: string;
  tick: string;
  actual: number;
  forecast: number | null;
  status: Observation["status"];
}

function useChartColors() {
  const [colors, setColors] = useState({
    actual: "#3fc6d8",
    forecast: "#e8a33d",
    missing: "#e06a5a",
    grid: "#2a3340",
    text: "#8b97a5",
  });
  useEffect(() => {
    const s = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string) =>
      s.getPropertyValue(name).trim() || fallback;
    setColors({
      actual: read("--chart-actual", "#3fc6d8"),
      forecast: read("--chart-forecast", "#e8a33d"),
      missing: read("--status-missing", "#e06a5a"),
      grid: read("--border", "#2a3340"),
      text: read("--muted-foreground", "#8b97a5"),
    });
  }, []);
  return colors;
}

export function ForecastChart({
  observations,
  day,
  onPointClick,
}: ForecastChartProps) {
  const colors = useChartColors();

  const { points, missingPoints, ticks } = useMemo(() => {
    const hourly = day
      ? observations.filter((o) => o.settlementDate === day)
      : observations.filter((o) => o.startTime.slice(14, 16) === "00");
    const pts: ChartPoint[] = hourly.map((o) => ({
      startTime: o.startTime,
      label: day ? isoTime(o.startTime) : shortDate(o.settlementDate),
      tick: day ? isoTime(o.startTime) : shortDate(o.settlementDate),
      actual: o.actual,
      forecast: o.forecast,
      status: o.status,
    }));
    const tickStep = day ? 8 : 48;
    const tickVals = pts
      .filter((_, i) => i % tickStep === 0)
      .map((p) => p.tick);
    const missing = pts.filter(
      (p) => p.forecast === null && p.startTime.slice(14, 16) === "00",
    );
    return { points: pts, missingPoints: missing, ticks: tickVals };
  }, [observations, day]);

  const isDay = day !== null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-4 rounded"
              style={{ backgroundColor: colors.actual }}
            />
            Actual generation (FUELHH)
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-4 rounded"
              style={{ backgroundColor: colors.forecast }}
            />
            Decision-time forecast (WINDFOR)
          </span>
          {missingPoints.length > 0 ? (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: colors.missing }}
              />
              No eligible forecast at cutoff
            </span>
          ) : null}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {isDay
            ? "48 half-hourly settlement periods · click a point to inspect forecast vintages"
            : "hourly decision-time series · select a delivery day for 30-minute detail"}
        </span>
      </div>
      <div className="h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points}
            margin={{ top: 8, right: 12, bottom: 0, left: 8 }}
            onClick={(state) => {
              const payload = (
                state as { activePayload?: { payload: ChartPoint }[] }
              )?.activePayload?.[0]?.payload;
              if (payload) onPointClick(payload.startTime);
            }}
          >
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="tick"
              ticks={ticks}
              tick={{ fill: colors.text, fontSize: 11, fontFamily: "IBM Plex Mono, monospace" }}
              tickLine={false}
              axisLine={{ stroke: colors.grid }}
            />
            <YAxis
              tick={{ fill: colors.text, fontSize: 11, fontFamily: "IBM Plex Mono, monospace" }}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v: number) => v.toLocaleString("en-GB")}
              label={{
                value: "MW",
                angle: -90,
                position: "insideLeft",
                style: { fill: colors.text, fontSize: 11 },
              }}
            />
            <Tooltip content={<ChartTooltip colors={colors} />} />
            {missingPoints.map((p) => (
              <ReferenceDot
                key={p.startTime}
                x={p.tick}
                y={0}
                r={4}
                fill={colors.missing}
                stroke="none"
                ifOverflow="extendDomain"
              />
            ))}
            <Line
              type="monotone"
              dataKey="actual"
              stroke={colors.actual}
              strokeWidth={1.8}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="forecast"
              stroke={colors.forecast}
              strokeWidth={1.8}
              strokeDasharray={isDay ? undefined : "6 3"}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  colors,
}: TooltipProps<number, string> & { colors: ReturnType<typeof useChartColors> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as ChartPoint | undefined;
  if (!p) return null;
  const statusText =
    p.status === "MATCHED"
      ? "Matched"
      : p.status === "MISSING_FORECAST"
        ? "No eligible forecast at cutoff"
        : "Half-hourly period — WINDFOR publishes hourly";
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-lg">
      <div className="font-mono text-xs text-foreground">
        {p.label} {p.label.includes(":") && p.label.length === 5 ? "UTC" : ""}
      </div>
      <div className="mt-1.5 space-y-1 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="inline-block h-0.5 w-3 rounded"
              style={{ backgroundColor: colors.actual }}
            />
            Actual
          </span>
          <span className="font-mono text-foreground">{fmtMW(p.actual)} MW</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="inline-block h-0.5 w-3 rounded"
              style={{ backgroundColor: colors.forecast }}
            />
            Forecast
          </span>
          <span className="font-mono text-foreground">
            {p.forecast === null ? "—" : `${fmtMW(p.forecast)} MW`}
          </span>
        </div>
        {p.forecast !== null ? (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Error</span>
            <span className="font-mono text-foreground">
              {fmtSignedMW((p.forecast ?? 0) - p.actual)} MW
            </span>
          </div>
        ) : null}
      </div>
      <div className="mt-1.5 border-t border-border pt-1.5 text-[10px] text-muted-foreground">
        {statusText} · click to inspect vintages
      </div>
    </div>
  );
}
