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
    .filter(f => f.p_outage > 0.3)
    .map(f => `${f.hour}:00`)
    .join(', ');

  const highRiskHours = data.forecast
    .filter(f => f.p_outage > 0.45)
    .slice(0, 2);

  const smsMessages = [
    `🌩️ ${data.business.toUpperCase()} ALERT: Outage risk likely at ${riskHours}. Keep high-power appliances OFF during red zones. Stay protected!`,
    `💰 Savings Plan: Lights ON all day. ${Object.keys(data.plan[14] || {}).find(k => data.plan[14][k] === 'OFF') || 'TV'} OFF during peak risk. You save ~${data.revenue_saved.toLocaleString()} RWF today.`,
    `🆘 Support: If outage hits, unplug ALL for 5min then restart critical only. Check gridforecast.rw/${data.business} for live updates.`
  ];

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            SMS Digest Preview
          </DialogTitle>
          <DialogDescription>
            Innovation: 3 optimized messages (160 chars) for low-bandwidth areas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {smsMessages.map((msg, idx) => (
            <div key={idx} className="relative group">
              <div className="p-4 bg-neutral-100 rounded-2xl rounded-tl-none border">
                <p className="text-sm text-neutral-800 leading-relaxed font-mono">
                  {msg}
                </p>
                <div className="mt-2 text-[10px] text-neutral-500 uppercase font-bold flex justify-between">
                  <span>SMS {idx + 1}/3</span>
                  <span>{msg.length}/160 chars</span>
                </div>
              </div>
              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="h-8 w-8 p-0 rounded-full shadow-sm"
                  onClick={() => handleCopy(msg, idx)}
                >
                  {copied === idx ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="mt-6 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => window.open(`whatsapp://send?text=${encodeURIComponent(smsMessages.join('\n\n'))}`)}>
            <Share2 className="w-4 h-4 mr-2" /> Share WhatsApp
          </Button>
          <Button className="flex-1" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
