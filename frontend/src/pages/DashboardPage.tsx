/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuthStore } from '../store/authStore';
import { useForecastStore } from '../store/forecastStore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  Zap, LogOut, RefreshCw, TrendingUp, Clock, AlertTriangle,
  Volume2, WifiOff, User as UserIcon, ChevronRight, Activity,
  Settings, Phone, CheckCircle2,
} from 'lucide-react';
import ForecastChart from '../components/dashboard/ForecastChart';
import SMSDigestModal from '../components/dashboard/SMSDigestModal';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { data, isLoading, isOfflineCache, cacheAge, error, fetchForecast } = useForecastStore();
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    if (user?.businessType) fetchForecast(user.businessType);
    const up = () => setIsOnline(true);
    const dn = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', dn);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', dn); };
  }, [user, fetchForecast]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const readForecast = () => {
    if (!data) return;
    setIsReading(true);
    const worst = data.forecast.reduce((a, b) => a.p_outage > b.p_outage ? a : b);
    const msg = new SpeechSynthesisUtterance(
      worst.p_outage > 0.15
        ? `Warning: At ${worst.hour} hundred hours, outage risk is ${(worst.p_outage * 100).toFixed(0)} percent. Turn off non-essential appliances.`
        : `Grid is stable today. No major outages expected.`
    );
    msg.onend = () => setIsReading(false);
    window.speechSynthesis.speak(msg);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Fetching forecast from backend…</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Backend not reachable</h2>
          <p className="text-slate-500 text-sm mb-4">{error}</p>
          <code className="block bg-slate-800 text-green-400 text-xs p-3 rounded-lg text-left">
            cd backend<br />
            uvicorn src.api:app --reload
          </code>
          <Button className="mt-4" onClick={() => user?.businessType && fetchForecast(user.businessType)}>
            <RefreshCw className="w-4 h-4 mr-2" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  const maxRisk = data.summary.max_risk;
  const riskLabel = maxRisk > 0.45 ? 'High' : maxRisk > 0.2 ? 'Medium' : 'Low';
  const riskColor = riskLabel === 'High' ? 'text-red-600' : riskLabel === 'Medium' ? 'text-amber-600' : 'text-emerald-600';

  return (
    <div className="min-h-screen grid grid-cols-[220px_1fr] bg-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="bg-slate-800 text-slate-100 p-6 flex flex-col gap-8">
        <div className="flex items-center gap-2 text-primary font-extrabold text-xl tracking-tighter">
          <Zap className="w-6 h-6 fill-current" />
          <span>GRIDFORECAST</span>
        </div>
        <nav className="flex flex-col gap-1.5 flex-grow">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 text-white text-sm font-semibold cursor-default">
            <Activity className="w-4 h-4" /> Dashboard
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 text-sm cursor-pointer transition-colors">
            <Clock className="w-4 h-4" /> History
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 text-sm cursor-pointer transition-colors">
            <Zap className="w-4 h-4" /> Appliances
          </div>
          {user?.role === 'SUPER_ADMIN' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 text-sm cursor-pointer transition-colors"
              onClick={() => navigate('/admin')}>
              <CheckCircle2 className="w-4 h-4" /> Admin Panel
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 text-sm cursor-pointer transition-colors">
            <Settings className="w-4 h-4" /> Settings
          </div>
        </nav>
        <div className="mt-auto">
          <div className="p-3 bg-slate-700/50 rounded-xl space-y-1 text-xs text-slate-400">
            <p className="font-bold uppercase tracking-wider text-[10px]">Cache Status</p>
            {isOfflineCache
              ? <p className="text-amber-400">⚠ Offline · {cacheAge}min old</p>
              : <p className="text-emerald-400">✓ Live data</p>}
          </div>
          <Button variant="ghost" onClick={handleLogout}
            className="w-full justify-start mt-3 text-slate-400 hover:text-white hover:bg-slate-700">
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col h-screen overflow-auto">
        {/* Header */}
        <header className="h-16 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              {data.business.replace('_', ' ').toUpperCase()}
              <ChevronRight className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500 font-normal text-sm">Kigali Central</span>
            </h2>
            <p className="text-xs text-slate-500">
              {isOfflineCache
                ? `⚠ Cached forecast · ${cacheAge} min ago · max staleness 6h`
                : `Live · updated ${new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isOfflineCache || !isOnline ? (
              <span className="flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
                <WifiOff className="w-3 h-3" /> OFFLINE
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
              </span>
            )}
            <Button size="sm" className="h-9 px-4 font-bold" onClick={readForecast} disabled={isReading}>
              <Volume2 className={`w-4 h-4 mr-2 ${isReading ? 'animate-pulse' : ''}`} />
              Read Aloud
            </Button>
            <Button size="sm" variant="outline" className="h-9"
              onClick={() => user?.businessType && fetchForecast(user.businessType)}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
              <UserIcon className="w-5 h-5" />
            </div>
          </div>
        </header>

        <main className="p-6 space-y-5">
          {/* Metrics row */}
          <div className="grid grid-cols-4 gap-4">
            {[
              {
                label: 'Peak Outage Risk',
                value: `${(maxRisk * 100).toFixed(0)}%`,
                sub: riskLabel,
                color: riskColor,
              },
              {
                label: 'Expected Downtime',
                value: `${Math.round(data.summary.total_expected_downtime)} min`,
                sub: `worst @ ${data.summary.max_risk_hour}:00`,
                color: 'text-slate-800',
              },
              {
                label: 'Revenue Protected',
                value: `${data.revenue_saved.toLocaleString()} RWF`,
                sub: 'vs naive full-on',
                color: 'text-emerald-600',
              },
              {
                label: 'Critical Hours',
                value: `${data.total_risk_hours}`,
                sub: 'p_outage > 0.50',
                color: 'text-slate-800',
              },
            ].map((m) => (
              <Card key={m.label} className="bg-white border border-slate-200 rounded-xl shadow-sm">
                <CardContent className="pt-4 pb-4">
                  <p className="text-[0.68rem] uppercase font-bold text-slate-500 tracking-wider">{m.label}</p>
                  <div className={`text-2xl font-extrabold mt-1 ${m.color}`}>{m.value}</div>
                  <p className="text-[0.68rem] text-slate-400 mt-0.5">{m.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Chart row */}
          <div className="grid grid-cols-[1fr_260px] gap-4">
            <Card className="bg-white border border-slate-200 rounded-xl shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-800">24h Outage Probability + Confidence Band</span>
                  <div className="flex items-center gap-4 text-[0.65rem] font-bold tracking-wider text-slate-400">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> P(Outage)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-200" /> Confidence</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ForecastChart data={data.forecast} />
              </CardContent>
            </Card>

            <Card className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col items-center justify-center text-center p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <TrendingUp className="w-32 h-32" />
              </div>
              <div className="text-3xl mb-2">💰</div>
              <h3 className="font-bold text-slate-800">Revenue Impact</h3>
              <div className="text-3xl font-black text-emerald-500 my-2">
                {data.revenue_saved > 0 ? `+${data.revenue_saved.toLocaleString()}` : '0'} RWF
              </div>
              <p className="text-xs text-slate-500 leading-relaxed max-w-[180px]">
                Saved vs naive full-on operation today
              </p>
              <Button size="sm" variant="outline" className="mt-5 font-bold w-full h-9 border-slate-200 text-slate-600"
                onClick={() => setIsSmsModalOpen(true)}>
                <Phone className="w-4 h-4 mr-2" /> SMS Digest
              </Button>
            </Card>
          </div>

          {/* Plan table + SMS preview */}
          <div className="grid grid-cols-[1.5fr_1fr] gap-4">
            {/* Appliance plan table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <span className="font-bold text-slate-800 text-sm">Appliance Plan — Business Hours (8:00–20:00)</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50 border-slate-200">
                    <TableHead className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Hour</TableHead>
                    <TableHead className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Risk</TableHead>
                    {Object.keys(data.plan['8'] || data.plan[Object.keys(data.plan)[0]] || {}).slice(0, 4).map(app => (
                      <TableHead key={app} className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">
                        {app.length > 10 ? app.slice(0, 9) + '…' : app}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 12 }, (_, i) => i + 8).map((h) => {
                    const hourStr = String(h);
                    const fc = data.forecast.find(f => f.hour === h);
                    const plan = data.plan[hourStr] || {};
                    const p = fc?.p_outage ?? 0;
                    const isHigh = p > 0.45;
                    const isMed = p > 0.2 && p <= 0.45;
                    const appliances = Object.keys(plan).slice(0, 4);
                    return (
                      <TableRow key={h} className="border-slate-50 hover:bg-slate-50/50">
                        <TableCell className="font-bold text-slate-800 py-2.5">{h}:00</TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded text-[0.68rem] font-black uppercase
                            ${isHigh ? 'bg-red-100 text-red-600' : isMed ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-600'}`}>
                            {(p * 100).toFixed(0)}% {fc?.risk_level?.toUpperCase() ?? 'LOW'}
                          </span>
                        </TableCell>
                        {appliances.map(app => (
                          <TableCell key={app} className="text-xs font-medium">
                            {plan[app] === 'ON'
                              ? <span className="text-emerald-600">✓ ON</span>
                              : <span className="text-red-400">✗ OFF</span>}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* SMS preview panel */}
            <div className="bg-slate-900 rounded-xl p-4 flex flex-col gap-4 shadow-lg text-white">
              <div className="flex justify-between items-center px-1">
                <span className="font-bold text-sm">Morning SMS Digest</span>
                <span className="bg-slate-800 text-[0.6rem] font-black px-2 py-0.5 rounded text-slate-400 border border-slate-700">
                  3 × 160 CHARS
                </span>
              </div>
              <div className="space-y-3">
                <div className="bg-slate-800 p-3 rounded-lg border border-slate-700/50">
                  <div className="text-[0.6rem] uppercase font-black text-primary mb-1 tracking-widest">SMS 1/3 — RISK ALERT</div>
                  <p className="text-[0.7rem] leading-relaxed text-slate-200">
                    GRID ALERT {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}: 
                    {maxRisk > 0.2 ? ` HIGH risk ${data.summary.max_risk_hour}h. Expect ~${Math.round(data.summary.total_expected_downtime)}min outage.` : ' Grid stable today. Normal operations.'}
                    {' '}Protect revenue: unplug luxury first. -GridBot
                  </p>
                </div>
                <div className="bg-slate-800 p-3 rounded-lg border border-slate-700/50">
                  <div className="text-[0.6rem] uppercase font-black text-amber-400 mb-1 tracking-widest">SMS 2/3 — ACTION PLAN</div>
                  <p className="text-[0.7rem] leading-relaxed text-slate-200">
                    ACTION: Keep Lighting ON all day. Turn OFF luxury appliances during risk hours.
                    Plan saves {data.revenue_saved.toLocaleString()} RWF vs full-on. -GridBot
                  </p>
                </div>
                <div className="bg-slate-800 p-3 rounded-lg border border-slate-700/50">
                  <div className="text-[0.6rem] uppercase font-black text-emerald-400 mb-1 tracking-widest">SMS 3/3 — FALLBACK</div>
                  <p className="text-[0.7rem] leading-relaxed text-slate-200">
                    No internet? Last plan valid up to 6h. After 6h: keep ONLY Lighting ON until reconnected. -GridBot
                  </p>
                </div>
              </div>
              <Button className="mt-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-10 rounded-lg"
                onClick={() => setIsSmsModalOpen(true)}>
                <Phone className="w-4 h-4 mr-2" /> Open Full Digest
              </Button>
            </div>
          </div>
        </main>
      </div>

      <SMSDigestModal isOpen={isSmsModalOpen} onClose={() => setIsSmsModalOpen(false)} data={data} />
    </div>
  );
}
