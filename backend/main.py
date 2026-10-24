"""Read-only API for January 2026 UK wind forecast evaluation."""
from __future__ import annotations

import json
import os
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

with (DATA_DIR / "actuals-jan2026.json").open(encoding="utf-8") as file:
    ACTUAL_FIXTURE: dict[str, Any] = json.load(file)
with (DATA_DIR / "forecasts-jan2026.json").open(encoding="utf-8") as file:
    FORECAST_FIXTURE: dict[str, Any] = json.load(file)

ACTUALS = [
    {
        "startTime": row[0],
        "generation": float(row[1]),
        "settlementDate": row[2],
        "settlementPeriod": int(row[3]),
    }
    for row in ACTUAL_FIXTURE["rows"]
]
FORECASTS_BY_START: dict[str, list[dict[str, Any]]] = defaultdict(list)
for start_time, publish_time, generation in FORECAST_FIXTURE["rows"]:
    FORECASTS_BY_START[start_time].append(
        {
            "startTime": start_time,
            "publishTime": publish_time,
            "generation": float(generation),
        }
    )

app = FastAPI(
    title="Wind Forecast Desk API",
    description="Read-only analysis API for Elexon BMRS wind generation snapshots.",
    version="1.0.0",
)
origins = [item.strip() for item in os.getenv(
    "CORS_ORIGINS", "http://localhost:3000,http://localhost:5173"
).split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


def cutoff_utc_iso(delivery_date: str, hour: int, minute: int) -> str:
    """D-1 at a Europe/London wall-clock time, converted to UTC."""
    d_minus_one = date.fromisoformat(delivery_date) - timedelta(days=1)
    local_cutoff = datetime.combine(
        d_minus_one,
        time(hour=hour, minute=minute),
        tzinfo=ZoneInfo("Europe/London"),
    )
    return local_cutoff.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace(
        "+00:00", "Z"
    )


def parse_instant(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def select_eligible_forecast(
    records: list[dict[str, Any]], cutoff_iso: str
) -> dict[str, Any] | None:
    cutoff = parse_instant(cutoff_iso)
    eligible = [r for r in records if parse_instant(r["publishTime"]) <= cutoff]
    if not eligible:
        return None
    # Latest publish time first; highest generation deterministically breaks ties.
    return max(eligible, key=lambda r: (parse_instant(r["publishTime"]), r["generation"]))


def compute_metrics(pairs: list[dict[str, float]]) -> dict[str, Any]:
    count = len(pairs)
    if not count:
        return {
            "count": 0, "meanActual": 0, "meanForecast": 0,
            "mae": 0, "rmse": 0, "bias": 0, "wape": None,
        }
    actual_sum = sum(pair["actual"] for pair in pairs)
    forecast_sum = sum(pair["forecast"] for pair in pairs)
    errors = [pair["forecast"] - pair["actual"] for pair in pairs]
    absolute_sum = sum(abs(error) for error in errors)
    return {
        "count": count,
        "meanActual": actual_sum / count,
        "meanForecast": forecast_sum / count,
        "mae": absolute_sum / count,
        "rmse": (sum(error * error for error in errors) / count) ** 0.5,
        "bias": sum(errors) / count,
        "wape": None if actual_sum == 0 else (absolute_sum / actual_sum) * 100,
    }


def build_observations(hour: int, minute: int) -> list[dict[str, Any]]:
    observations: list[dict[str, Any]] = []
    for actual in ACTUALS:
        is_hourly_forecast_target = actual["settlementPeriod"] % 2 == 1
        base = {
            "startTime": actual["startTime"],
            "settlementDate": actual["settlementDate"],
            "settlementPeriod": actual["settlementPeriod"],
            "actual": actual["generation"],
        }
        if not is_hourly_forecast_target:
            observations.append({
                **base, "status": "RESOLUTION_GAP", "forecast": None, "error": None,
            })
            continue
        cutoff = cutoff_utc_iso(actual["settlementDate"], hour, minute)
        selected = select_eligible_forecast(
            FORECASTS_BY_START.get(actual["startTime"], []), cutoff
        )
        if selected is None:
            observations.append({
                **base, "status": "MISSING_FORECAST", "forecast": None, "error": None,
            })
        else:
            observations.append({
                **base,
                "status": "MATCHED",
                "forecast": selected["generation"],
                "error": selected["generation"] - actual["generation"],
            })
    return observations


def build_analysis(hour: int, minute: int) -> dict[str, Any]:
    observations = build_observations(hour, minute)
    matched = [
        {"actual": row["actual"], "forecast": row["forecast"]}
        for row in observations
        if row["status"] == "MATCHED" and row["forecast"] is not None
    ]
    kpis = compute_metrics(matched)
    by_date: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in observations:
        by_date[row["settlementDate"]].append(row)
    daily = []
    for delivery_date in sorted(by_date):
        day_rows = by_date[delivery_date]
        day_pairs = [
            {"actual": row["actual"], "forecast": row["forecast"]}
            for row in day_rows
            if row["status"] == "MATCHED" and row["forecast"] is not None
        ]
        metrics = compute_metrics(day_pairs)
        daily.append({
            "settlementDate": delivery_date,
            "expected": len(day_rows),
            "matched": len(day_pairs),
            "meanActual": metrics["meanActual"],
            "meanForecast": metrics["meanForecast"],
            "mae": metrics["mae"],
            "bias": metrics["bias"],
        })
    expected = len(observations)
    matched_count = len(matched)
    return {
        "meta": {
            "source": ACTUAL_FIXTURE["source"],
            "datasets": f'{ACTUAL_FIXTURE["dataset"]} (actuals, fuelType={ACTUAL_FIXTURE["fuelType"]}) + {FORECAST_FIXTURE["dataset"]} (day-ahead forecasts)',
            "retrievedAt": ACTUAL_FIXTURE["retrievedAt"],
            "publishWindow": FORECAST_FIXTURE["publishWindow"],
            "actualCount": len(ACTUALS),
            "forecastCount": len(FORECAST_FIXTURE["rows"]),
            "analysisPeriod": "2026-01-01T00:00:00Z/2026-01-31T23:30:00Z",
        },
        "cutoff": {
            "hour": hour,
            "minute": minute,
            "label": f"{hour:02d}:{minute:02d}",
            "timezone": "Europe/London",
            "rule": "D-1 (preceding day) at the configured local time",
        },
        "kpis": {
            **kpis,
            "coverage": {
                "matched": matched_count,
                "expected": expected,
                "pct": 0 if expected == 0 else (matched_count / expected) * 100,
            },
        },
        "daily": daily,
        "observations": observations,
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/analysis")
def analysis(
    cutoff_hour: int = Query(default=10, ge=0, le=23, alias="cutoffHour"),
    cutoff_minute: int = Query(default=0, ge=0, le=59, alias="cutoffMinute"),
) -> dict[str, Any]:
    return build_analysis(cutoff_hour, cutoff_minute)


@app.get("/api/vintages")
def vintages(
    target_time: str = Query(alias="targetTime", pattern=r"^\d{4}-\d{2}-\d{2}T\d{2}:00:00Z$"),
    cutoff_hour: int = Query(default=10, ge=0, le=23, alias="cutoffHour"),
    cutoff_minute: int = Query(default=0, ge=0, le=59, alias="cutoffMinute"),
) -> dict[str, Any]:
    try:
        target = parse_instant(target_time)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid targetTime") from exc
    target_ms = target.timestamp() * 1000
    settlement_date = target_time[:10]
    cutoff = cutoff_utc_iso(settlement_date, cutoff_hour, cutoff_minute)
    cutoff_dt = parse_instant(cutoff)
    rows = FORECASTS_BY_START.get(target_time, [])
    selected = select_eligible_forecast(rows, cutoff)
    actual = next((r["generation"] for r in ACTUALS if r["startTime"] == target_time), None)
    items = []
    for row in rows:
        publish_dt = parse_instant(row["publishTime"])
        items.append({
            "publishTime": row["publishTime"],
            "generation": row["generation"],
            "leadMinutes": round((target_ms - publish_dt.timestamp() * 1000) / 60000),
            "eligible": publish_dt <= cutoff_dt,
            "selected": bool(
                selected is not None
                and row["publishTime"] == selected["publishTime"]
                and row["generation"] == selected["generation"]
            ),
        })
    items.sort(key=lambda item: parse_instant(item["publishTime"]))
    return {
        "targetTime": target_time,
        "settlementDate": settlement_date,
        "settlementPeriod": target.hour * 2 + 1,
        "cutoffIso": cutoff,
        "actual": actual,
        "selected": None if selected is None else {
            "publishTime": selected["publishTime"], "generation": selected["generation"],
        },
        "vintages": items,
    }
