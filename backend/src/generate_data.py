"""
generate_data.py
Generates synthetic datasets for the Grid Outage Forecaster:
  - data/raw/grid_history.csv  (180 days × 24 hours = 4,320 rows)
  - data/raw/appliances.json
  - data/raw/businesses.json
"""

import json
import math
import os
import random
from pathlib import Path

import numpy as np
import pandas as pd

# ── reproducibility ──────────────────────────────────────────────────────────
SEED = 42
np.random.seed(SEED)
random.seed(SEED)

# ── paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# 1.  GRID HISTORY
# ─────────────────────────────────────────────────────────────────────────────

def _sigmoid(x: float) -> float:
    """Numerically stable sigmoid."""
    return 1.0 / (1.0 + math.exp(-max(-500, min(500, x))))


def generate_grid_history(n_days: int = 180, start: str = "2024-01-01") -> pd.DataFrame:
    """
    Generate n_days × 24 rows of synthetic grid telemetry.

    Columns
    -------
    timestamp, load_mw, temp_c, humidity, wind_ms, rain_mm, outage, duration_min
    """
    timestamps = pd.date_range(start=start, periods=n_days * 24, freq="h")
    rows = []

    prev_outage = 0  # track previous hour outage for lag

    for ts in timestamps:
        hour = ts.hour
        dow = ts.dayofweek          # 0=Mon … 6=Sun
        month = ts.month

        # ── load (MW) ────────────────────────────────────────────────────────
        base_load = 100.0
        # daily shape: morning peak 8-10, evening peak 18-20
        morning = 30.0 * math.exp(-0.5 * ((hour - 9) / 1.5) ** 2)
        evening = 40.0 * math.exp(-0.5 * ((hour - 19) / 1.5) ** 2)
        load = base_load + morning + evening
        # Sunday -15 %
        if dow == 6:
            load *= 0.85
        # Rainy season (Nov–May) +20 %
        if month in (11, 12, 1, 2, 3, 4, 5):
            load *= 1.20
        load += np.random.normal(0, 5)          # noise
        load = max(60.0, load)

        # ── weather ──────────────────────────────────────────────────────────
        temp_c = 22 + 6 * math.sin((month - 3) * math.pi / 6) + np.random.normal(0, 2)
        humidity = 60 + 20 * math.sin((month - 1) * math.pi / 6) + np.random.normal(0, 5)
        humidity = float(np.clip(humidity, 20, 100))
        wind_ms = abs(np.random.normal(3, 1.5))
        # rain: higher in rainy season
        rain_base = 2.0 if month in (11, 12, 1, 2, 3, 4, 5) else 0.2
        rain_mm = max(0.0, np.random.exponential(rain_base))

        # ── outage probability ───────────────────────────────────────────────
        load_norm = (load - 100) / 50          # rough normalisation
        rain_norm = min(rain_mm / 5, 1.0)
        hour_sin = math.sin(hour * math.pi / 12)
        logit = -3 + 0.5 * load_norm + 0.3 * rain_norm + 0.2 * hour_sin + 0.15 * prev_outage
        p_outage = _sigmoid(logit)
        # clamp so base rate ≈ 4 %
        p_outage = 0.04 + 0.20 * p_outage      # scale to realistic range

        outage = int(np.random.random() < p_outage)

        # ── duration (minutes) ───────────────────────────────────────────────
        if outage:
            duration_min = float(np.random.lognormal(mean=math.log(90), sigma=0.6))
            duration_min = round(min(duration_min, 480), 1)   # cap at 8 h
        else:
            duration_min = 0.0

        prev_outage = outage

        rows.append({
            "timestamp": ts,
            "load_mw": round(load, 2),
            "temp_c": round(temp_c, 2),
            "humidity": round(humidity, 2),
            "wind_ms": round(wind_ms, 2),
            "rain_mm": round(rain_mm, 3),
            "outage": outage,
            "duration_min": duration_min,
        })

    df = pd.DataFrame(rows)
    return df


# ─────────────────────────────────────────────────────────────────────────────
# 2.  APPLIANCES
# ─────────────────────────────────────────────────────────────────────────────

APPLIANCES = [
    {"name": "Fridge",          "category": "critical", "watts_avg": 150,  "start_up_spike_w": 600,  "revenue_rwf_per_h": 5000},
    {"name": "Freezer",         "category": "critical", "watts_avg": 200,  "start_up_spike_w": 800,  "revenue_rwf_per_h": 8000},
    {"name": "Lighting",        "category": "critical", "watts_avg": 50,   "start_up_spike_w": 50,   "revenue_rwf_per_h": 500},
    {"name": "Sewing Machine",  "category": "critical", "watts_avg": 100,  "start_up_spike_w": 300,  "revenue_rwf_per_h": 3000},
    {"name": "Hair Dryer",      "category": "comfort",  "watts_avg": 1200, "start_up_spike_w": 1200, "revenue_rwf_per_h": 8000},
    {"name": "Fan",             "category": "comfort",  "watts_avg": 50,   "start_up_spike_w": 50,   "revenue_rwf_per_h": 1000},
    {"name": "Water Heater",    "category": "comfort",  "watts_avg": 1500, "start_up_spike_w": 1500, "revenue_rwf_per_h": 2000},
    {"name": "TV",              "category": "luxury",   "watts_avg": 100,  "start_up_spike_w": 100,  "revenue_rwf_per_h": 2000},
    {"name": "Radio",           "category": "luxury",   "watts_avg": 20,   "start_up_spike_w": 20,   "revenue_rwf_per_h": 500},
    {"name": "Air Conditioner", "category": "luxury",   "watts_avg": 1000, "start_up_spike_w": 1500, "revenue_rwf_per_h": 1000},
]


# ─────────────────────────────────────────────────────────────────────────────
# 3.  BUSINESSES
# ─────────────────────────────────────────────────────────────────────────────

BUSINESSES = {
    "salon": {
        "appliances": ["Hair Dryer", "Lighting", "TV", "Radio", "Water Heater"],
        "description": "Hair salon with multiple dryers",
    },
    "cold_room": {
        "appliances": ["Fridge", "Freezer", "Lighting", "Air Conditioner"],
        "description": "Food storage cold room",
    },
    "tailor": {
        "appliances": ["Sewing Machine", "Lighting", "Iron", "Fan", "Radio"],
        "description": "Tailoring shop with sewing machines",
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# 4.  MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    """Generate and persist all synthetic datasets."""
    # grid history
    print("Generating grid_history.csv …")
    df = generate_grid_history(n_days=180)
    csv_path = RAW_DIR / "grid_history.csv"
    df.to_csv(csv_path, index=False)
    print(f"  ✓ {len(df):,} rows → {csv_path}")

    # appliances
    app_path = RAW_DIR / "appliances.json"
    app_path.write_text(json.dumps(APPLIANCES, indent=2))
    print(f"  ✓ {len(APPLIANCES)} appliances → {app_path}")

    # businesses
    biz_path = RAW_DIR / "businesses.json"
    biz_path.write_text(json.dumps(BUSINESSES, indent=2))
    print(f"  ✓ {len(BUSINESSES)} businesses → {biz_path}")

    print("\nAll datasets generated successfully.")


if __name__ == "__main__":
    main()
