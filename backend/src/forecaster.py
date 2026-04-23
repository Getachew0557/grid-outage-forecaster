"""
forecaster.py
Trains a 24-hour probabilistic outage forecaster using XGBoost.

Models
------
- OutageClassifier  : XGBClassifier → P(outage) per hour
- DurationRegressor : XGBRegressor  → E[duration | outage] per hour
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from loguru import logger
from sklearn.metrics import brier_score_loss, mean_absolute_error
from xgboost import XGBClassifier, XGBRegressor

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# Feature engineering
# ─────────────────────────────────────────────────────────────────────────────

def create_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build 30+ time-series features from raw grid telemetry.

    Parameters
    ----------
    df : DataFrame with columns [timestamp, load_mw, temp_c, humidity,
                                  wind_ms, rain_mm, outage, duration_min]

    Returns
    -------
    DataFrame with original columns + engineered features (NaN rows dropped).
    """
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)

    hour = df["timestamp"].dt.hour
    dow = df["timestamp"].dt.dayofweek
    month = df["timestamp"].dt.month

    # ── cyclical time encodings ───────────────────────────────────────────────
    df["hour_sin"] = np.sin(2 * np.pi * hour / 24)
    df["hour_cos"] = np.cos(2 * np.pi * hour / 24)
    df["dow_sin"] = np.sin(2 * np.pi * dow / 7)
    df["dow_cos"] = np.cos(2 * np.pi * dow / 7)
    df["month_sin"] = np.sin(2 * np.pi * month / 12)
    df["month_cos"] = np.cos(2 * np.pi * month / 12)

    # ── flag features ─────────────────────────────────────────────────────────
    df["hour_peak_flag"] = hour.isin(range(8, 11)).astype(int) | hour.isin(range(18, 21)).astype(int)
    df["weekend_flag"] = (dow >= 5).astype(int)
    df["month_rainy_flag"] = month.isin([11, 12, 1, 2, 3, 4, 5]).astype(int)

    # ── load lags ─────────────────────────────────────────────────────────────
    for lag in [1, 2, 3, 6, 12, 24]:
        df[f"load_lag_{lag}"] = df["load_mw"].shift(lag)

    # ── outage lags ───────────────────────────────────────────────────────────
    for lag in [1, 2, 3, 24]:
        df[f"outage_lag_{lag}"] = df["outage"].shift(lag)

    # ── duration lags ─────────────────────────────────────────────────────────
    df["duration_lag_1"] = df["duration_min"].shift(1)
    df["duration_lag_24"] = df["duration_min"].shift(24)

    # ── rolling statistics ────────────────────────────────────────────────────
    df["load_rolling_6h"] = df["load_mw"].shift(1).rolling(6).mean()
    df["load_rolling_24h"] = df["load_mw"].shift(1).rolling(24).mean()
    df["load_rolling_std_6h"] = df["load_mw"].shift(1).rolling(6).std()
    df["outage_rolling_6h"] = df["outage"].shift(1).rolling(6).mean()
    df["outage_rolling_24h"] = df["outage"].shift(1).rolling(24).mean()
    df["rain_rolling_3h"] = df["rain_mm"].shift(1).rolling(3).sum()
    df["rain_rolling_6h"] = df["rain_mm"].shift(1).rolling(6).sum()

    # ── weather features ──────────────────────────────────────────────────────
    df["temp_lag_1"] = df["temp_c"].shift(1)
    df["humidity_lag_1"] = df["humidity"].shift(1)
    df["wind_lag_1"] = df["wind_ms"].shift(1)

    # ── interaction features ──────────────────────────────────────────────────
    df["load_x_rain"] = df["load_mw"] * df["rain_mm"].clip(upper=10)
    df["load_x_peak"] = df["load_mw"] * df["hour_peak_flag"]

    df = df.dropna().reset_index(drop=True)
    return df


FEATURE_COLS: List[str] = [
    "hour_sin", "hour_cos", "dow_sin", "dow_cos", "month_sin", "month_cos",
    "hour_peak_flag", "weekend_flag", "month_rainy_flag",
    "load_mw", "temp_c", "humidity", "wind_ms", "rain_mm",
    "load_lag_1", "load_lag_2", "load_lag_3", "load_lag_6", "load_lag_12", "load_lag_24",
    "outage_lag_1", "outage_lag_2", "outage_lag_3", "outage_lag_24",
    "duration_lag_1", "duration_lag_24",
    "load_rolling_6h", "load_rolling_24h", "load_rolling_std_6h",
    "outage_rolling_6h", "outage_rolling_24h",
    "rain_rolling_3h", "rain_rolling_6h",
    "temp_lag_1", "humidity_lag_1", "wind_lag_1",
    "load_x_rain", "load_x_peak",
]


