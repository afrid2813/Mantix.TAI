import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, TrendingUp, TrendingDown, X, Info } from 'lucide-react';
import { SignalType, StrategySignal } from '../lib/signals';
import { cn } from '../lib/utils';

export function TradeAlerts({ currentSignal, symbol }: { currentSignal: StrategySignal; symbol: string }) {
  const [alerts, setAlerts] = useState<(StrategySignal & { id: string; symbol: string })[]>([]);

  useEffect(() => {
    if (currentSignal.type !== SignalType.NEUTRAL) {
      const id = Math.random().toString(36).substr(2, 9);
      const newAlert = { ...currentSignal, id, symbol };
      
      // Only add if it's different from the last one or enough time has passed
      setAlerts(prev => {
        const last = prev[0];
        if (last && last.type === newAlert.type && (Date.now() - last.timestamp < 30000)) {
          return prev;
        }
        return [newAlert, ...prev].slice(0, 5);
      });

      // Auto-dismiss after 8 seconds
      setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.id !== id));
      }, 8000);
    }
  }, [currentSignal.timestamp, currentSignal.type, symbol]);

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {alerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
            layout
            className={cn(
              "pointer-events-auto min-w-[320px] max-w-[400px] glass-panel p-4 shadow-2xl relative border-l-4",
              alert.type === SignalType.BUY ? "border-l-brand-emerald" : "border-l-brand-red"
            )}
          >
            <button 
              onClick={() => removeAlert(alert.id)}
              className="absolute top-2 right-2 p-1 text-gray-500 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
            
            <div className="flex gap-4">
              <div className={cn(
                "p-2 rounded-lg h-fit",
                alert.type === SignalType.BUY ? "bg-brand-emerald/10 text-brand-emerald" : "bg-brand-red/10 text-brand-red"
              )}>
                {alert.type === SignalType.BUY ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Trade Signal — {alert.symbol}
                  </span>
                  <div className="w-1 h-1 rounded-full bg-gray-600" />
                  <span className="text-[10px] font-mono text-gray-500">
                    {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                
                <h4 className={cn(
                  "text-lg font-bold font-mono tracking-tighter mb-1",
                  alert.type === SignalType.BUY ? "text-brand-emerald" : "text-brand-red"
                )}>
                  {alert.type} ALERT
                </h4>
                
                <div className="flex items-start gap-2 text-xs text-gray-400 leading-relaxed">
                  <Info size={12} className="mt-0.5 flex-shrink-0" />
                  <p>{alert.reason}</p>
                </div>
              </div>
            </div>

            <div className="mt-3 h-1 w-full bg-bg-secondary/50 rounded-full overflow-hidden">
               <motion.div 
                 initial={{ width: "100%" }}
                 animate={{ width: "0%" }}
                 transition={{ duration: 8, ease: "linear" }}
                 className={cn(
                   "h-full",
                   alert.type === SignalType.BUY ? "bg-brand-emerald" : "bg-brand-red"
                 )}
               />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
