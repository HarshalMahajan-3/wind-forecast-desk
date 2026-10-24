import { describe, expect, it } from "vitest";

import {
  buildObservations,
  computeMetrics,
  selectEligibleForecast,
  type ActualRecord,
  type ForecastRecord,
} from "@/lib/wind/analysis";
import { cutoffUtcIso, periodStartUtc } from "@/lib/wind/time";

const rec = (
  startTime: string,
  publishTime: string,
  generation: number,
): ForecastRecord => ({ startTime, publishTime, generation });

describe("decision cutoff conversion", () => {
  it("resolves D-1 10:00 Europe/London to 10:00 UTC in January (GMT)", () => {
    expect(cutoffUtcIso("2026-01-15", 10, 0)).toBe("2026-01-14T10:00:00.000Z");
  });

  it("shifts the UTC instant during BST (D-1 10:00 London = 09:00 UTC)", () => {
    expect(cutoffUtcIso("2026-07-15", 10, 0)).toBe("2026-07-14T09:00:00.000Z");
  });

  it("handles minutes", () => {
    expect(cutoffUtcIso("2026-01-15", 10, 30)).toBe("2026-01-14T10:30:00.000Z");
  });
});

describe("forecast vintage selection", () => {
  const target = "2026-01-05T14:00:00Z";
  const cutoff = cutoffUtcIso("2026-01-05", 10, 0); // 2026-01-04T10:00:00.000Z

  it("excludes vintages published after the cutoff (no lookahead bias)", () => {
    const vintages = [
      rec(target, "2026-01-04T09:30:00Z", 8000),
      rec(target, "2026-01-04T11:30:00Z", 9000),
      rec(target, "2026-01-05T02:30:00Z", 8500),
    ];
    const sel = selectEligibleForecast(vintages, cutoff);
    expect(sel?.publishTime).toBe("2026-01-04T09:30:00Z");
    expect(sel?.generation).toBe(8000);
  });

  it("selects the latest eligible vintage", () => {
    const vintages = [
      rec(target, "2026-01-03T22:30:00Z", 9273),
      rec(target, "2026-01-04T02:30:00Z", 8543),
      rec(target, "2026-01-04T09:30:00Z", 8049),
    ];
    expect(selectEligibleForecast(vintages, cutoff)?.generation).toBe(8049);
  });

  it("includes a vintage published exactly at the cutoff", () => {
    const vintages = [
      rec(target, "2026-01-03T22:30:00Z", 9000),
      rec(target, "2026-01-04T10:00:00Z", 8100),
    ];
    expect(selectEligibleForecast(vintages, cutoff)?.generation).toBe(8100);
  });

  it("breaks identical publish times by highest generation", () => {
    const vintages = [
      rec(target, "2026-01-04T09:30:00Z", 7000),
      rec(target, "2026-01-04T09:30:00Z", 9500),
      rec(target, "2026-01-04T09:30:00Z", 8800),
    ];
    expect(selectEligibleForecast(vintages, cutoff)?.generation).toBe(9500);
  });

  it("returns null when every vintage is post-cutoff", () => {
    const vintages = [rec(target, "2026-01-04T11:30:00Z", 9000)];
    expect(selectEligibleForecast(vintages, cutoff)).toBeNull();
  });

  it("returns null for an empty vintage list", () => {
    expect(selectEligibleForecast([], cutoff)).toBeNull();
  });
});

describe("accuracy metrics", () => {
  it("computes MAE, RMSE, bias and means from hand-calculated pairs", () => {
    const m = computeMetrics([
      { actual: 100, forecast: 120 },
      { actual: 200, forecast: 180 },
    ]);
    expect(m.count).toBe(2);
    expect(m.meanActual).toBe(150);
    expect(m.meanForecast).toBe(150);
    expect(m.mae).toBe(20);
    expect(m.rmse).toBe(20);
    expect(m.bias).toBe(0);
    expect(m.wape).toBeCloseTo(((20 + 20) / 300) * 100, 10);
  });

  it("returns null WAPE when the actual sum is zero", () => {
    const m = computeMetrics([
      { actual: 0, forecast: 50 },
      { actual: 0, forecast: 30 },
    ]);
    expect(m.wape).toBeNull();
    expect(m.mae).toBe(40);
  });

  it("returns safe zeros for an empty observation set", () => {
    const m = computeMetrics([]);
    expect(m.count).toBe(0);
    expect(m.mae).toBe(0);
    expect(m.wape).toBeNull();
  });
});

describe("observation building and coverage", () => {
  const actuals: ActualRecord[] = [
    periodStartUtc("2026-01-05", 1),
    periodStartUtc("2026-01-05", 2),
  ].map((startTime, i) => ({
    startTime,
    generation: 1000 + i * 10,
    settlementDate: "2026-01-05",
    settlementPeriod: i + 1,
  }));

  const forecasts: ForecastRecord[] = [
    // Hourly target (period 1): one eligible + one post-cutoff vintage
    rec("2026-01-05T00:00:00Z", "2026-01-04T09:30:00Z", 1200),
    rec("2026-01-05T00:00:00Z", "2026-01-04T23:30:00Z", 1300), // after 10:00 cutoff
    // No vintage at all for the half-hourly period 2
  ];

  it("pairs hourly actuals with the eligible decision-time forecast", () => {
    const obs = buildObservations(actuals, byStart(forecasts), 10, 0);
    expect(obs[0]?.status).toBe("MATCHED");
    expect(obs[0]?.forecast).toBe(1200);
    expect(obs[0]?.error).toBe(200);
  });

  it("marks half-hourly periods as a resolution gap, not missing", () => {
    const obs = buildObservations(actuals, byStart(forecasts), 10, 0);
    expect(obs[1]?.status).toBe("RESOLUTION_GAP");
    expect(obs[1]?.forecast).toBeNull();
  });

  it("flags hourly targets with no eligible vintage as missing forecasts", () => {
    const obs = buildObservations(actuals, byStart([]), 10, 0);
    expect(obs[0]?.status).toBe("MISSING_FORECAST");
    expect(obs[0]?.forecast).toBeNull();
  });

  it("coverage denominator is all expected half-hour periods", () => {
    const obs = buildObservations(actuals, byStart(forecasts), 10, 0);
    const matched = obs.filter((o) => o.status === "MATCHED").length;
    expect(matched).toBe(1);
    expect(obs.length).toBe(2);
  });
});

function byStart(records: ForecastRecord[]): Map<string, ForecastRecord[]> {
  const map = new Map<string, ForecastRecord[]>();
  for (const r of records) {
    const list = map.get(r.startTime) ?? [];
    list.push(r);
    map.set(r.startTime, list);
  }
  return map;
}
