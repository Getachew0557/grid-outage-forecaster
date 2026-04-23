/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type BusinessType = 'salon' | 'cold_room' | 'tailor';

export interface ForecastPoint {
  hour: number;
  p_outage: number;
  duration_min: number;
  lower_bound: number;
  upper_bound: number;
}

export interface AppliancePlan {
  [appliance: string]: 'ON' | 'OFF';
}

export interface HourlyPlan {
  [hour: number]: AppliancePlan;
}

export interface ForecastData {
  business: BusinessType;
  generatedAt: string;
  forecast: ForecastPoint[];
  plan: HourlyPlan;
  revenue_saved: number;
  total_risk_hours: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'BUSINESS_OWNER';
  businessType?: BusinessType;
}
