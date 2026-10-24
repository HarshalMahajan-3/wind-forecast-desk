import { cutoffUtcIso } from "./time";

// ---------- Types ----------

export interface ForecastRecord {
  /** Forecast target interval start, ISO 8601 UTC. */
  startTime: string;
  /** Publication time of this forecast vintage, ISO 8601 UTC. */
  publishTime: string;
  /** Forecast wind generation in MW. */
  generation: number;
}

export interface ActualRecord {
  /** Actual generation interval start, ISO 8601 UTC. */
  startTime: string;
  /** Actual wind generation in MW. */
  generation: number;
  /** UTC settlement date, e.g. "2026-01-05". */
  settlementDate: string;
  /** 1-based half-hourly settlement period (1..48). */
  settlementPeriod: number;
}

export type IntervalStatus =
  | "MATCHED" // hourly target with an eligible decision-time forecast and an actual
  | "MISSING_FORECAST" // hourly target whose every vintage was published after the cutoff
  | "RESOLUTION_GAP"; // half-hourly actual with no hourly-resolution forecast target

export interface Observation {
  startTime: string;
  settlementDate: string;
  settlementPeriod: number;
  status: IntervalStatus;
  actual: number;
  forecast: number | null;
  /** forecast - actual in MW; null when unmatched. */
  error: number | null;
}

export interface AccuracyMetrics {
  count: number;
  meanActual: number;
  meanForecast: number;
  mae: number;
  rmse: number;
  bias: number;
  /** sum|e| / sum(actual) * 100; null when the actual sum is zero. */
  wape: number | null;
}

export interface DailySummary {
  settlementDate: string;
  expected: number;
  matched: number;
  meanActual: number;
  meanForecast: number;
  mae: number;
  bias: number;
}

export interface DatasetMeta {
  source: string;
  datasets: string;
  retrievedAt: string;
  publishWindow: string;
  actualCount: number;
  forecastCount: number;
  analysisPeriod: string;
}

export interface AnalysisRequest {
  cutoffHour: number;
  cutoffMinute: number;
}

export interface WindAnalysis {
  meta: DatasetMeta;
  cutoff: {
    hour: number;
    minute: number;
    label: string;
    timezone: string;
    rule: string;
  };
  kpis: AccuracyMetrics & {
    coverage: { matched: number; expected: number; pct: number };
  };
  daily: DailySummary[];
  observations: Observation[];
}

// ---------- Forecast vintage selection ----------

/**
 * Select the decision-time forecast for one target interval:
 * the latest vintage published at or before the cutoff, ties broken
 * deterministically by the highest forecast value. Strictly excludes
 * vintages published after the cutoff (no lookahead bias).
 */
export function selectEligibleForecast(
  records: readonly ForecastRecord[],
  cutoffIso: string,
): ForecastRecord | null {
  // Compare as epoch milliseconds: ISO strings in this dataset may or may not
  // carry ".000" milliseconds, so plain lexicographic comparison is unsafe.
  const cutoffMs = Date.parse(cutoffIso);
  let best: ForecastRecord | null = null;
  let bestMs = Number.NEGATIVE_INFINITY;
  for (const r of records) {
    const ms = Date.parse(r.publishTime);
    if (Number.isNaN(ms) || ms > cutoffMs) continue;
    if (
      !best ||
      ms > bestMs ||
      (ms === bestMs && r.generation > best.generation)
    ) {
      best = r;
      bestMs = ms;
    }
  }
  return best;
}

// ---------- Accuracy metrics ----------

export function computeMetrics(
  pairs: ReadonlyArray<{ actual: number; forecast: number }>,
): AccuracyMetrics {
  const n = pairs.length;
  if (n === 0)
    return {
      count: 0,
      meanActual: 0,
      meanForecast: 0,
      mae: 0,
      rmse: 0,
      bias: 0,
      wape: null,
    };
  let sumActual = 0;
  let sumForecast = 0;
  let sumAbs = 0;
  let sumSq = 0;
  let sumErr = 0;
  for (const p of pairs) {
    const e = p.forecast - p.actual;
    sumActual += p.actual;
    sumForecast += p.forecast;
    sumAbs += Math.abs(e);
    sumSq += e * e;
    sumErr += e;
  }
  return {
    count: n,
    meanActual: sumActual / n,
    meanForecast: sumForecast / n,
    mae: sumAbs / n,
    rmse: Math.sqrt(sumSq / n),
    bias: sumErr / n,
    wape: sumActual === 0 ? null : (sumAbs / sumActual) * 100,
  };
}

// ---------- Observation builder ----------

/**
 * Materialize one observation per half-hourly settlement period.
 * Hourly targets are paired with the eligible decision-time forecast;
 * half-hourly targets are marked as a resolution gap because WINDFOR
 * publishes forecasts on the hour only (no interpolation is applied).
 */
