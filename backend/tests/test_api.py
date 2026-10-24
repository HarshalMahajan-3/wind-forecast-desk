from fastapi.testclient import TestClient

from main import app, build_analysis, cutoff_utc_iso, compute_metrics, select_eligible_forecast

client = TestClient(app)


def test_health_endpoint():
    assert client.get("/health").json() == {"status": "ok"}


def test_london_cutoff_respects_winter_and_summer_time():
    assert cutoff_utc_iso("2026-01-15", 10, 0) == "2026-01-14T10:00:00.000Z"
    assert cutoff_utc_iso("2026-07-15", 10, 0) == "2026-07-14T09:00:00.000Z"


def test_forecast_selection_never_uses_a_post_cutoff_vintage():
    rows = [
        {"publishTime": "2026-01-04T09:30:00Z", "generation": 8000},
        {"publishTime": "2026-01-04T11:30:00Z", "generation": 9000},
    ]
    selected = select_eligible_forecast(rows, "2026-01-04T10:00:00Z")
    assert selected is not None
    assert selected["generation"] == 8000


def test_accuracy_metrics():
    metrics = compute_metrics([
        {"actual": 100, "forecast": 120},
        {"actual": 200, "forecast": 180},
    ])
    assert metrics["mae"] == 20
    assert metrics["rmse"] == 20
    assert metrics["bias"] == 0
    assert round(metrics["wape"], 6) == round((40 / 300) * 100, 6)


def test_analysis_has_january_period_and_48_half_hourly_observations_per_day():
    result = build_analysis(10, 0)
    assert len(result["daily"]) == 31
    assert len(result["observations"]) == 31 * 48
    assert result["meta"]["analysisPeriod"].startswith("2026-01-01")
    assert result["kpis"]["coverage"]["expected"] == 31 * 48


def test_analysis_endpoint_rejects_invalid_cutoff():
    response = client.get("/api/analysis?cutoffHour=25")
    assert response.status_code == 422
