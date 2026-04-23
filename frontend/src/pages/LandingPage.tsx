/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Scissors, Zap, Shirt, Thermometer, ShieldCheck, TrendingUp, PhoneCall } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  const businessTypes = [
    { name: 'Salon', icon: Scissors, desc: 'Prioritize clippers and dryers during low-risk hours.', color: 'text-pink-500', bg: 'bg-pink-50' },
    { name: 'Cold Room', icon: Thermometer, desc: 'Keep freezers running during critical periods.', color: 'text-blue-500', bg: 'bg-blue-50' },
    { name: 'Tailor', icon: Shirt, desc: 'Manage sewing machines and irons efficiently.', color: 'text-purple-500', bg: 'bg-purple-50' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="px-6 py-4 flex justify-between items-center bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-primary p-1.5 rounded-lg shadow-sm">
            <Zap className="text-white w-5 h-5 fill-current" />
          </div>
          <span className="font-extrabold text-xl tracking-tighter text-slate-800">GRIDFORECAST.rw</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="text-slate-600 font-bold" onClick={() => navigate('/login')}>Login</Button>
          <Button className="font-bold px-6" onClick={() => navigate('/login')}>Get Started</Button>
        </div>
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="px-6 py-20 md:py-32 text-center max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold tracking-widest mb-6"
          >
            ⚡ ENERGY TECH RWANDA
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-black text-slate-900 mb-8 leading-[1.1] tracking-tight"
          >
            Power Your Business <br />
            <span className="text-primary italic">Without Interruptions</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-slate-500 mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            Predict grid outages in Rwanda with 85% accuracy. Know exactly when to use high-power appliances and maximize your daily revenue.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button size="lg" className="h-16 px-10 text-lg font-black shadow-xl shadow-primary/20 hover:scale-105 transition-transform" onClick={() => navigate('/login')}>
              Launch Demo Dashboard
            </Button>
            <Button size="lg" variant="outline" className="h-16 px-10 text-lg font-bold border-slate-200">
              View Case Studies
            </Button>
          </motion.div>
        </section>

        {/* Business Types (Modular Cards) */}
        <section className="px-6 py-24 bg-white border-y border-slate-100">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
              <div className="max-w-xl">
                <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Built for Entrepreneurs</h2>
                <p className="text-slate-500">Optimized algorithms for Rwanda's most energy-sensitive small businesses.</p>
              </div>
              <Button variant="link" className="font-bold text-primary p-0">View All Business Types →</Button>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 text-left">
              {businessTypes.map((biz, i) => (
                <motion.div
                  key={biz.name}
                  whileHover={{ y: -8 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="group"
                >
                  <Card className="border border-slate-100 shadow-sm rounded-3xl overflow-hidden h-full group-hover:shadow-xl transition-all group-hover:border-primary/20">
                    <CardContent className="p-8">
                      <div className={`w-14 h-14 rounded-2xl ${biz.bg} flex items-center justify-center mb-8 transition-transform group-hover:scale-110`}>
                        <biz.icon className={`w-7 h-7 ${biz.color}`} />
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 mb-4">{biz.name}</h3>
                      <p className="text-slate-500 leading-relaxed">{biz.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Impact Section */}
        <section className="px-6 py-24 bg-slate-900 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-1/3 h-full bg-primary/5 blur-3xl rounded-full"></div>
          <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-black mb-8 leading-tight">Quantifiable Impact in <span className="text-primary">Real-Time.</span></h2>
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1">
                  <div className="text-4xl font-black text-white">85%</div>
                  <div className="text-slate-400 text-sm font-bold uppercase tracking-wider">Accuracy</div>
                </div>
                <div className="space-y-1">
                  <div className="text-4xl font-black text-white">1.2M</div>
                  <div className="text-slate-400 text-sm font-bold uppercase tracking-wider">RWF Protected</div>
                </div>
                <div className="space-y-1">
                  <div className="text-4xl font-black text-white">350+</div>
                  <div className="text-slate-400 text-sm font-bold uppercase tracking-wider">Businesses</div>
                </div>
                <div className="space-y-1">
                  <div className="text-4xl font-black text-white">24/7</div>
                  <div className="text-slate-400 text-sm font-bold uppercase tracking-wider">Monitoring</div>
                </div>
              </div>
            </div>
            <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-slate-700 rounded-full"></div>
                <div>
                  <div className="font-bold">Jean Pierre</div>
                  <div className="text-xs text-slate-500">Salon Owner, Kigali</div>
                </div>
              </div>
              <p className="text-lg italic text-slate-300 leading-relaxed italic">
                "Before GridForecast, I was losing thousands of RWF every time a dryer stopped mid-appointment. Now, I plan my bookings based on the forecast. It changed my life."
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-6 py-16 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <Zap className="text-primary w-6 h-6 fill-current" />
            <span className="font-black text-2xl tracking-tighter text-slate-900">GRIDFORECAST</span>
          </div>
          <div className="flex gap-10 text-sm font-bold text-slate-500 uppercase tracking-widest">
            <a href="#" className="hover:text-primary transition-colors">Support</a>
            <a href="#" className="hover:text-primary transition-colors">Privacy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms</a>
          </div>
          <div className="text-xs text-slate-400 font-medium">© 2025 EnergyTech Rwanda. Innovated for Resilience.</div>
        </div>
      </footer>
    </div>
  );
}
