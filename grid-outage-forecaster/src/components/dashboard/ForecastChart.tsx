/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { ForecastPoint } from '../../types';

interface ForecastChartProps {
  data: ForecastPoint[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ForecastPoint;
    const pPercent = (data.p_outage * 100).toFixed(0);
    const riskColor = data.p_outage > 0.4 ? 'text-red-500' : data.p_outage > 0.2 ? 'text-yellow-500' : 'text-green-500';

    return (
      <div className="bg-white p-4 border rounded-lg shadow-lg">
        <p className="text-sm font-bold text-neutral-900 mb-2">{label}:00 Hours</p>
        <div className="space-y-1">
          <p className="text-xs flex items-center justify-between gap-4">
            <span>Outage Risk:</span>
            <span className={`font-bold ${riskColor}`}>{pPercent}%</span>
          </p>
          <p className="text-xs flex items-center justify-between gap-4">
            <span>Duration:</span>
            <span className="font-medium">{data.duration_min.toFixed(0)} mins</span>
          </p>
          <hr className="my-2" />
          <p className="text-xs italic text-neutral-500">
            {data.p_outage > 0.4 ? '⚠️ Critical: Unplug non-essentials' : '✅ Stable: Normal operations'}
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export default function ForecastChart({ data }: ForecastChartProps) {
  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis 
            dataKey="hour" 
            tick={{ fontSize: 12, fill: '#6B7280' }} 
            tickFormatter={(val) => `${val}h`}
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
            domain={[0, 1]}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Uncertainty Band (Confidence Interval) */}
          <Area
            type="monotone"
            dataKey="upper_bound"
            stroke="none"
            fill="#3b82f6"
            fillOpacity={0.1}
            key="upper"
          />
          <Area
            type="monotone"
            dataKey="lower_bound"
            stroke="none"
            fill="#f9fafb" // Match background to punch out the bottom
            fillOpacity={1}
            key="lower"
          />
          
          {/* Main Risk Line */}
          <Area
            type="monotone"
            dataKey="p_outage"
            stroke="#3b82f6"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorRisk)"
          />

          <ReferenceLine y={0.3} stroke="#F59E0B" strokeDasharray="5 5" label={{ value: 'Elevated Risk', position: 'right', fill: '#D97706', fontSize: 10 }} />
          <ReferenceLine y={0.6} stroke="#EF4444" strokeDasharray="5 5" label={{ value: 'Critical', position: 'right', fill: '#B91C1C', fontSize: 10 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
