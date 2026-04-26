import { useEffect, useState } from 'react';
import { Newspaper, ExternalLink, Loader2, BarChart3, Gauge } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { NewsArticle } from '../types';
import { getNewsSentiment } from '../services/aiService';

export function NewsWidget({ 
  symbol, 
  onSentimentAnalyzed 
}: { 
  symbol: string; 
  onSentimentAnalyzed?: (s: { score: number; label: string; summary: string; impactDrivers: string[] }) => void 
}) {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [sentiment, setSentiment] = useState<{ score: number; summary: string; label: string; impactDrivers: string[] } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/market-intel?symbol=${symbol}`);
        if (response.ok) {
          const data = await response.json();
          setNews(data);
          
          // Trigger sentiment analysis
          if (data.length > 0) {
            setAnalyzing(true);
            const result = await getNewsSentiment(data.slice(0, 8));
            setSentiment(result);
            if (onSentimentAnalyzed) {
              onSentimentAnalyzed(result);
            }
            setAnalyzing(false);
          }
        }
      } catch (err) {
        // Fallback simulated data if network strictly fails (e.g., ad-blocker or offline)
        const mockFallback = [
          {
            id: 'mock-1',
            title: `${symbol} Market Dynamics Aligning with Retail Sentiment`,
            source: 'System Intel',
            url: '#',
            publishedAt: Math.floor(Date.now() / 1000) - 1200
          },
          {
            id: 'mock-2',
            title: `Institutional Volume Monitoring Suggests Consolidation Phase for ${symbol}`,
            source: 'System Intel',
            url: '#',
            publishedAt: Math.floor(Date.now() / 1000) - 3600
          }
        ];
        setNews(mockFallback);
        setAnalyzedMock();

        async function setAnalyzedMock() {
            setAnalyzing(true);
            try {
              const result = await getNewsSentiment(mockFallback);
              setSentiment(result);
              if (onSentimentAnalyzed) onSentimentAnalyzed(result);
            } catch (e) {}
            setAnalyzing(false);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
    const interval = setInterval(fetchNews, 60000 * 5); // 5 minutes
    return () => clearInterval(interval);
  }, [symbol]);

  return (
    <div className="flex flex-col h-full font-mono overflow-hidden">
      <div className="px-4 py-3 border-b border-border-dim/50 flex items-center justify-between bg-bg-secondary/40">
        <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Market Intelligence</span>
        {analyzing && (
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] text-gray-500 animate-pulse">ANALYZING SENTIMENT</span>
            <Loader2 size={10} className="animate-spin text-brand-emerald" />
          </div>
        )}
      </div>

      {sentiment && !loading && (
        <div className="p-3 bg-bg-secondary/20 border-b border-border-dim/30 animate-in fade-in slide-in-from-top-1 duration-500">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Gauge size={14} className={sentiment.score > 0 ? "text-brand-emerald" : "text-brand-red"} />
              <span className={`text-[10px] font-bold uppercase tracking-tight ${sentiment.score > 0 ? "text-brand-emerald" : "text-brand-red"}`}>
                Mood: {sentiment.label}
              </span>
            </div>
            <div className="text-[9px] font-bold text-gray-500 bg-bg-primary/50 px-1.5 py-0.5 rounded border border-border-dim/30">
              SCORE: {((sentiment.score || 0) * 100).toFixed(0)}
            </div>
          </div>
          <p className="text-[10px] text-gray-400 leading-relaxed italic border-l-2 border-border-dim pl-2 mb-2">
            "{sentiment.summary}"
          </p>
          {sentiment.impactDrivers && sentiment.impactDrivers.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {sentiment.impactDrivers.slice(0, 3).map((driver, i) => (
                <span key={i} className="text-[7px] bg-bg-primary/50 text-gray-500 border border-border-dim/50 px-1 py-0.5 rounded uppercase font-bold">
                  {driver}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {loading ? (
          <div className="flex items-center justify-center p-10 h-full">
            <Loader2 className="animate-spin text-gray-600" size={20} />
          </div>
        ) : news.length > 0 ? (
          <div className="flex flex-col gap-1">
            {news.map((item) => (
              <a 
                key={item.id} 
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded hover:bg-bg-secondary transition-colors flex gap-3 group border border-transparent hover:border-border-dim"
              >
                {item.imageUrl && (
                  <div className="w-12 h-12 shrink-0 rounded bg-bg-primary overflow-hidden">
                    <img src={item.imageUrl} alt="" className="w-full h-full object-cover opacity-60 group-hover:opacity-90 transition-opacity grayscale hover:grayscale-0" />
                  </div>
                )}
                <div className="flex flex-col justify-between flex-1 min-w-0">
                  <h4 className="text-gray-300 text-[10px] font-medium line-clamp-2 leading-tight group-hover:text-white mb-1">
                    {item.title}
                  </h4>
                  <div className="flex items-center justify-between text-[8px] text-gray-600 uppercase tracking-tighter">
                    <span className="font-bold text-brand-emerald/70">{item.source}</span>
                    <span>
                      {item.publishedAt 
                        ? formatDistanceToNow(new Date(item.publishedAt * 1000), { addSuffix: true })
                        : 'recently'
                      }
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="text-gray-600 text-[10px] text-center p-10 uppercase tracking-widest">
            No intelligence available.
          </div>
        )}
      </div>
    </div>
  );
}
