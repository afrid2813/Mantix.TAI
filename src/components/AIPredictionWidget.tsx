import { useState, useEffect } from 'react';
import { Bot, Sparkles, Loader2 } from 'lucide-react';
import { getGeminiPrediction, getComputationalPrediction } from '../services/aiService';

export function AIPredictionWidget({
  symbol, price, indicators, change24h, newsSentiment
}: {
  symbol: string; 
  price: number; 
  indicators: any;
  change24h: number;
  newsSentiment?: { score: number; label: string; summary: string };
}) {
  const [prediction, setPrediction] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [provider, setProvider] = useState<string>('Initialization...');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentimentHistory, setSentimentHistory] = useState<number[]>([]);

  useEffect(() => {
    if (newsSentiment?.score !== undefined) {
      setSentimentHistory(prev => {
        const last = prev[prev.length - 1];
        if (last === newsSentiment.score) return prev;
        const newHistory = [...prev, newsSentiment.score];
        return newHistory.slice(-20); // Keep last 20 scores
      });
    }
  }, [newsSentiment?.score]);

  const fetchPrediction = async () => {
    if (!indicators) return;
    
    setLoading(true);
    setError(null);
    
    const dataPayload = {
      symbol, 
      recentPrice: price, 
      rsi: indicators.rsi,
      macd: indicators.macd,
      sma: indicators.sma,
      bb: indicators.bb,
      stoch: indicators.stoch,
      volatility: indicators.volatility,
      volume: indicators.volume,
      change24h,
      newsSentiment
    };

    try {
      const result = await getGeminiPrediction(dataPayload);
      setPrediction(result.prediction);
      setProvider(result.provider);
      setConfidence(result.confidence);
    } catch (err: any) {
      console.error('AI Analysis failed:', err.message);
      
      let friendlyError = "AI Engine failed to generate analysis.";
      if (err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')) {
        friendlyError = "AI Quota Exceeded. Please try again later or check API limits.";
      } else if (err.message && err.message.includes('Internal Server Error')) {
        friendlyError = "AI Server encountered an error. Retrying soon...";
      } else if (err.message) {
        friendlyError = `Analysis Error: ${err.message}`;
      }
      
      setError(friendlyError);
      setPrediction(null);
      setConfidence(null);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch logic
  useEffect(() => {
    // Initial fetch when indicators become available or symbol changes
    if (indicators) {
      fetchPrediction();
    }

    // Set up 30s interval for auto-fetching
    const intervalId = setInterval(() => {
      fetchPrediction();
    }, 30000);

    return () => clearInterval(intervalId);
  }, [symbol, !!indicators]);

  return (
    <div className="glass-panel p-5 relative overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-brand-emerald/10 p-2 rounded text-brand-emerald border border-brand-emerald/20">
            <Bot size={20} />
          </div>
          <div>
            <h2 className="text-white text-xs font-bold font-mono tracking-widest uppercase">Quantango</h2>
            <div className="flex items-center gap-2">
              <p className="text-[9px] font-mono text-gray-400 uppercase tracking-tighter">{provider || 'Gemini 3 Flash'}</p>
              {newsSentiment && (
                <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10">
                  <span className={`w-1 h-1 rounded-full ${
                    newsSentiment.score > 0.2 ? 'bg-brand-emerald shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 
                    newsSentiment.score < -0.2 ? 'bg-brand-red shadow-[0_0_5px_rgba(239,68,68,0.5)]' : 
                    'bg-gray-500'
                  }`} />
                  <span className="text-[8px] font-mono font-bold uppercase tracking-widest flex items-center">
                    <span className="text-gray-500 mr-1">SENT:</span>
                    <span className={
                    (newsSentiment.score || 0) > 0.2 ? 'text-brand-emerald' : 
                    (newsSentiment.score || 0) < -0.2 ? 'text-brand-red' : 
                    'text-gray-400'
                  }>
                    {newsSentiment.label} {newsSentiment.score !== undefined ? `(${(newsSentiment.score || 0).toFixed(2)})` : ''}
                  </span>
                  </span>
                  
                  {/* Historical Trend Chart */}
                  {sentimentHistory.length > 1 && (
                    <div className="flex items-end h-3 gap-[1px] ml-2 pl-2 border-l border-white/10" title="Sentiment History">
                      {sentimentHistory.map((score, i) => {
                        // Map score from -1..1 to 15..100% height for visualization
                        const h = Math.max(15, ((score + 1) / 2) * 100);
                        const barColor = score > 0.2 ? 'bg-brand-emerald' : score < -0.2 ? 'bg-brand-red' : 'bg-gray-500';
                        return (
                          <div 
                            key={i} 
                            className={`w-[3px] rounded-t-[1px] opacity-80 ${barColor}`} 
                            style={{ height: `${h}%` }} 
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 bg-bg-primary/50 border border-border-dim/50 rounded p-4 z-10 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex flex-col h-full animate-pulse">
            <div className="flex items-center justify-between mb-4">
              <div className="h-3 w-32 bg-gray-800 rounded" />
              <div className="flex items-center gap-2">
                <div className="h-6 w-20 bg-gray-800 rounded" />
                <div className="h-10 w-10 bg-gray-800 rounded-full" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-2.5 w-full bg-gray-900 rounded" />
              <div className="h-2.5 w-full bg-gray-900 rounded" />
              <div className="h-2.5 w-4/5 bg-gray-900 rounded" />
              <div className="h-2.5 w-full bg-gray-900 rounded" />
              <div className="h-2.5 w-2/3 bg-gray-900 rounded" />
            </div>
            <div className="mt-6 flex flex-col items-center gap-2">
               <Loader2 size={24} className="animate-spin text-brand-emerald opacity-20" />
               <span className="text-[8px] text-gray-700 font-mono tracking-[.3em] uppercase">Processing Quantum Data</span>
            </div>
          </div>
        ) : error ? (
          <div className="text-brand-red text-[11px] font-mono flex flex-col items-center justify-center h-full text-center p-4 border border-brand-red/20 rounded bg-brand-red/5">
            <Bot size={24} className="mb-2 opacity-50" />
            <span className="font-bold tracking-widest uppercase mb-1">Analysis Failed</span>
            <span className="opacity-80">{error}</span>
          </div>
        ) : prediction ? (
          <div className="text-gray-300 text-[11px] leading-relaxed font-mono">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className={prediction.includes('"BUY"') ? 'text-brand-emerald' : prediction.includes('"SELL"') ? 'text-brand-red' : 'text-gray-400'}>
                • EXECUTION SIGNAL
              </span>
              {confidence !== null && (
                <div className="flex items-center gap-2">
                   <div className="flex flex-col items-end">
                     <span className="text-[9px] text-gray-400 font-bold leading-none uppercase tracking-widest">Confidence</span>
                     <span className="text-[8px] text-gray-600 uppercase font-mono">{provider || 'Local'}</span>
                   </div>
                   <div className="relative w-10 h-10 flex items-center justify-center ml-1">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="16" fill="none" className="stroke-gray-800/80" strokeWidth="4" />
                        <circle 
                            cx="18" cy="18" r="16" fill="none" 
                            className={confidence >= 80 ? 'stroke-brand-emerald' : confidence >= 50 ? 'stroke-brand-cyan' : 'stroke-brand-red'} 
                            strokeWidth="4" 
                            strokeDasharray="100" 
                            strokeDashoffset={100 - confidence} 
                            strokeLinecap="round" 
                            style={{ transition: "stroke-dashoffset 1s ease-in-out" }}
                        />
                      </svg>
                      <span className={
                          `absolute inset-0 flex items-center justify-center text-[10px] font-bold font-mono tracking-tighter shadow-sm
                          ${confidence >= 80 ? 'text-brand-emerald' : confidence >= 50 ? 'text-brand-cyan' : 'text-brand-red'}`
                      }>
                          {confidence}
                      </span>
                   </div>
                </div>
              )}
            </div>
            <pre className="text-gray-400 text-[10px] bg-black/50 p-2 rounded border border-white/5 whitespace-pre-wrap flex-1 overflow-y-auto">
              {prediction}
            </pre>
          </div>
        ) : (
          <div className="text-gray-600 text-[11px] font-mono flex flex-col items-center justify-center h-full text-center opacity-80">
            <Bot size={28} className="mb-3 opacity-20" />
            <p className="uppercase tracking-widest leading-loose">
              {!indicators ? 'Fetching Engine Data...' : 'Waiting for Model Response...'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
