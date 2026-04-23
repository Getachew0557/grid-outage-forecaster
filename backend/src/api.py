"""
api.py
FastAPI server for the Grid Outage Forecaster + Appliance Prioritizer.

Endpoints
---------
GET  /                          – API info
GET  /health                    – Health check
GET  /api/forecast/{business}   – 24-h forecast + appliance plan
GET  /api/forecast/{business}/raw – Raw forecast only
POST /api/forecast/refresh      – Retrain model (admin)
GET  /api/metrics               – Model performance metrics
GET  /api/businesses            – List business archetypes
GET  /api/appliances            – List all appliances
"""

from __future__ import annotations

import os
# Fix xgboost 2.x Windows DLL hang
os.environ.setdefault("OMP_NUM_THREADS", "4")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "4")
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from pydantic import BaseModel

from src.forecaster import OutageForecaster
from src.prioritizer import AppliancePrioritizer

load_dotenv()

# ── paths ─────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = Path(os.getenv("MODEL_PATH", str(BASE_DIR / "models" / "outage_model.pkl")))
DATA_PATH = Path(os.getenv("DATA_PATH", str(BASE_DIR / "data" / "raw")))
CSV_PATH = DATA_PATH / "grid_history.csv"

VALID_BUSINESSES = {"salon", "cold_room", "tailor"}

# ── app ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Grid Outage Forecaster API",
    description="24-hour probabilistic outage forecast + appliance prioritization for SMEs",
    version="1.0.0",
)

cors_origins = os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── singletons (loaded once at startup) ──────────────────────────────────────
forecaster: OutageForecaster = OutageForecaster()
prioritizer: Optional[AppliancePrioritizer] = None
_model_loaded: bool = False
_metrics_cache: Optional[Dict[str, Any]] = None


@app.on_event("startup")
async def startup_event() -> None:
    """Load model and prioritizer at startup."""
    global forecaster, prioritizer, _model_loaded
    try:
        if MODEL_PATH.exists():
            forecaster.load(MODEL_PATH)
            _model_loaded = True
            logger.info("Model loaded at startup.")
        else:
            logger.warning(f"Model not found at {MODEL_PATH}. Train first.")
    except Exception as exc:
        logger.error(f"Failed to load model: {exc}")

    try:
        prioritizer = AppliancePrioritizer(
            appliances_path=DATA_PATH / "appliances.json",
            businesses_path=DATA_PATH / "businesses.json",
        )
        logger.info("Prioritizer loaded at startup.")
    except Exception as exc:
        logger.error(f"Failed to load prioritizer: {exc}")


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ForecastHour(BaseModel):
    hour: int
    p_outage: float
    duration_min: float
    lower_bound: float
    upper_bound: float
    risk_level: str


class ForecastSummary(BaseModel):
    max_risk: float
    max_risk_hour: int
    total_expected_downtime: float
    revenue_saved: int
    critical_hours_count: int


class ForecastResponse(BaseModel):
    business: str
    generated_at: str
    forecast: List[ForecastHour]
    plan: Dict[str, Dict[str, str]]
    summary: ForecastSummary


class MetricsResponse(BaseModel):
    brier_score: float
    mae_duration: float
    lead_time_minutes: float
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1: Optional[float] = None
    baseline_brier: float = 0.12
    brier_improvement_pct: Optional[str] = None


class RefreshResponse(BaseModel):
    status: str
    message: str
    trace_id: str


# ── helpers ───────────────────────────────────────────────────────────────────

def _risk_level(p: float) -> str:
    if p < 0.20:
        return "low"
    if p < 0.45:
        return "medium"
    if p < 0.65:
        return "high"
    return "critical"


def _get_forecast_window() -> pd.DataFrame:
    """Return the last 48 rows of grid history for feature computation."""
    if not CSV_PATH.exists():
        raise HTTPException(status_code=500, detail="grid_history.csv not found. Run generate_data.py.")
    df = pd.read_csv(CSV_PATH)
    return df.tail(48).reset_index(drop=True)


def _ensure_model() -> None:
    if not _model_loaded or forecaster.clf is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Run: python src/forecaster.py to train.",
        )


def _ensure_prioritizer() -> None:
    if prioritizer is None:
        raise HTTPException(
            status_code=503,
            detail="Prioritizer not loaded. Check data files.",
        )


# ── background retrain ────────────────────────────────────────────────────────

def _retrain_background() -> None:
    """Retrain model in background and reload."""
    global _model_loaded, _metrics_cache
    try:
        logger.info("Background retrain started …")
        df = pd.read_csv(CSV_PATH)
        forecaster.train(df)
        forecaster.save(MODEL_PATH)
        _model_loaded = True
        _metrics_cache = None  # invalidate cache
        logger.info("Background retrain complete.")
    except Exception as exc:
        logger.error(f"Retrain failed: {exc}")


# ── routes ────────────────────────────────────────────────────────────────────

@app.get("/", summary="API info")
async def root() -> Dict[str, Any]:
    """Return API metadata."""
    return {
        "name": "Grid Outage Forecaster API",
        "version": "1.0.0",
        "model_loaded": _model_loaded,
        "endpoints": [
            "/health",
            "/api/forecast/{business_type}",
            "/api/forecast/{business_type}/raw",
            "/api/forecast/refresh",
            "/api/metrics",
            "/api/businesses",
            "/api/appliances",
        ],
    }


