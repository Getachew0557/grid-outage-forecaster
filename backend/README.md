# Grid Outage Forecaster + Appliance Prioritizer
**Challenge:** T2.3 · AIMS KTT Hackathon · EnergyTech · Tier 2

> 24-hour probabilistic grid outage forecast + appliance load-shed plan for SMEs (salons, cold rooms, tailors).

---

## Setup — 2 Commands

```bash
pip install -r requirements.txt
python src/generate_data.py
```

## Train Model

```bash
python src/forecaster.py
```

## Run API

```bash
uvicorn src.api:app --reload
```

API available at `http://localhost:8000`  
Interactive docs: `http://localhost:8000/docs`

## Open Lite UI

Open `lite_ui.html` directly in a browser (no server needed):
```bash
# Windows
start lite_ui.html

# macOS / Linux
open lite_ui.html
```

The page auto-fetches from the running API and falls back to localStorage cache when offline.

## Run Evaluation

```bash
python src/evaluate.py
```

Or open `notebooks/eval.ipynb` in Jupyter:
```bash
jupyter notebook notebooks/eval.ipynb
```

## Run Tests

```bash
pytest tests/ -v
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API info |
| GET | `/health` | Health check |
| GET | `/api/forecast/{business}` | 24-h forecast + appliance plan |
| GET | `/api/forecast/{business}/raw` | Raw forecast only |
| POST | `/api/forecast/refresh` | Retrain model (background) |
| GET | `/api/metrics` | Brier score, MAE, lead time |
| GET | `/api/businesses` | List business archetypes |
| GET | `/api/appliances` | List all appliances |

**Valid business types:** `salon`, `cold_room`, `tailor`

### Example

```bash
curl http://localhost:8000/api/forecast/salon
curl http://localhost:8000/api/metrics
curl http://localhost:8000/health
```

---

## Model Performance

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Brier Score | ~0.087 | < 0.10 | ✓ PASS |
| MAE Duration | ~24.5 min | < 30 min | ✓ PASS |
| Lead Time | ~75 min | > 60 min | ✓ PASS |
| Baseline Brier | 0.12 | — | — |
| Improvement | ~27.5% | > 15% | ✓ PASS |

---

## Project Structure

```
backend/
├── src/
│   ├── __init__.py
│   ├── generate_data.py    # Synthetic dataset generator
│   ├── forecaster.py       # XGBoost probabilistic forecaster
│   ├── prioritizer.py      # Appliance ON/OFF rule engine
│   ├── api.py              # FastAPI server
│   └── evaluate.py         # Brier score, MAE, lead time
├── data/
│   ├── raw/
│   │   ├── grid_history.csv
│   │   ├── appliances.json
│   │   └── businesses.json
│   └── processed/
│       └── eval_report.json
├── models/
│   └── outage_model.pkl
├── tests/
│   ├── test_forecaster.py
│   ├── test_prioritizer.py
│   └── test_api.py
├── notebooks/
│   └── eval.ipynb
├── lite_ui.html            # Static 50KB forecast UI
├── digest_spec.md          # Product & Business artifact
├── process_log.md          # Hour-by-hour timeline + LLM declaration
├── SIGNED.md               # Honor code
├── requirements.txt
└── .env.example
```

---

## Reproducible on Google Colab (CPU)

```python
# Cell 1
!git clone <your-repo-url>
%cd backend
!pip install -r requirements.txt

# Cell 2
!python src/generate_data.py
!python src/forecaster.py
!python src/evaluate.py
```

Training completes in **< 5 minutes** on a free Colab CPU instance.

---

## Prioritizer Rules

The `AppliancePrioritizer.plan()` method enforces:

1. **Critical** appliances (Fridge, Freezer, Lighting, Sewing Machine): always ON unless `p_outage > 0.80`
2. **Comfort** appliances (Hair Dryer, Fan, Water Heater): ON only if `p_outage < 0.30`
3. **Luxury** appliances (TV, Radio, Air Conditioner): ON only if `p_outage < 0.15`
4. Within each tier: sorted by `revenue_rwf_per_h` descending (highest revenue gets priority)
5. Watt budget: 3,000W cap — lowest-revenue appliances shed first if exceeded

---

## 4-Minute Video

[YouTube link — add before submission]

---

## License

MIT
