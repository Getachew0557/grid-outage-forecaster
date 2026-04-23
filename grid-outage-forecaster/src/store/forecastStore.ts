import { create } from 'zustand';
import { ForecastData, BusinessType } from '../types';

interface ForecastState {
  data: ForecastData | null;
  isLoading: boolean;
  fetchForecast: (business: BusinessType) => Promise<void>;
}

const generateMockForecast = (business: BusinessType): ForecastData => {
  const appliances = business === 'salon' 
    ? ['Hair Dryer', 'Lights', 'TV', 'Clippers']
    : business === 'cold_room'
    ? ['Large Freezer', 'Small Freezer', 'Indoor Lights', 'Security Cam']
    : ['Sewing Machine', 'Iron', 'Lights', 'Cutting Machine'];

  const forecast = Array.from({ length: 24 }, (_, hour) => {
    const p = Math.random();
    // Higher risk in afternoon
    const baseP = (hour >= 14 && hour <= 20) ? 0.3 + p * 0.4 : p * 0.2;
    return {
      hour,
      p_outage: baseP,
      duration_min: 30 + Math.random() * 90,
      lower_bound: Math.max(0, baseP - 0.1),
      upper_bound: Math.min(1, baseP + 0.15),
    };
  });

  const plan: Record<number, Record<string, 'ON' | 'OFF'>> = {};
  forecast.forEach(f => {
    plan[f.hour] = {};
    appliances.forEach((app, idx) => {
      // Critical is usually idx 1 (Lights)
      if (idx === 1) plan[f.hour][app] = 'ON';
      else plan[f.hour][app] = f.p_outage > 0.4 ? 'OFF' : 'ON';
    });
  });

  return {
    business,
    generatedAt: new Date().toISOString(),
    forecast,
    plan,
    revenue_saved: 12000 + Math.random() * 5000,
    total_risk_hours: forecast.filter(f => f.p_outage > 0.3).length,
  };
};

export const useForecastStore = create<ForecastState>((set) => ({
  data: null,
  isLoading: false,
  fetchForecast: async (business) => {
    set({ isLoading: true });
    // Simulate network delay
    await new Promise(r => setTimeout(r, 800));
    set({ data: generateMockForecast(business), isLoading: false });
  },
}));
