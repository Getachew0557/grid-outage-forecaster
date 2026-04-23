/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { MessageSquare, Copy, Share2, Check } from 'lucide-react';
import { ForecastData } from '../../types';

interface SMSDigestModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ForecastData;
}

export default function SMSDigestModal({ isOpen, onClose, data }: SMSDigestModalProps) {
  const [copied, setCopied] = useState<number | null>(null);

  const riskHours = data.forecast
    .filter(f => f.p_outage > 0.15)
    .map(f => `${f.hour}h`)
    .join(', ') || 'none';

  const worstHour = data.summary.max_risk_hour;
  const worstRisk = (data.summary.max_risk * 100).toFixed(0);
  const downtime = Math.round(data.summary.total_expected_downtime);
  const saved = data.revenue_saved.toLocaleString();
  const biz = data.business.replace('_', ' ').toUpperCase();
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

  const smsMessages = [
    `GRID ALERT ${today}: ${biz} — HIGH risk at ${worstHour}h (${worstRisk}%). Expect ~${downtime}min outage. Unplug luxury appliances by ${worstHour - 1}h. -GridBot`,
    `ACTION: Lighting ON all day. Turn OFF TV/Radio/AC during ${riskHours}. Plan saves ${saved} RWF vs full-on today. Check gridforecast.rw/${data.business} -GridBot`,
    `FALLBACK: No internet? Last plan valid 6h. After 6h: keep ONLY Lighting ON. Outage hits: unplug all 5min then restart critical only. -GridBot`,
  ];

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  const labelColors = ['text-primary', 'text-amber-400', 'text-emerald-400'];
  const labels = ['SMS 1/3 — RISK ALERT', 'SMS 2/3 — ACTION PLAN', 'SMS 3/3 — FALLBACK'];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Morning SMS Digest
          </DialogTitle>
          <DialogDescription>
            3 messages ≤ 160 chars each — designed for feature phones in low-bandwidth areas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {smsMessages.map((msg, idx) => (
            <div key={idx} className="relative group">
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-700">
                <div className={`text-[0.6rem] uppercase font-black mb-1.5 tracking-widest ${labelColors[idx]}`}>
                  {labels[idx]}
                </div>
                <p className="text-[0.72rem] leading-relaxed text-slate-200 font-mono">{msg}</p>
                <div className="mt-2 text-[10px] text-slate-500 flex justify-between">
                  <span>Feature phone compatible</span>
                  <span className={msg.length > 160 ? 'text-red-400 font-bold' : 'text-slate-500'}>
                    {msg.length}/160 chars
                  </span>
                </div>
              </div>
              <button
                className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-700 hover:bg-slate-600 rounded-full p-1.5"
                onClick={() => handleCopy(msg, idx)}
              >
                {copied === idx
                  ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                  : <Copy className="w-3.5 h-3.5 text-slate-300" />}
              </button>
            </div>
          ))}
        </div>

        <DialogFooter className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1"
            onClick={() => window.open(`whatsapp://send?text=${encodeURIComponent(smsMessages.join('\n\n'))}`)}>
            <Share2 className="w-4 h-4 mr-2" /> WhatsApp
          </Button>
          <Button className="flex-1" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
