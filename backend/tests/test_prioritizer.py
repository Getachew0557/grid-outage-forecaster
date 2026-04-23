"""Tests for AppliancePrioritizer — verifies 'critical before luxury' rule."""
import json
import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.generate_data import APPLIANCES, BUSINESSES
from src.prioritizer import AppliancePrioritizer


@pytest.fixture(scope="module")
def prioritizer(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("data")
    app_path = tmp / "appliances.json"
    biz_path = tmp / "businesses.json"
    app_path.write_text(json.dumps(APPLIANCES))
    biz_path.write_text(json.dumps(BUSINESSES))
    return AppliancePrioritizer(appliances_path=app_path, businesses_path=biz_path)


def _mock_forecast(p_value: float):
    return [{"hour": h, "p_outage": p_value, "duration_min": 60.0,
             "lower_bound": max(0, p_value - 0.1), "upper_bound": min(1, p_value + 0.1)}
            for h in range(24)]


def test_critical_always_on_at_low_risk(prioritizer):
    """At p=0.05, all critical appliances must be ON."""
    result = prioritizer.plan(_mock_forecast(0.05), "cold_room")
    for hour_str, states in result["schedule"].items():
        for name, state in states.items():
            app = next((a for a in APPLIANCES if a["name"] == name), None)
            if app and app["category"] == "critical":
                assert state == "ON", f"Critical '{name}' should be ON at p=0.05, got {state}"


def test_luxury_off_at_medium_risk(prioritizer):
    """At p=0.20, luxury appliances must be OFF."""
    result = prioritizer.plan(_mock_forecast(0.20), "salon")
    for hour_str, states in result["schedule"].items():
        for name, state in states.items():
            app = next((a for a in APPLIANCES if a["name"] == name), None)
            if app and app["category"] == "luxury":
                assert state == "OFF", f"Luxury '{name}' should be OFF at p=0.20, got {state}"


def test_comfort_off_at_high_risk(prioritizer):
    """At p=0.50, comfort appliances must be OFF."""
    result = prioritizer.plan(_mock_forecast(0.50), "salon")
    for hour_str, states in result["schedule"].items():
        for name, state in states.items():
            app = next((a for a in APPLIANCES if a["name"] == name), None)
            if app and app["category"] == "comfort":
                assert state == "OFF", f"Comfort '{name}' should be OFF at p=0.50, got {state}"


def test_critical_shed_above_threshold(prioritizer):
    """At p=0.90 (above P_CRITICAL_SHED=0.80), even critical must be OFF."""
    result = prioritizer.plan(_mock_forecast(0.90), "cold_room")
    for hour_str, states in result["schedule"].items():
        for name, state in states.items():
            assert state == "OFF", f"All appliances should be OFF at p=0.90, '{name}' is {state}"


def test_watt_budget_not_exceeded(prioritizer):
    """Total running watts must never exceed 3000W."""
    app_map = {a["name"]: a for a in APPLIANCES}
    result = prioritizer.plan(_mock_forecast(0.05), "salon")
    for hour_str, states in result["schedule"].items():
        total_w = sum(app_map[n]["watts_avg"] for n, s in states.items() if s == "ON" and n in app_map)
        assert total_w <= 3000, f"Hour {hour_str}: {total_w}W exceeds 3000W budget"


def test_plan_has_24_hours(prioritizer):
    result = prioritizer.plan(_mock_forecast(0.10), "tailor")
    assert len(result["schedule"]) == 24


def test_revenue_saved_non_negative(prioritizer):
    result = prioritizer.plan(_mock_forecast(0.40), "salon")
    assert result["revenue_saved"] >= 0


def test_invalid_business_raises(prioritizer):
    with pytest.raises(ValueError):
        prioritizer.plan(_mock_forecast(0.10), "nonexistent_biz")