# ─────────────────────────────────────────────────────────────────────────────
# Forecaster class
# ─────────────────────────────────────────────────────────────────────────────

class OutageForecaster:
    """
    Probabilistic 24-hour grid outage forecaster.

    Attributes
    ----------
    clf : XGBClassifier  – predicts P(outage)
    reg : XGBRegressor   – predicts E[duration | outage]
    feature_cols : list  – ordered feature column names used during training
    """

    def __init__(self) -> None:
        self.clf: Optional[XGBClassifier] = None
        self.reg: Optional[XGBRegressor] = None
        self.feature_cols: List[str] = FEATURE_COLS
        self._brier_score: float = float("nan")
        self._mae_duration: float = float("nan")

    # ── training ──────────────────────────────────────────────────────────────

    def train(self, df: pd.DataFrame, target_col: str = "outage") -> Dict[str, float]:
        """
        Train classifier + regressor on the first 150 days of data.

        Parameters
        ----------
        df         : raw grid history DataFrame
        target_col : binary outage column name

        Returns
        -------
        dict with brier_score and mae_duration on the validation split
        """
        logger.info("Engineering features …")
        feat_df = create_features(df)

        # time-based split: first 150 days train, rest validate
        split_ts = feat_df["timestamp"].min() + pd.Timedelta(days=150)
        train = feat_df[feat_df["timestamp"] < split_ts]
        val = feat_df[feat_df["timestamp"] >= split_ts]

        X_train = train[self.feature_cols]
        y_cls_train = train[target_col].astype(int)
        y_reg_train = train["duration_min"]

        X_val = val[self.feature_cols]
        y_cls_val = val[target_col].astype(int)
        y_reg_val = val["duration_min"]

        # ── classifier ────────────────────────────────────────────────────────
        logger.info(f"Training classifier on {len(train):,} rows …")
        self.clf = XGBClassifier(
            n_estimators=400,
            max_depth=5,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            objective="binary:logistic",
            eval_metric="logloss",
            early_stopping_rounds=30,
            random_state=42,
            n_jobs=-1,
            verbosity=0,
        )
        self.clf.fit(
            X_train, y_cls_train,
            eval_set=[(X_val, y_cls_val)],
            verbose=False,
        )

        # ── regressor (train only on outage hours) ────────────────────────────
        logger.info("Training duration regressor …")
        outage_mask_train = y_cls_train == 1
        outage_mask_val = y_cls_val == 1

        self.reg = XGBRegressor(
            n_estimators=300,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            objective="reg:squarederror",
            eval_metric="mae",
            early_stopping_rounds=20,
            random_state=42,
            n_jobs=-1,
            verbosity=0,
        )
        if outage_mask_train.sum() > 10:
            self.reg.fit(
                X_train[outage_mask_train], y_reg_train[outage_mask_train],
                eval_set=[(X_val[outage_mask_val], y_reg_val[outage_mask_val])]
                if outage_mask_val.sum() > 0 else None,
                verbose=False,
            )
        else:
            # fallback: train on all rows
            self.reg.fit(X_train, y_reg_train, verbose=False)

        # ── validation metrics ────────────────────────────────────────────────
        p_val = self.clf.predict_proba(X_val)[:, 1]
        self._brier_score = float(brier_score_loss(y_cls_val, p_val))

        dur_pred = self.reg.predict(X_val)
        self._mae_duration = float(mean_absolute_error(y_reg_val, dur_pred))

        logger.info(f"Brier score (val): {self._brier_score:.4f}")
        logger.info(f"MAE duration (val): {self._mae_duration:.2f} min")

        return {"brier_score": self._brier_score, "mae_duration": self._mae_duration}

    # ── prediction ────────────────────────────────────────────────────────────

    def predict_24h(self, last_rows: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Predict outage probability and expected duration for the next 24 hours.

        Parameters
        ----------
        last_rows : DataFrame containing at least the last 24 hours of raw
                    telemetry (needed for lag features).

        Returns
        -------
        List of 24 dicts, one per hour:
            {hour, p_outage, duration_min, lower_bound, upper_bound}
        """
        if self.clf is None or self.reg is None:
            raise RuntimeError("Model not trained. Call train() or load() first.")

        feat_df = create_features(last_rows)
        if len(feat_df) == 0:
            raise ValueError("Not enough rows to compute features (need ≥ 25 rows).")

        # use the last 24 feature rows as the forecast window
        window = feat_df.tail(24).reset_index(drop=True)
        X = window[self.feature_cols]

        p_outage = self.clf.predict_proba(X)[:, 1]
        dur_pred = self.reg.predict(X)

        results = []
        for i in range(len(window)):
            p = float(np.clip(p_outage[i], 0.0, 1.0))
            d = float(max(0.0, dur_pred[i]))
            # simple uncertainty bands (±1 std approximation)
            margin = float(np.clip(p * 0.4, 0.02, 0.3))
            results.append({
                "hour": int(window.loc[i, "timestamp"].hour) if "timestamp" in window.columns else i,
                "p_outage": round(p, 4),
                "duration_min": round(d, 1),
                "lower_bound": round(max(0.0, p - margin), 4),
                "upper_bound": round(min(1.0, p + margin), 4),
            })

        return results

    # ── persistence ───────────────────────────────────────────────────────────

    def save(self, path: str | Path) -> None:
        """Persist both models and metadata to a single joblib file."""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "clf": self.clf,
            "reg": self.reg,
            "feature_cols": self.feature_cols,
            "brier_score": self._brier_score,
            "mae_duration": self._mae_duration,
        }
        joblib.dump(payload, path)
        logger.info(f"Model saved → {path}")

    def load(self, path: str | Path) -> None:
        """Load models from a joblib file produced by save()."""
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"Model file not found: {path}")
        payload = joblib.load(path)
        self.clf = payload["clf"]
        self.reg = payload["reg"]
        self.feature_cols = payload.get("feature_cols", FEATURE_COLS)
        self._brier_score = payload.get("brier_score", float("nan"))
        self._mae_duration = payload.get("mae_duration", float("nan"))
        logger.info(f"Model loaded ← {path}")

    # ── evaluation ────────────────────────────────────────────────────────────

    def evaluate(self, holdout_df: pd.DataFrame) -> Dict[str, Any]:
        """
        Evaluate model on a held-out DataFrame.

        Returns
        -------
        dict with brier_score, mae_duration, and lead_time_minutes
        """
        if self.clf is None or self.reg is None:
            raise RuntimeError("Model not trained.")

        feat_df = create_features(holdout_df)
        X = feat_df[self.feature_cols]
        y_cls = feat_df["outage"].astype(int)
        y_dur = feat_df["duration_min"]

        p_pred = self.clf.predict_proba(X)[:, 1]
        dur_pred = self.reg.predict(X)

        brier = float(brier_score_loss(y_cls, p_pred))
        mae = float(mean_absolute_error(y_dur, dur_pred))

        # lead time: for each true outage, find the earliest preceding hour
        # where p_outage > 0.3 within a 6-hour look-ahead window
        lead_times: List[float] = []
        p_series = pd.Series(p_pred, index=feat_df.index)
        for idx in feat_df.index[y_cls == 1]:
            window_start = max(feat_df.index[0], idx - 6)
            window = p_series.loc[window_start:idx - 1]
            flagged = window[window > 0.3]
            if len(flagged) > 0:
                lead_times.append((idx - flagged.index[-1]) * 60)  # hours → minutes

        lead_time = float(np.mean(lead_times)) if lead_times else 0.0

        return {
            "brier_score": round(brier, 4),
            "mae_duration": round(mae, 2),
            "lead_time_minutes": round(lead_time, 1),
        }


# ─────────────────────────────────────────────────────────────────────────────
# CLI helper
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    csv_path = BASE_DIR / "data" / "raw" / "grid_history.csv"
    if not csv_path.exists():
        raise FileNotFoundError("Run generate_data.py first.")

    df = pd.read_csv(csv_path)
    forecaster = OutageForecaster()
    metrics = forecaster.train(df)
    forecaster.save(MODEL_DIR / "outage_model.pkl")
    print(f"Training complete: {metrics}")