@app.get("/health", summary="Health check")
async def health() -> Dict[str, str]:
    """Lightweight liveness probe."""
    return {
        "status": "ok",
        "model": "loaded" if _model_loaded else "not_loaded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/forecast/{business_type}", response_model=ForecastResponse, summary="24-h forecast + plan")
async def get_forecast(business_type: str) -> ForecastResponse:
    """
    Return 24-hour outage forecast and appliance plan for a business archetype.

    Parameters
    ----------
    business_type : salon | cold_room | tailor
    """
    if business_type not in VALID_BUSINESSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid business type '{business_type}'. Valid: {sorted(VALID_BUSINESSES)}",
        )
    _ensure_model()
    _ensure_prioritizer()

    try:
        window = _get_forecast_window()
        raw_forecast = forecaster.predict_24h(window)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Forecast error: {exc}")

    try:
        plan_result = prioritizer.plan(raw_forecast, business_type)  # type: ignore[union-attr]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prioritizer error: {exc}")

    forecast_hours = [
        ForecastHour(
            hour=h["hour"],
            p_outage=h["p_outage"],
            duration_min=h["duration_min"],
            lower_bound=h["lower_bound"],
            upper_bound=h["upper_bound"],
            risk_level=_risk_level(h["p_outage"]),
        )
        for h in raw_forecast
    ]

    max_risk_entry = max(raw_forecast, key=lambda x: x["p_outage"])
    total_downtime = sum(
        h["p_outage"] * h["duration_min"] for h in raw_forecast
    )

    summary = ForecastSummary(
        max_risk=round(max_risk_entry["p_outage"], 4),
        max_risk_hour=max_risk_entry["hour"],
        total_expected_downtime=round(total_downtime, 1),
        revenue_saved=plan_result["revenue_saved"],
        critical_hours_count=len(plan_result["critical_hours"]),
    )

    return ForecastResponse(
        business=business_type,
        generated_at=datetime.now(timezone.utc).isoformat(),
        forecast=forecast_hours,
        plan=plan_result["schedule"],
        summary=summary,
    )


@app.get("/api/forecast/{business_type}/raw", summary="Raw forecast only")
async def get_forecast_raw(business_type: str) -> Dict[str, Any]:
    """Return raw hourly forecast without the appliance plan."""
    if business_type not in VALID_BUSINESSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid business type '{business_type}'. Valid: {sorted(VALID_BUSINESSES)}",
        )
    _ensure_model()

    try:
        window = _get_forecast_window()
        raw_forecast = forecaster.predict_24h(window)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Forecast error: {exc}")

    return {
        "business": business_type,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "forecast": raw_forecast,
    }


@app.post("/api/forecast/refresh", response_model=RefreshResponse, summary="Retrain model")
async def refresh_model(background_tasks: BackgroundTasks) -> RefreshResponse:
    """
    Trigger model retraining in the background.
    Returns immediately; training runs asynchronously (~5-10 min).
    """
    trace_id = str(uuid.uuid4())[:8]
    if not CSV_PATH.exists():
        raise HTTPException(status_code=500, detail="grid_history.csv not found.")
    background_tasks.add_task(_retrain_background)
    logger.info(f"Retrain queued [trace={trace_id}]")
    return RefreshResponse(
        status="queued",
        message="Model retraining started in background. Check /health for status.",
        trace_id=trace_id,
    )


@app.get("/api/metrics", response_model=MetricsResponse, summary="Model performance metrics")
async def get_metrics() -> MetricsResponse:
    """Return Brier score, MAE, and lead time from the held-out evaluation window."""
    global _metrics_cache
    _ensure_model()

    if _metrics_cache is not None:
        return MetricsResponse(**_metrics_cache)

    try:
        df = pd.read_csv(CSV_PATH)
        # use last 30 days as held-out window
        holdout = df.tail(30 * 24)
        metrics = forecaster.evaluate(holdout)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Evaluation error: {exc}")

    baseline = 0.12
    brier = metrics["brier_score"]
    improvement = round((baseline - brier) / baseline * 100, 1) if brier < baseline else 0.0

    _metrics_cache = {
        "brier_score": brier,
        "mae_duration": metrics["mae_duration"],
        "lead_time_minutes": metrics["lead_time_minutes"],
        "baseline_brier": baseline,
        "brier_improvement_pct": f"{improvement}%",
    }
    return MetricsResponse(**_metrics_cache)


@app.get("/api/businesses", summary="List business archetypes")
async def get_businesses() -> Dict[str, Any]:
    """Return all supported business archetypes and their appliance lists."""
    _ensure_prioritizer()
    return prioritizer.list_businesses()  # type: ignore[union-attr]


@app.get("/api/appliances", summary="List all appliances")
async def get_appliances() -> List[Dict[str, Any]]:
    """Return the full appliance catalogue."""
    _ensure_prioritizer()
    return prioritizer.list_appliances()  # type: ignore[union-attr]
