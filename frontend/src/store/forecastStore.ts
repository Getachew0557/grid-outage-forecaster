import { create } from 'zustand';
import { ForecastData, ForecastResponse, MetricsData, BusinessType } from '../types';

const API_BASE = '/api';
const CACHE_KEY = 'gof_forecast_cache';
const MAX_STALE_MS = 6 * 60 * 60 * 1000; // 6 hours

interface ForecastState {
  data: ForecastData | null;
  metrics: MetricsData | null;
  isLoading: boolean;
  isOfflineCache: boolean;
  cacheAge: number | null; // minutes
  error: string | null;
  fetchForecast: (business: BusinessType) => Promise<void>;
  fetchMetrics: () => Promise<void>;
  refreshModel: () => Promise<{ status: string; message: string }>;
}

function cacheKey(business: BusinessType) {
  return `${CACHE_KEY}_${business}`;
}

function saveCache(business: BusinessType, data: ForecastData) {
  try {
    localStorage.setItem(cacheKey(business), JSON.stringify({ ts: Date.now(), data }));
  } catch (_) {}
}

function loadCache(business: BusinessType): { data: ForecastData; ageMin: number } | null {
  try {
    const raw = localStorage.getItem(cacheKey(business));
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > MAX_STALE_MS) return null;
    return { data, ageMin: Math.round((Date.now() - ts) / 60000) };
  } catch (_) {
    return null;
  }
}

function mapResponse(res: ForecastResponse): ForecastData {
  return {
    business: res.business,
    generatedAt: res.generated_at,
    forecast: res.forecast,
    plan: res.plan,
    revenue_saved: res.summary.revenue_saved,
    total_risk_hours: res.summary.critical_hours_count,
    summary: res.summary,
  };
}

export const useForecastStore = create<ForecastState>((set) => ({
  data: null,
  metrics: null,
  isLoading: false,
  isOfflineCache: false,
  cacheAge: null,
  error: null,

  fetchForecast: async (business) => {
    set({ isLoading: true, error: null, isOfflineCache: false, cacheAge: null });
    try {
      const res = await fetch(`${API_BASE}/forecast/${business}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const json: ForecastResponse = await res.json();
      const data = mapResponse(json);
      saveCache(business, data);
      set({ data, isLoading: false });
    } catch (err) {
      // fall back to localStorage cache
      const cached = loadCache(business);
      if (cached) {
        set({
          data: cached.data,
          isLoading: false,
          isOfflineCache: true,
          cacheAge: cached.ageMin,
          error: `Offline — showing ${cached.ageMin}-min-old cache`,
        });
      } else {
        set({
          isLoading: false,
          error: 'Backend unreachable and no cache available. Start: uvicorn src.api:app --reload',
        });
      }
    }
  },

  fetchMetrics: async () => {
    try {
      const res = await fetch(`${API_BASE}/metrics`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return;
      const metrics: MetricsData = await res.json();
      set({ metrics });
    } catch (_) {}
  },

  refreshModel: async () => {
    const res = await fetch(`${API_BASE}/forecast/refresh`, { method: 'POST' });
    return res.json();
  },
}));
