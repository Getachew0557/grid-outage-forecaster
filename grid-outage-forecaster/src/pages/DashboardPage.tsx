/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '../store/authStore';
import { useForecastStore } from '../store/forecastStore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { 
  Zap, 
  LogOut, 
  RefreshCw, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Info,
  Phone,
  Volume2,
  Download,
  Wifi,
  WifiOff,
  User as UserIcon,
  ChevronRight,
  Activity,
  Settings
} from 'lucide-react';
import ForecastChart from '../components/dashboard/ForecastChart';
import SMSDigestModal from '../components/dashboard/SMSDigestModal';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { data, isLoading, fetchForecast } = useForecastStore();
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isReading, setIsReading] = useState(false);

  useEffect(() => {
    if (user?.businessType) {
      fetchForecast(user.businessType);
    }

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user, fetchForecast]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const readForecast = () => {
    if (!data) return;
    setIsReading(true);
    const highRisk = data.forecast.find(f => f.p_outage > 0.4);
    const msg = new SpeechSynthesisUtterance();
    msg.text = highRisk 
      ? `Attention: At ${highRisk.hour} PM, there is a high outage risk of ${(highRisk.p_outage * 100).toFixed(0)} percent. Please turn off non-essential appliances.`
      : `The grid is stable today. No major outages expected.`;
    msg.onend = () => setIsReading(false);
    window.speechSynthesis.speak(msg);
  };

  if (!data || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium tracking-tight">Predicting Grid Patterns...</p>
        </div>
      </div>
    );
  }

  const riskStatus = data.total_risk_hours > 5 ? 'High' : data.total_risk_hours > 2 ? 'Medium' : 'Low';
  const riskColor = riskStatus === 'High' ? 'text-red-600' : riskStatus === 'Medium' ? 'text-amber-600' : 'text-emerald-600';

  return (
    <div className="min-h-screen grid grid-cols-[220px_1fr] bg-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="bg-slate-800 text-slate-100 p-6 flex flex-col gap-8 no-print">
        <div className="flex items-center gap-2 text-primary font-extrabold text-xl tracking-tighter">
          <Zap className="w-6 h-6 fill-current" />
          <span>GRIDFORECAST</span>
        </div>

        <nav className="flex flex-col gap-1.5 flex-grow">
          <div className="nav-item-utility active"><Activity className="w-4 h-4" /> Dashboard</div>
          <div className="nav-item-utility"><Clock className="w-4 h-4" /> History</div>
          <div className="nav-item-utility"><Zap className="w-4 h-4" /> Appliances</div>
          {user?.role === 'SUPER_ADMIN' && (
            <div className="nav-item-utility" onClick={() => navigate('/admin')}><CheckCircle2 className="w-4 h-4" /> Admin Panel</div>
          )}
          <div className="nav-item-utility"><Settings className="w-4 h-4" /> Settings</div>
        </nav>

        <div className="mt-auto">
          <div className="p-4 bg-slate-700/50 rounded-xl space-y-2">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">PWA Version 2.1</p>
            <p className="text-[11px] text-slate-300">Offline Cache: 5.4MB</p>
            <div className="w-full bg-slate-600 rounded-full h-1 mt-2">
              <div className="bg-primary h-full w-[65%] rounded-full"></div>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="w-full justify-start mt-4 text-slate-400 hover:text-white hover:bg-slate-700">
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-col h-screen overflow-auto">
        {/* Header */}
        <header className="h-16 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10 no-print">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              {user?.businessType?.toUpperCase().replace('_', ' ')} Kigali Central
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </h2>
            <p className="text-xs text-slate-500 font-medium">Last updated: Today, {new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>

          <div className="flex items-center gap-4">
            {isOffline ? (
              <div className="status-badge-utility bg-yellow-50 text-yellow-700 border-yellow-200">
                <WifiOff className="w-3 h-3" /> OFFLINE
              </div>
            ) : (
              <div className="status-badge-utility bg-emerald-50 text-emerald-700 border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> ONLINE
              </div>
            )}
            
            <Button size="sm" className="voice-btn h-9 px-4 font-bold" onClick={readForecast} disabled={isReading}>
              <Volume2 className={`w-4 h-4 mr-2 ${isReading ? 'animate-pulse' : ''}`} />
              Read Forecast
            </Button>
            
            <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
              <UserIcon className="w-5 h-5" />
            </div>
          </div>
        </header>

        {/* Dashboard Grid */}
        <main className="p-6 space-y-6">
          {/* Metrics Row */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="card-utility">
              <CardContent className="pt-4 pb-4">
                <p className="text-[0.7rem] uppercase font-bold text-slate-500 tracking-wider">Outage Risk</p>
                <div className={`text-xl font-extrabold flex items-baseline gap-2 mt-1 ${riskColor}`}>
                  {(Math.max(...data.forecast.map(f => f.p_outage)) * 100).toFixed(0)}% <span className="text-[0.6rem] uppercase">{riskStatus}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="card-utility">
              <CardContent className="pt-4 pb-4">
                <p className="text-[0.7rem] uppercase font-bold text-slate-500 tracking-wider">Est. Downtime</p>
                <div className="text-xl font-extrabold mt-1">
                  {Math.round(data.forecast.reduce((a, b) => a + b.duration_min, 0))} min
                </div>
              </CardContent>
            </Card>
            <Card className="card-utility">
              <CardContent className="pt-4 pb-4">
                <p className="text-[0.7rem] uppercase font-bold text-slate-500 tracking-wider">Revenue Protected</p>
                <div className="text-xl font-extrabold text-emerald-600 mt-1">
                  {data.revenue_saved.toLocaleString()} RWF
                </div>
              </CardContent>
            </Card>
            <Card className="card-utility">
              <CardContent className="pt-4 pb-4">
                <p className="text-[0.7rem] uppercase font-bold text-slate-500 tracking-wider">Critical Hours</p>
                <div className="text-xl font-extrabold mt-1">
                  {data.total_risk_hours} Hours
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart & Impact Row */}
          <div className="grid grid-cols-[1fr_280px] gap-4">
            <Card className="card-utility">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-800">24h Outage Probability</span>
                  <div className="flex items-center gap-4 text-[0.65rem] font-bold tracking-wider text-slate-400">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary"></span> P(Outage)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-200"></span> Confidence</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ForecastChart data={data.forecast} />
              </CardContent>
            </Card>

            <Card className="card-utility flex flex-col items-center justify-center text-center p-6 bg-white overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <TrendingUp className="w-32 h-32" />
              </div>
              <div className="text-3xl mb-2">💰</div>
              <h3 className="font-bold text-slate-800 text-lg">Revenue Impact</h3>
              <div className="text-3xl font-black text-emerald-500 my-2">+35%</div>
              <p className="text-xs text-slate-500 leading-relaxed max-w-[180px]">Compared to running without priority planning</p>
              <Button size="sm" variant="outline" className="mt-6 font-bold w-full h-9 border-slate-200 text-slate-600">View History</Button>
            </Card>
          </div>

          {/* Table & SMS Row */}
          <div className="grid grid-cols-[1.5fr_1fr] gap-4">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50 border-slate-200">
                    <TableHead className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Hour</TableHead>
                    <TableHead className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Risk</TableHead>
                    <TableHead className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Critical</TableHead>
                    <TableHead className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Comfort</TableHead>
                    <TableHead className="text-[0.65rem] text-right font-bold uppercase tracking-wider text-slate-500">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.forecast.slice(8, 16).map((f) => {
                    const isHigh = f.p_outage > 0.4;
                    const isMed = f.p_outage > 0.2 && f.p_outage <= 0.4;
                    return (
                      <TableRow key={f.hour} className="border-slate-50 hover:bg-slate-50/50">
                        <TableCell className="font-bold text-slate-800 py-3">{f.hour}:00</TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded text-[0.7rem] font-black uppercase tracking-tight 
                            ${isHigh ? 'bg-red-100 text-red-600' : isMed ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-600'}`}>
                            {(f.p_outage * 100).toFixed(0)}% {isHigh ? 'HI' : isMed ? 'MED' : 'LO'}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-700 text-xs font-medium">✅ ON</TableCell>
                        <TableCell className="text-slate-700 text-xs font-medium">
                          {isHigh ? <span className="text-slate-300">❌ OFF</span> : '✅ ON'}
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-500 text-[0.65rem] uppercase">
                          {isHigh ? 'Critical Only' : isMed ? 'Prepare' : 'Normal'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="bg-slate-900 rounded-xl p-4 flex flex-col gap-4 shadow-lg text-white">
              <div className="flex justify-between items-center px-1">
                <span className="font-bold text-sm">SMS Digest Preview</span>
                <span className="bg-slate-800 text-[0.6rem] font-black px-2 py-0.5 rounded text-slate-400 border border-slate-700">3 MESSAGES</span>
              </div>
              
              <div className="space-y-3">
                <div className="bg-slate-800 p-3 rounded-lg border border-slate-700/50 relative">
                  <div className="text-[0.6rem] uppercase font-black text-primary mb-1 tracking-widest">SMS 1/3 - ALERT</div>
                  <p className="text-[0.7rem] leading-relaxed text-slate-200">SALON ALERT: Today outages likely 2-4pm (65% risk), 7-9pm (40% risk). Keep hair dryers OFF 2-4pm.</p>
                </div>
                <div className="bg-slate-800 p-3 rounded-lg border border-slate-700/50 relative">
                  <div className="text-[0.6rem] uppercase font-black text-amber-400 mb-1 tracking-widest">SMS 2/3 - PLAN</div>
                  <p className="text-[0.7rem] leading-relaxed text-slate-200">Plan: Lights ON all day. TV OFF 2-4pm & 7-9pm. You save 12,500 RWF today vs no plan.</p>
                </div>
              </div>

              <Button className="mt-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-10 rounded-lg shadow-sm" onClick={() => setIsSmsModalOpen(true)}>
                <Phone className="w-4 h-4 mr-2" /> Open Mobile Share
              </Button>
            </div>
          </div>
        </main>
      </div>

      <SMSDigestModal 
        isOpen={isSmsModalOpen} 
        onClose={() => setIsSmsModalOpen(false)} 
        data={data}
      />
    </div>
  );
}
