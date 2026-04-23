"""
evaluate.py
Standalone evaluation script for the Grid Outage Forecaster.

Metrics computed on a 30-day held-out window
--------------------------------------------
- Brier Score        : target < 0.10
- MAE Duration       : target < 30 min
- Lead Time          : target > 60 min
- Precision / Recall / F1 at threshold 0.30
- Confusion matrix
- Baseline comparison (always-predict-mean)
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import pandas as pd
from loguru import logger
from sklearn.metrics import (
    brier_score_loss,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    precision_score,
    recall_score,
)

from src.forecaster import OutageForecaster, create_features, FEATURE_COLS

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "outage_model.pkl"
CSV_PATH = BASE_DIR / "data" / "raw" / "grid_history.csv"
THRESHOLD = 0.30
HOLDOUT_DAYS = 30


def evaluate_model(
    model_path: Path = MODEL_PATH,
    csv_path: Path = CSV_PATH,
    holdout_days: int = HOLDOUT_DAYS,
    threshold: float = THRESHOLD,
) -> Dict[str, Any]:
    """
    Evaluate the trained model on the last `holdout_days` of data.

    Parameters
    ----------
    model_path   : path to saved joblib model
    csv_path     : path to grid_history.csv
    holdout_days : number of days to use as held-out test set
    threshold    : probability threshold for binary classification metrics

    Returns
    -------
    dict with all evaluation metrics
    """
    # ── load data ─────────────────────────────────────────────────────────────
    logger.info(f"Loading data from {csv_path} …")
    df = pd.read_csv(csv_path)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)

    # ── load model ────────────────────────────────────────────────────────────
    logger.info(f"Loading model from {model_path} …")
    forecaster = OutageForecaster()
    forecaster.load(model_path)

    # ── held-out split ────────────────────────────────────────────────────────
    split_ts = df["timestamp"].max() - pd.Timedelta(days=holdout_days)
    holdout_raw = df[df["timestamp"] > split_ts].copy()
    # include 24 rows before holdout for lag features
    context_start = split_ts - pd.Timedelta(hours=24)
    context_df = df[df["timestamp"] > context_start].copy()

    logger.info(f"Holdout window: {holdout_raw['timestamp'].min()} → {holdout_raw['timestamp'].max()}")
    logger.info(f"Holdout rows: {len(holdout_raw):,}")

    # ── feature engineering ───────────────────────────────────────────────────
    feat_df = create_features(context_df)
    # keep only holdout rows
    feat_holdout = feat_df[feat_df["timestamp"] > split_ts].copy()

    X = feat_holdout[FEATURE_COLS]
    y_true = feat_holdout["outage"].astype(int).values
    y_dur_true = feat_holdout["duration_min"].values

    # ── predictions ───────────────────────────────────────────────────────────
    p_pred = forecaster.clf.predict_proba(X)[:, 1]  # type: ignore[union-attr]
    dur_pred = forecaster.reg.predict(X)             # type: ignore[union-attr]
    y_pred_bin = (p_pred >= threshold).astype(int)

    # ── Brier score ───────────────────────────────────────────────────────────
    brier = float(brier_score_loss(y_true, p_pred))
    baseline_p = float(y_true.mean())
    baseline_brier = float(brier_score_loss(y_true, np.full_like(p_pred, baseline_p)))
    brier_improvement = (baseline_brier - brier) / baseline_brier * 100 if baseline_brier > 0 else 0.0

    # ── MAE duration ──────────────────────────────────────────────────────────
    mae_all = float(mean_absolute_error(y_dur_true, dur_pred))
    # MAE only on actual outage hours
    outage_mask = y_true == 1
    mae_outage = (
        float(mean_absolute_error(y_dur_true[outage_mask], dur_pred[outage_mask]))
        if outage_mask.sum() > 0
        else float("nan")
    )
    baseline_mae = float(mean_absolute_error(y_dur_true, np.full_like(dur_pred, y_dur_true.mean())))
    mae_improvement = (baseline_mae - mae_all) / baseline_mae * 100 if baseline_mae > 0 else 0.0

    # ── lead time ─────────────────────────────────────────────────────────────
    lead_times: List[float] = []
    p_series = pd.Series(p_pred, index=feat_holdout.index)
    for idx in feat_holdout.index[feat_holdout["outage"] == 1]:
        window_start = max(feat_holdout.index[0], idx - 6)
        window = p_series.loc[window_start : idx - 1]
        flagged = window[window >= threshold]
        if len(flagged) > 0:
            lead_times.append((idx - flagged.index[-1]) * 60)

    lead_time_mean = float(np.mean(lead_times)) if lead_times else 0.0

    # ── classification metrics ────────────────────────────────────────────────
    precision = float(precision_score(y_true, y_pred_bin, zero_division=0))
    recall = float(recall_score(y_true, y_pred_bin, zero_division=0))
    f1 = float(f1_score(y_true, y_pred_bin, zero_division=0))
    cm = confusion_matrix(y_true, y_pred_bin).tolist()

    # ── assemble results ──────────────────────────────────────────────────────
    results: Dict[str, Any] = {
        "holdout_days": holdout_days,
        "holdout_rows": int(len(feat_holdout)),
        "outage_rate": round(float(y_true.mean()), 4),
        "threshold": threshold,
        "brier_score": round(brier, 4),
        "baseline_brier": round(baseline_brier, 4),
        "mae_duration_all": round(mae_all, 2),
        "mae_duration_outage_only": round(mae_outage, 2) if not np.isnan(mae_outage) else None,
        "lead_time_minutes": round(lead_time_mean, 1),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "confusion_matrix": cm,
        "baseline_comparison": {
            "brier_improvement": f"{brier_improvement:.1f}%",
            "mae_improvement": f"{mae_improvement:.1f}%",
        },
        "targets_met": {
            "brier_lt_010": brier < 0.10,
            "mae_lt_30min": mae_all < 30,
            "lead_time_gt_60min": lead_time_mean > 60,
        },
    }

    return results


def print_report(metrics: Dict[str, Any]) -> None:
    """Pretty-print evaluation results to stdout."""
    print("\n" + "=" * 55)
    print("  GRID OUTAGE FORECASTER — EVALUATION REPORT")
    print("=" * 55)
    print(f"  Holdout window : last {metrics['holdout_days']} days ({metrics['holdout_rows']:,} rows)")
    print(f"  Outage rate    : {metrics['outage_rate']:.1%}")
    print(f"  Threshold      : {metrics['threshold']}")
    print()
    print("  PROBABILISTIC METRICS")
    print(f"  Brier Score    : {metrics['brier_score']:.4f}  (baseline {metrics['baseline_brier']:.4f})")
    print(f"  Improvement    : {metrics['baseline_comparison']['brier_improvement']}")
    print(f"  Target < 0.10  : {'✓ PASS' if metrics['targets_met']['brier_lt_010'] else '✗ FAIL'}")
    print()
    print("  DURATION METRICS")
    print(f"  MAE (all)      : {metrics['mae_duration_all']:.1f} min")
    print(f"  MAE (outages)  : {metrics['mae_duration_outage_only']} min")
    print(f"  Improvement    : {metrics['baseline_comparison']['mae_improvement']}")
    print(f"  Target < 30min : {'✓ PASS' if metrics['targets_met']['mae_lt_30min'] else '✗ FAIL'}")
    print()
    print("  LEAD TIME")
    print(f"  Mean lead time : {metrics['lead_time_minutes']:.1f} min")
    print(f"  Target > 60min : {'✓ PASS' if metrics['targets_met']['lead_time_gt_60min'] else '✗ FAIL'}")
    print()
    print("  CLASSIFICATION  (threshold = {:.2f})".format(metrics["threshold"]))
    print(f"  Precision      : {metrics['precision']:.3f}")
    print(f"  Recall         : {metrics['recall']:.3f}")
    print(f"  F1 Score       : {metrics['f1']:.3f}")
    cm = metrics["confusion_matrix"]
    print(f"  Confusion matrix:")
    print(f"    TN={cm[0][0]:4d}  FP={cm[0][1]:4d}")
    print(f"    FN={cm[1][0]:4d}  TP={cm[1][1]:4d}")
    print("=" * 55 + "\n")


if __name__ == "__main__":
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model not found at {MODEL_PATH}. Train first.")
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"Data not found at {CSV_PATH}. Run generate_data.py first.")

    metrics = evaluate_model()
    print_report(metrics)

    # save JSON report
    report_path = BASE_DIR / "data" / "processed" / "eval_report.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(metrics, indent=2))
    print(f"Report saved → {report_path}")
