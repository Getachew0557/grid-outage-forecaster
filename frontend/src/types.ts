/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type BusinessType = 'salon' | 'cold_room' | 'tailor';

// Matches GET /api/forecast/{business} → forecast array item
export interface ForecastPoint {
  hour: number;
  p_outage: number;
  duration_min: number;
  lower_bound: number;
  upper_bound: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}

// Matches the plan object: { "0": { "Hair Dryer": "ON", ... }, ... }
export interface AppliancePlan {
  [appliance: string]: 'ON' | 'OFF';
}

export interface HourlyPlan {
  [hour: string]: AppliancePlan;
}

// Matches GET /api/forecast/{business} summary block
export interface ForecastSummary {
  max_risk: number;
  max_risk_hour: number;
  total_expected_downtime: number;
  revenue_saved: number;
  critical_hours_count: number;
}

// Full API response shape
export interface ForecastResponse {
  business: BusinessType;
  generated_at: string;
  forecast: ForecastPoint[];
  plan: HourlyPlan;
  summary: ForecastSummary;
}

// Internal store shape (flattened for convenience)
export interface ForecastData {
  business: BusinessType;
  generatedAt: string;
  forecast: ForecastPoint[];
  plan: HourlyPlan;
  revenue_saved: number;
  total_risk_hours: number;
  summary: ForecastSummary;
}

// GET /api/metrics response
export interface MetricsData {
  brier_score: number;
  mae_duration: number;
  lead_time_minutes: number;
  baseline_brier: number;
  brier_improvement_pct: string;
  precision?: number;
  recall?: number;
  f1?: number;
}

// GET /api/appliances item
export interface Appliance {
  name: string;
  category: 'critical' | 'comfort' | 'luxury';
  watts_avg: number;
  start_up_spike_w: number;
  revenue_rwf_per_h: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'BUSINESS_OWNER';
  businessType?: BusinessType;
}
