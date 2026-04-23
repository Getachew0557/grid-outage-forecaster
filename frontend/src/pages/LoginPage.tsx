/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Zap, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const success = await login(email, password);
      if (success) {
        navigate('/dashboard');
      } else {
        setError('Invalid email or password. Please try the demo accounts.');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-100">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-2 rounded-xl">
              <Zap className="text-white w-6 h-6 fill-current" />
            </div>
            <span className="font-bold text-2xl tracking-tight text-slate-800">GridForecast.rw</span>
          </div>
        </div>

        <Card className="card-utility shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
            <CardDescription>Enter your credentials to access your forecast</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@business.rw" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full font-bold h-11" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Log In'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col border-t pt-6 gap-4">
            <div className="text-xs text-neutral-500 uppercase font-bold tracking-wider">Demo Accounts</div>
            <div className="grid grid-cols-1 gap-2 w-full">
              {[
                { e: 'salon@demo.rw', label: 'Salon Demo' },
                { e: 'admin@gridforecast.rw', label: 'Admin Access' }
              ].map(demo => (
                <div 
                  key={demo.e}
                  className="p-3 bg-neutral-50 rounded-lg border flex justify-between items-center cursor-pointer hover:bg-white transition-colors"
                  onClick={() => { setEmail(demo.e); setPassword(demo.e === 'admin@gridforecast.rw' ? 'Admin123!' : 'demo123'); }}
                >
                  <div className="text-sm">
                    <p className="font-medium text-neutral-900">{demo.label}</p>
                    <p className="text-neutral-500 text-xs">{demo.e}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs">Fill</Button>
                </div>
              ))}
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