export function buildObservations(
  actuals: readonly ActualRecord[],
  forecastsByStart: ReadonlyMap<string, ForecastRecord[]>,
  cutoffHour: number,
  cutoffMinute: number,
): Observation[] {
  return actuals.map((a) => {
    const isHourly = a.settlementPeriod % 2 === 1;
    if (!isHourly) {
      return {
        startTime: a.startTime,
        settlementDate: a.settlementDate,
        settlementPeriod: a.settlementPeriod,
        status: "RESOLUTION_GAP" as const,
        actual: a.generation,
        forecast: null,
        error: null,
      };
    }
    const cutoff = cutoffUtcIso(a.settlementDate, cutoffHour, cutoffMinute);
    const sel = selectEligibleForecast(
      forecastsByStart.get(a.startTime) ?? [],
      cutoff,
    );
    if (!sel) {
      return {
        startTime: a.startTime,
        settlementDate: a.settlementDate,
        settlementPeriod: a.settlementPeriod,
        status: "MISSING_FORECAST" as const,
        actual: a.generation,
        forecast: null,
        error: null,
      };
    }
    return {
      startTime: a.startTime,
      settlementDate: a.settlementDate,
      settlementPeriod: a.settlementPeriod,
      status: "MATCHED" as const,
      actual: a.generation,
      forecast: sel.generation,
      error: sel.generation - a.generation,
    };
  });
}

// ---------- Full analysis ----------

export function analyze(
  actuals: readonly ActualRecord[],
  forecastsByStart: ReadonlyMap<string, ForecastRecord[]>,
  meta: DatasetMeta,
  request: AnalysisRequest,
): WindAnalysis {
  const observations = buildObservations(
    actuals,
    forecastsByStart,
    request.cutoffHour,
    request.cutoffMinute,
  );
  const matchedPairs = observations
    .filter((o) => o.status === "MATCHED" && o.forecast !== null)
    .map((o) => ({ actual: o.actual, forecast: o.forecast as number }));
  const kpis = computeMetrics(matchedPairs);
  const expected = observations.length;
  const matched = matchedPairs.length;

  const byDate = new Map<string, Observation[]>();
  for (const o of observations) {
    const list = byDate.get(o.settlementDate) ?? [];
    list.push(o);
    byDate.set(o.settlementDate, list);
  }
  const daily: DailySummary[] = [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([settlementDate, obs]) => {
      const pairs = obs
        .filter((o) => o.status === "MATCHED" && o.forecast !== null)
        .map((o) => ({ actual: o.actual, forecast: o.forecast as number }));
      const m = computeMetrics(pairs);
      return {
        settlementDate,
        expected: obs.length,
        matched: pairs.length,
        meanActual: m.meanActual,
        meanForecast: m.meanForecast,
        mae: m.mae,
        bias: m.bias,
      };
    });

  const hh = String(request.cutoffHour).padStart(2, "0");
  const mm = String(request.cutoffMinute).padStart(2, "0");

  return {
    meta,
    cutoff: {
      hour: request.cutoffHour,
      minute: request.cutoffMinute,
      label: `${hh}:${mm}`,
      timezone: "Europe/London",
      rule: "D-1 (preceding day) at the configured local time",
    },
    kpis: {
      ...kpis,
      coverage: {
        matched,
        expected,
        pct: expected === 0 ? 0 : (matched / expected) * 100,
      },
    },
    daily,
    observations,
  };
}

// ---------- Vintage inspection ----------

export interface VintageInfo {
  publishTime: string;
  generation: number;
  /** Minutes between publication and the target interval. */
  leadMinutes: number;
  eligible: boolean;
  selected: boolean;
}

export interface VintageReport {
  targetTime: string;
  settlementDate: string;
  settlementPeriod: number;
  cutoffIso: string;
  actual: number | null;
  selected: { publishTime: string; generation: number } | null;
  vintages: VintageInfo[];
}

export function inspectVintages(
  targetTime: string,
  records: readonly ForecastRecord[],
  actual: number | null,
  cutoffHour: number,
  cutoffMinute: number,
): VintageReport {
  const settlementDate = targetTime.slice(0, 10);
  const cutoff = cutoffUtcIso(settlementDate, cutoffHour, cutoffMinute);
  const selected = selectEligibleForecast(records, cutoff);
  const cutoffMs = Date.parse(cutoff);
  const targetMs = Date.parse(targetTime);
  const vintages: VintageInfo[] = records
    .map((r) => {
      const publishMs = Date.parse(r.publishTime);
      return {
        publishTime: r.publishTime,
        generation: r.generation,
        leadMinutes: Math.round((targetMs - publishMs) / 60000),
        eligible: publishMs <= cutoffMs,
        selected:
          selected !== null &&
          r.publishTime === selected.publishTime &&
          r.generation === selected.generation,
      };
    })
    .sort((a, b) => Date.parse(a.publishTime) - Date.parse(b.publishTime));
  return {
    targetTime,
    settlementDate,
    settlementPeriod: Number(targetTime.slice(11, 13)) * 2 + 1,
    cutoffIso: cutoff,
    actual,
    selected: selected
      ? { publishTime: selected.publishTime, generation: selected.generation }
      : null,
    vintages,
  };
}
