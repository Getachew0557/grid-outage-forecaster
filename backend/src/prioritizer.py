"""
prioritizer.py
Generates appliance ON/OFF schedules based on 24-hour outage forecasts.

Priority rules
--------------
1. Critical  → always ON unless p_outage > 0.80
2. Comfort   → ON only if p_outage < 0.30 AND critical load is satisfied
3. Luxury    → ON only if p_outage < 0.15 AND critical + comfort are satisfied
4. Within each tier, sort by revenue_rwf_per_h (highest first)
5. If total wattage > 3 000 W, shed lowest-revenue appliances first
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

from loguru import logger

BASE_DIR = Path(__file__).resolve().parent.parent

WATT_BUDGET = 3_000          # watts
P_CRITICAL_SHED = 0.80       # shed critical above this
P_COMFORT_ON = 0.30          # comfort allowed below this
P_LUXURY_ON = 0.15           # luxury allowed below this

CATEGORY_ORDER = {"critical": 0, "comfort": 1, "luxury": 2}


class AppliancePrioritizer:
    """
    Generates hourly appliance schedules for a given business type.

    Parameters
    ----------
    appliances_path : path to appliances.json
    businesses_path : path to businesses.json
    """

    def __init__(
        self,
        appliances_path: str | Path = BASE_DIR / "data" / "raw" / "appliances.json",
        businesses_path: str | Path = BASE_DIR / "data" / "raw" / "businesses.json",
    ) -> None:
        self.appliances: List[Dict[str, Any]] = json.loads(Path(appliances_path).read_text())
        self.businesses: Dict[str, Any] = json.loads(Path(businesses_path).read_text())
        # index by name for fast lookup
        self._app_by_name: Dict[str, Dict[str, Any]] = {a["name"]: a for a in self.appliances}

    # ── public API ────────────────────────────────────────────────────────────

    def plan(
        self,
        forecast_24h: List[Dict[str, Any]],
        business_type: str,
    ) -> Dict[str, Any]:
        """
        Generate a 24-hour appliance schedule.

        Parameters
        ----------
        forecast_24h  : list of 24 dicts from OutageForecaster.predict_24h()
        business_type : one of "salon", "cold_room", "tailor"

        Returns
        -------
        dict with keys: business, date, schedule, revenue_saved, critical_hours
        """
        if business_type not in self.businesses:
            raise ValueError(
                f"Unknown business type '{business_type}'. "
                f"Valid: {list(self.businesses.keys())}"
            )

        biz = self.businesses[business_type]
        appliance_names: List[str] = biz["appliances"]
        # keep only appliances that exist in our catalogue
        appliances = [
            self._app_by_name[n]
            for n in appliance_names
            if n in self._app_by_name
        ]

        schedule: Dict[str, Dict[str, str]] = {}
        critical_hours: List[int] = []

        for entry in forecast_24h:
            hour = entry["hour"]
            p = float(entry["p_outage"])
            if p >= 0.50:
                critical_hours.append(hour)
            hourly = self._apply_rules(p, appliances)
            schedule[str(hour)] = hourly

        revenue_saved = self.calculate_revenue_saved(schedule, appliances)

        return {
            "business": business_type,
            "date": date.today().isoformat(),
            "schedule": schedule,
            "revenue_saved": revenue_saved,
            "critical_hours": critical_hours,
        }

    # ── rule engine ───────────────────────────────────────────────────────────

    def _apply_rules(
        self,
        p_outage: float,
        appliances: List[Dict[str, Any]],
    ) -> Dict[str, str]:
        """
        Decide ON/OFF for each appliance at a single hour.

        Rules (in order)
        ----------------
        1. Sort appliances by category priority then revenue (desc).
        2. Critical: ON unless p_outage > P_CRITICAL_SHED.
        3. Comfort:  ON only if p_outage < P_COMFORT_ON.
        4. Luxury:   ON only if p_outage < P_LUXURY_ON.
        5. Enforce watt budget: shed lowest-revenue appliances first.
        """
        # sort: category order first, then revenue descending within category
        sorted_apps = sorted(
            appliances,
            key=lambda a: (CATEGORY_ORDER.get(a["category"], 99), -a["revenue_rwf_per_h"]),
        )

        decisions: Dict[str, str] = {}
        running_watts = 0.0

        for app in sorted_apps:
            cat = app["category"]
            name = app["name"]
            watts = app["watts_avg"]

            # category-level gate
            if cat == "critical":
                eligible = p_outage <= P_CRITICAL_SHED
            elif cat == "comfort":
                eligible = p_outage < P_COMFORT_ON
            else:  # luxury
                eligible = p_outage < P_LUXURY_ON

            # watt budget gate
            if eligible and (running_watts + watts) <= WATT_BUDGET:
                decisions[name] = "ON"
                running_watts += watts
            else:
                decisions[name] = "OFF"

        return decisions

    # ── revenue calculation ───────────────────────────────────────────────────

    def calculate_revenue_saved(
        self,
        schedule: Dict[str, Dict[str, str]],
        appliances: List[Dict[str, Any]],
    ) -> int:
        """
        Compute RWF saved vs naive full-on operation.

        Saved revenue = revenue that would have been lost if we had NOT
        pre-emptively turned off appliances during high-risk hours.
        We count hours where an appliance is OFF as "protected" revenue.
        """
        app_revenue = {a["name"]: a["revenue_rwf_per_h"] for a in appliances}
        saved = 0
        for hour_str, states in schedule.items():
            for name, state in states.items():
                if state == "OFF":
                    # revenue protected by avoiding a potential outage mid-use
                    saved += app_revenue.get(name, 0)
        return int(saved)

    # ── helpers ───────────────────────────────────────────────────────────────

    def list_businesses(self) -> Dict[str, Any]:
        """Return all business archetypes."""
        return self.businesses

    def list_appliances(self) -> List[Dict[str, Any]]:
        """Return all appliance definitions."""
        return self.appliances
