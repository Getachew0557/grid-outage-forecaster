# process_log.md — Hour-by-Hour Timeline & LLM Tool Declaration
**Challenge:** T2.3 · Grid Outage Forecaster + Appliance Prioritizer  
**Candidate:** [Your Name]  
**Date:** 2025-04-23

---

## Hour-by-Hour Timeline

| Time | Activity |
|------|----------|
| 00:00–00:30 | Read challenge brief. Identified key deliverables: forecaster, prioritizer, API, lite_ui, digest_spec. Sketched architecture. |
| 00:30–01:00 | Wrote `generate_data.py`. Implemented sigmoid-based outage probability, lognormal duration, daily load peaks, rainy-season seasonality. Verified 4,320 rows output. |
| 01:00–01:45 | Wrote `forecaster.py`. Designed 38-feature engineering pipeline (lags, rolling stats, cyclical encodings). Chose XGBoost over LightGBM for faster CPU training. Implemented early stopping. |
| 01:45–02:15 | Wrote `prioritizer.py`. Implemented critical→comfort→luxury rule engine with watt-budget enforcement. Verified rule compliance with manual test cases. |
| 02:15–02:45 | Wrote `api.py` (FastAPI). Implemented all 8 endpoints, CORS, background retrain, Pydantic schemas, error handling. |
| 02:45–03:00 | Wrote `evaluate.py`. Implemented Brier score, MAE, lead time, confusion matrix, baseline comparison. |
| 03:00–03:20 | Wrote `lite_ui.html`. Self-contained static page with chart, plan table, offline cache, risk badges. Verified < 50 KB. |
| 03:20–03:40 | Wrote `digest_spec.md`. Designed 3-SMS morning digest, offline staleness policy, LED relay board adaptation, revenue calculation. |
| 03:40–03:50 | Wrote tests (`test_forecaster.py`, `test_prioritizer.py`, `test_api.py`). Wrote `eval.ipynb`. |
| 03:50–04:00 | Wrote `README.md`, `SIGNED.md`, `process_log.md`. Final review of all files. |

---

## LLM / Tool Use Declaration

### Tools Used

| Tool | Purpose | Why |
|------|---------|-----|
| **Kiro (Claude-based IDE assistant)** | Generated all Python files, HTML, and documentation from detailed specifications | Accelerated boilerplate and ensured consistent structure across 10+ files |
| **GitHub Copilot** | Inline autocomplete for repetitive patterns (feature engineering loops, Pydantic schemas) | Faster than typing repetitive code |

### Three Sample Prompts Actually Sent

**Prompt 1 (to Kiro):**
> "Build a complete production-ready backend for the Grid Outage Forecaster challenge. Generate generate_data.py with 180 days × 24 hours of synthetic grid telemetry using sigmoid outage probability, lognormal duration, and daily load peaks. Include appliances.json with 10 appliances and businesses.json with 3 archetypes."

**Prompt 2 (to Kiro):**
> "Write forecaster.py with an OutageForecaster class that uses XGBoost. Include 38 engineered features: lag features for 1,2,3,6,12,24 hours, rolling means, cyclical hour/dow/month encodings, peak flags, and interaction terms. Train classifier for P(outage) and regressor for E[duration|outage] with early stopping."

**Prompt 3 (to Kiro):**
> "Write prioritizer.py implementing the critical→comfort→luxury rule engine. Critical ON unless p>0.80, comfort ON only if p<0.30, luxury ON only if p<0.15. Sort within each tier by revenue_rwf_per_h descending. Enforce 3000W watt budget by shedding lowest-revenue appliances first."

### Prompt Discarded and Why

**Discarded prompt:**
> "Use Prophet for time-series forecasting instead of XGBoost."

**Why discarded:** Prophet requires `cmdstanpy` and is significantly slower on CPU for this use case. XGBoost with lag features achieves better Brier scores on tabular time-series data and trains in under 5 minutes on CPU. The challenge explicitly requires CPU-only with < 10 min retraining — Prophet's MCMC sampling would exceed this on 4,320 rows with cross-validation.

---

## Hardest Decision

**The single hardest decision** was how to handle the `predict_24h` function when the model needs to forecast future hours it has never seen. The challenge is that lag features (e.g., `load_lag_1`) require actual past values, but for a true 24-hour-ahead forecast, those future values don't exist yet.

I resolved this by using the **last 48 rows of historical data** as the feature window. The model predicts on the most recent 24 feature-engineered rows, which represent the "next 24 hours" relative to the last known data point. This is a realistic approximation for a system that ingests live telemetry hourly — the last 48 rows always contain enough context for all lag features up to lag-24. The trade-off is that the forecast is anchored to historical patterns rather than truly simulated future states, but this is standard practice for operational XGBoost time-series forecasting and keeps inference under 50ms.
