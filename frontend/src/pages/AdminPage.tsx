/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Users, Settings, Shield, Activity, Search } from 'lucide-react';
import { Input } from '../components/ui/input';

export default function AdminPage() {
  const users = [
    { id: 1, name: 'Jean Salon', email: 'salon@demo.rw', role: 'BUSINESS_OWNER', status: 'Active', business: 'Salon' },
    { id: 2, name: 'Mary ColdRoom', email: 'coldroom@demo.rw', role: 'BUSINESS_OWNER', status: 'Active', business: 'Cold Room' },
    { id: 3, name: 'Peter Tailor', email: 'tailor@demo.rw', role: 'BUSINESS_OWNER', status: 'Pending', business: 'Tailor' },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col p-8 space-y-8 max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Super Admin Panel</h1>
          <p className="text-neutral-500">System metrics and user management for Rwanda Grid</p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline"><Settings className="w-4 h-4 mr-2" /> Settings</Button>
          <Button><Shield className="w-4 h-4 mr-2" /> System Health</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">1,204</div>
            <p className="text-xs text-green-600 font-medium mt-1">+12% this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Forecast Accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">89.4%</div>
            <p className="text-xs text-neutral-500 font-medium mt-1">Brier Score: 0.12</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Active Sensors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">428</div>
            <p className="text-xs text-green-600 font-medium mt-1">100% operational</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-neutral-500 uppercase tracking-wider">API Throughput</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">4.2k/s</div>
            <p className="text-xs text-neutral-500 font-medium mt-1">Latency: 45ms</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-bold">User Management</CardTitle>
          <div className="relative w-72 no-print">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <Input className="pl-10 h-10" placeholder="Search businesses..." />
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
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-bold">{u.name}</div>
                    <div className="text-xs text-neutral-500">{u.email}</div>
                  </TableCell>
                  <TableCell>{u.business}</TableCell>
                  <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                  <TableCell>
                    <Badge className={u.status === 'Active' ? 'bg-green-100 text-green-700 hover:bg-green-100 border-none' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-none'}>
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
