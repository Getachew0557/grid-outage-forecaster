"""Tests for OutageForecaster."""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.generate_data import generate_grid_history
from src.forecaster import OutageForecaster, create_features


@pytest.fixture(scope="module")
def grid_df():
    return generate_grid_history(n_days=180)


@pytest.fixture(scope="module")
def trained_forecaster(grid_df):
    f = OutageForecaster()
    f.train(grid_df)
    return f


def test_grid_history_row_count(grid_df):
    """Dataset must have exactly 180 × 24 = 4,320 rows."""
    assert len(grid_df) == 4320


def test_grid_history_columns(grid_df):
    expected = {"timestamp", "load_mw", "temp_c", "humidity", "wind_ms", "rain_mm", "outage", "duration_min"}
    assert expected.issubset(set(grid_df.columns))


def test_outage_binary(grid_df):
    assert set(grid_df["outage"].unique()).issubset({0, 1})


def test_duration_non_negative(grid_df):
    assert (grid_df["duration_min"] >= 0).all()


def test_feature_engineering(grid_df):
    feat = create_features(grid_df)
    assert "hour_sin" in feat.columns
    assert "load_lag_1" in feat.columns
    assert "outage_rolling_6h" in feat.columns
    assert len(feat) > 0


def test_forecast_probabilities_in_range(trained_forecaster, grid_df):
    """All predicted probabilities must be in [0, 1]."""
    window = grid_df.tail(48)
    results = trained_forecaster.predict_24h(window)
    assert len(results) == 24
    for r in results:
        assert 0.0 <= r["p_outage"] <= 1.0, f"p_outage out of range: {r['p_outage']}"
        assert r["lower_bound"] <= r["p_outage"] <= r["upper_bound"]


def test_brier_score_below_baseline(trained_forecaster, grid_df):
    """Brier score must beat the naive baseline of 0.12."""
    holdout = grid_df.tail(30 * 24)
    metrics = trained_forecaster.evaluate(holdout)
    assert metrics["brier_score"] < 0.12, f"Brier {metrics['brier_score']} >= baseline 0.12"


def test_model_save_load(tmp_path, grid_df):
    f = OutageForecaster()
    f.train(grid_df)
    save_path = tmp_path / "model.pkl"
    f.save(save_path)

    f2 = OutageForecaster()
    f2.load(save_path)
    window = grid_df.tail(48)
    results = f2.predict_24h(window)
    assert len(results) == 24
