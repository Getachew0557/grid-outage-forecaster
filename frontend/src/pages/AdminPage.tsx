/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Settings, Shield, Search, RefreshCw, Loader2 } from 'lucide-react';
import { Input } from '../components/ui/input';
import { useForecastStore } from '../store/forecastStore';
import { MetricsData } from '../types';

const DEMO_USERS = [
  { id: 1, name: 'Jean Salon', email: 'salon@demo.rw', role: 'BUSINESS_OWNER', status: 'Active', business: 'Salon' },
  { id: 2, name: 'Mary ColdRoom', email: 'coldroom@demo.rw', role: 'BUSINESS_OWNER', status: 'Active', business: 'Cold Room' },
  { id: 3, name: 'Peter Tailor', email: 'tailor@demo.rw', role: 'BUSINESS_OWNER', status: 'Pending', business: 'Tailor' },
];

export default function AdminPage() {
  const { metrics, fetchMetrics, refreshModel } = useForecastStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshMsg('');
    try {
      const res = await refreshModel();
      setRefreshMsg(res.message);
    } catch {
      setRefreshMsg('Refresh failed — is the backend running?');
    } finally {
      setIsRefreshing(false);
    }
  };

  const m = metrics;

  return (
    <div className="min-h-screen bg-slate-50 p-8 space-y-8 max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Super Admin Panel</h1>
          <p className="text-slate-500 text-sm">Live model metrics + user management · Rwanda Grid</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline"><Settings className="w-4 h-4 mr-2" /> Settings</Button>
          <Button onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Retrain Model
          </Button>
        </div>
      </div>

      {refreshMsg && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-3 rounded-lg">
          {refreshMsg}
        </div>
      )}

      {/* Live model metrics */}
      <div className="grid md:grid-cols-4 gap-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">Brier Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{m ? m.brier_score.toFixed(4) : '—'}</div>
            <p className={`text-xs font-medium mt-1 ${m && m.brier_score < 0.10 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {m ? (m.brier_score < 0.10 ? '✓ Target met (<0.10)' : '✗ Above target') : 'Loading…'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">MAE Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{m ? `${m.mae_duration} min` : '—'}</div>
            <p className={`text-xs font-medium mt-1 ${m && m.mae_duration < 30 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {m ? (m.mae_duration < 30 ? '✓ Target met (<30min)' : '✗ Above target') : 'Loading…'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lead Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{m ? `${m.lead_time_minutes} min` : '—'}</div>
            <p className={`text-xs font-medium mt-1 ${m && m.lead_time_minutes > 60 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {m ? (m.lead_time_minutes > 60 ? '✓ Target met (>60min)' : '✗ Below target') : 'Loading…'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">Brier Improvement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{m ? m.brier_improvement_pct : '—'}</div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              vs baseline {m ? m.baseline_brier.toFixed(3) : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* User management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-bold">User Management</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input className="pl-10 h-9" placeholder="Search businesses…" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DEMO_USERS.map(u => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-bold">{u.name}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </TableCell>
                  <TableCell>{u.business}</TableCell>
                  <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                  <TableCell>
                    <Badge className={u.status === 'Active'
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none'
                      : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-none'}>
                      {u.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Edit</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
