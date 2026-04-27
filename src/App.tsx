import { useEffect, useState, useMemo, useRef } from "react";
import { ChartWidget } from "./components/ChartWidget";
import { IndicatorCard } from "./components/IndicatorCard";
import { NewsWidget } from "./components/NewsWidget";
import { AIPredictionWidget } from "./components/AIPredictionWidget";
import { QuantumBotWidget } from "./components/QuantumBotWidget";
import { TickerBar } from "./components/TickerBar";
import { StrategyScoreboard } from "./components/StrategyScoreboard";
import { StrategyMetricsWidget } from "./components/StrategyMetricsWidget";
import { HistoricalTable } from "./components/HistoricalTable";
import { TradeAlerts } from "./components/TradeAlerts";
import TradingViewAdvancedChart from "./components/TradingViewAdvancedChart";
import TradingViewScreener from "./components/TradingViewScreener";
import TradingViewHeatmap from "./components/TradingViewHeatmap";
import { calculateIndicators } from "./lib/indicators";
import { detectSignal } from "./lib/signals";
import { runBacktest, BacktestStrategy } from "./lib/backtest";
import { BacktestEquityChart } from "./components/BacktestEquityChart";
import { CandleData, Transaction } from "./types";
import {
  Activity,
  TrendingUp,
  BarChart2,
  Bell,
  BellRing,
  X,
  Info,
  ChevronRight,
  Wallet,
  Zap,
  History,
  ArrowRight,
  Loader2,
  Key,
  Check,
  AlertCircle,
  TrendingDown,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "./lib/utils";
import { ethers } from "ethers";

const SYMBOL_GROUPS = {
  Bluechip: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT"],
  Stocks: ["NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "NFLX"],
};

const TICKER_SYMBOLS = [
  "btcusdt",
  "ethusdt",
  "solusdt",
  "nvda",
  "tsla",
  "aapl",
  "msft",
  "amzn",
  "googl",
];

export default function App() {
  const [marketData, setMarketData] = useState<CandleData[]>([]);
  const marketDataRef = useRef<CandleData[]>([]);
  
  useEffect(() => {
    marketDataRef.current = marketData;
  }, [marketData]);

  const [loading, setLoading] = useState(true);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [interval, setIntervalState] = useState("1m");
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [backtestResult, setBacktestResult] = useState<any>(null);
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [backtestStrategy, setBacktestStrategy] = useState<BacktestStrategy>('rsi');
  const [marketDataError, setMarketDataError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"ai" | "pro">("ai");
  const [globalSentiment, setGlobalSentiment] = useState<{
    score: number;
    label: string;
    summary: string;
    impactDrivers: string[];
  } | null>(null);

  // Web3 Wallet
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [balance, setBalance] = useState(50000); // $50k demo balance
  const [rawEthBalance, setRawEthBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showTransactions, setShowTransactions] = useState(false);
  const [importMethod, setImportMethod] = useState<"binance" | "vantage" | null>(null);
  const [vantageServer, setVantageServer] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiSecretInput, setApiSecretInput] = useState("");
  const [apiCredentials, setApiCredentials] = useState<{apiKey: string, apiSecret: string, server?: string} | null>(null);

  const [mt5AccountInfo, setMt5AccountInfo] = useState<any>(null);
  const [mt5Positions, setMt5Positions] = useState<any[]>([]);

  // Poll Vantage positions if connected
  useEffect(() => {
    if (walletConnected && apiCredentials?.apiKey === "vantage_vps") {
      const poll = async () => {
        try {
          const res = await fetch('/api/vps/positions');
          const data = await res.json();
          if (Array.isArray(data)) {
            setMt5Positions(data);
          }
          
          const accRes = await fetch('/api/vps/account');
          const accData = await accRes.json();
          if (accData && !accData.error) {
            setMt5AccountInfo(accData);
            setBalance(accData.balance || accData.equity || 0);
          }
        } catch (e) {
          console.error("Vantage Poll Error:", e);
        }
      };
      
      poll();
      const interval = setInterval(poll, 5000);
      return () => clearInterval(interval);
    }
  }, [walletConnected, apiCredentials]);

  // Real-time states
  const [tickers, setTickers] = useState<
    Record<string, { symbol: string; price: number; change: number }>
  >({});
  const [metrics, setMetrics] = useState({
    price: 0,
    change: 0,
    high: 0,
    low: 0,
  });

  const pendingTickerUpdates = useRef<Record<string, any>>({});
  const wsRef = useRef<WebSocket | null>(null);

  const pendingMarketData = useRef<CandleData[]>([]);

  // Reactive balance conversion for ETH
  useEffect(() => {
    if (walletConnected && rawEthBalance !== null) {
      const ethPrice = tickers['ETHUSDT']?.price || tickers['ethusdt']?.price;
      if (ethPrice) {
        setBalance(rawEthBalance * ethPrice);
      }
    }
  }, [tickers, walletConnected, rawEthBalance]);

  // Throttled updates for tickers and market data
  useEffect(() => {
    const timer = setInterval(() => {
      if (Object.keys(pendingTickerUpdates.current).length > 0) {
        setTickers((prev) => ({ ...prev, ...pendingTickerUpdates.current }));
        pendingTickerUpdates.current = {};
      }
      if (pendingMarketData.current.length > 0) {
        setMarketData([...pendingMarketData.current]);
        pendingMarketData.current = [];
      }
    }, 100); // Throttled to 100ms for high performance live feel
    return () => clearInterval(timer);
  }, []);

  const [alertPriceInput, setAlertPriceInput] = useState("");
  const [alertDirectionInput, setAlertDirectionInput] = useState<
    "above" | "below"
  >("above");
  const [activeAlert, setActiveAlert] = useState<{
    price: number;
    direction: "above" | "below";
  } | null>(null);
  const [triggeredAlert, setTriggeredAlert] = useState<{
    price: number;
    time: Date;
  } | null>(null);

  const currentPrice =
    metrics.price ||
    (marketData.length > 0 ? marketData[marketData.length - 1].close : 0);

  // Alert logic
  useEffect(() => {
    if (activeAlert && currentPrice > 0) {
      if (
        (activeAlert.direction === "above" &&
          currentPrice >= activeAlert.price) ||
        (activeAlert.direction === "below" && currentPrice <= activeAlert.price)
      ) {
        setTriggeredAlert({ price: activeAlert.price, time: new Date() });
        setActiveAlert(null);
      }
    }
  }, [currentPrice, activeAlert]);

  // Initial Data Fetch
  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setMarketDataError(null);
      try {
        const response = await fetch(
          `/api/market-data?symbol=${symbol}&interval=${interval}&limit=100`,
        );
        if (response.ok) {
          const data = await response.json();
          setMarketData(data);
          setLastUpdated(new Date());
        } else {
          try {
            const errData = await response.json();
            setMarketDataError(errData.error || `HTTP Error: ${response.status}`);
          } catch {
            setMarketDataError(`Failed to load data (Status: ${response.status})`);
          }
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setMarketDataError("Network error or API is unavailable. Please check your connection.");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [symbol, interval]);

  // WebSocket for Real-time
  useEffect(() => {
    const isBinance = symbol.endsWith("USDT");
    const sym = symbol.toLowerCase();

    // Filter out simulated stocks from ticker stream
    const validTickers = TICKER_SYMBOLS.filter((s) => s.endsWith("usdt"));
    const streams = [
      ...(isBinance ? [`${sym}@ticker`, `${sym}@kline_${interval}`] : []),
      ...validTickers.filter((s) => s !== sym).map((s) => `${s}@ticker`),
    ].join("/");

    if (!streams) {
      setIsConnected(true);
      return;
    }

    const ws = new WebSocket(
      `wss://stream.binance.com:9443/stream?streams=${streams}`,
    );
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      const stream = msg.stream;
      const data = msg.data;

      if (stream.includes("@ticker")) {
        const s = stream.split("@")[0].toUpperCase();
        const price = parseFloat(data.c);
        const change = parseFloat(data.P);

        if (s === symbol) {
          setMetrics({
            price,
            change,
            high: parseFloat(data.h),
            low: parseFloat(data.l),
          });
        }

        pendingTickerUpdates.current[s] = { symbol: s, price, change };
      }

      if (stream.includes("@kline")) {
        const k = data.k;
        if (k.i === interval) {
          const candle = {
            time: Math.floor(k.t / 1000),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
          };

          if (pendingMarketData.current.length === 0) {
            // First tick in this window, seed with current state if empty
            pendingMarketData.current = [...marketDataRef.current];
          }

          if (pendingMarketData.current.length === 0) {
            pendingMarketData.current = [candle];
          } else {
            const lastIdx = pendingMarketData.current.length - 1;
            const last = pendingMarketData.current[lastIdx];
            if (last.time === candle.time) {
              pendingMarketData.current[lastIdx] = candle;
            } else {
              pendingMarketData.current.push(candle);
              if (pendingMarketData.current.length > 500) {
                pendingMarketData.current.shift();
              }
            }
          }
        }
      }
    };

    return () => {
      ws.close();
    };
  }, [symbol, interval]);

  // Stock Simulation Ticks
  useEffect(() => {
    if (symbol.endsWith("USDT")) return;

    const timer = setInterval(() => {
      setMetrics((prev) => {
        const currentData = marketDataRef.current;
        const lastCandle = currentData[currentData.length - 1];
        const lastPrice = prev.price || (lastCandle ? lastCandle.close : 100);
        const changeRate = (Math.random() - 0.5) * 0.001;
        const newPrice = lastPrice * (1 + changeRate);
        const candle = {
          time: Math.floor(Date.now() / 1000),
          open: lastPrice,
          high:
            Math.max(lastPrice, newPrice) +
            Math.random() * (lastPrice * 0.0002),
          low:
            Math.min(lastPrice, newPrice) -
            Math.random() * (lastPrice * 0.0002),
          close: newPrice,
          volume: Math.random() * 5000,
        };

        pendingMarketData.current = [...currentData, candle].slice(-500);
        return {
          price: newPrice,
          change: prev.change + (Math.random() - 0.5) * 0.05,
          high: Math.max(prev.high || newPrice, newPrice),
          low: prev.low === 0 ? newPrice : Math.min(prev.low, newPrice),
        };
      });
    }, 3000);

    return () => clearInterval(timer);
  }, [symbol, marketData.length === 0]);

  const indicators = useMemo(
    () => calculateIndicators(marketData),
    [marketData],
  );
  const currentSignal = useMemo(
    () => detectSignal(indicators, marketData),
    [indicators, marketData],
  );

  const handleSetAlert = () => {
    const price = parseFloat(alertPriceInput);
    if (!isNaN(price) && price > 0 && currentPrice > 0) {
      setActiveAlert({ price, direction: alertDirectionInput });
      setAlertPriceInput("");
      setTriggeredAlert(null);
    }
  };

  const handleRunBacktest = () => {
    setIsBacktesting(true);
    // Simulate some work
    setTimeout(() => {
      const result = runBacktest(marketData, backtestStrategy);
      setBacktestResult(result);
      setIsBacktesting(false);
    }, 1500);
  };

  const [walletError, setWalletError] = useState<string | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [walletStatusMessage, setWalletStatusMessage] = useState<string | null>(null);

  const handleDisconnectWallet = () => {
    setWalletConnected(false);
    setWalletAddress("");
    setBalance(0);
  };

  const isMobile = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const connectRealWallet = async () => {
    setWalletError(null);
    setIsConnectingWallet(true);
    
    if (typeof (window as any).ethereum !== "undefined") {
      try {
        setWalletStatusMessage("Initializing Web3 Provider...");
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        
        setWalletStatusMessage("Requesting connection permissions from wallet...");
        await provider.send("eth_requestAccounts", []);
        
        setWalletStatusMessage("Connecting and fetching balance...");
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const balanceWei = await provider.getBalance(address);
        const ethBalance = Number(ethers.formatEther(balanceWei));
        setRawEthBalance(ethBalance);
        
        setWalletConnected(true);
        setWalletAddress(
          address.substring(0, 6) + "..." + address.substring(address.length - 4)
        );
        
        // Initial conversion if possible, otherwise it will be updated by the ticker effect
        let finalBalance = ethBalance;
        const ethPrice = tickers['ETHUSDT']?.price || tickers['ethusdt']?.price;
        if (ethPrice) {
          finalBalance = ethBalance * ethPrice;
        }
        setBalance(finalBalance);
        setShowWalletModal(false);
      } catch (error: any) {
        console.error("Web3 Wallet connection failed", error);
        // Handle specific wallet errors (e.g., user rejected the request)
        if (error?.code === 4001 || error?.message?.includes("user rejected")) {
          setWalletError("Connection rejected by user.");
        } else {
          setWalletError("Failed to connect. Please ensure your wallet is unlocked and try again.");
        }
      } finally {
        setIsConnectingWallet(false);
      }
    } else {
      if (isMobile) {
        setWalletError("No Web3 provider detected. On mobile, please click the button below to open in the MetaMask App.");
      } else {
        setWalletError("No Web3 provider detected. If you are viewing this in the AI Studio preview iframe, please open the app in a new standalone tab to allow MetaMask injection.");
      }
      setIsConnectingWallet(false);
    }
  };

  const connectSimulatedWallet = () => {
    setWalletError(null);
    setIsConnectingWallet(true);
    setWalletStatusMessage("Starting simulated environment...");
    
    setTimeout(() => {
      setWalletStatusMessage("Connecting to demo network...");
      setTimeout(() => {
        setWalletConnected(true);
        setWalletAddress(
          "0x" + Math.random().toString(16).substring(2, 6).toUpperCase() + "..." + Math.random().toString(16).substring(2, 6).toUpperCase()
        );
        setBalance(Math.floor(Math.random() * 50000) + 10000);
        setShowWalletModal(false);
        setIsConnectingWallet(false);
      }, 600);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-bg-primary text-gray-300 p-4 sm:p-6 font-sans select-none">
      {/* Wallet Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 bg-bg-primary/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg-secondary border border-border-dim/50 rounded-lg max-w-sm w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowWalletModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2"><Wallet size={20} className="text-brand-cyan" /> Connect Wallet</h2>
            <p className="text-xs text-gray-400 mb-6 font-mono">Select a connection method to proceed.</p>
            
            {walletError && (
              <div className="mb-4 text-[10px] text-brand-red bg-brand-red/10 border border-brand-red/20 p-2 rounded flex items-center gap-2 relative">
                <span className="flex-1">{walletError}</span>
              </div>
            )}
            
            {importMethod === "binance" ? (
              <div className="flex flex-col gap-3">
                 <p className="text-xs text-gray-300 font-mono">Enter your Binance API Key and Secret to connect your account.</p>
                 
                 <div className="relative">
                   <input 
                     type="text"
                     className={cn(
                       "w-full bg-black/50 border rounded p-2 pr-8 text-white font-mono text-xs focus:outline-none transition-colors",
                       apiKeyInput.length === 0 ? "border-border-dim focus:border-brand-cyan" :
                       apiKeyInput.length >= 20 ? "border-brand-emerald focus:border-brand-emerald" :
                       "border-brand-red focus:border-brand-red"
                     )}
                     placeholder="API Key"
                     value={apiKeyInput}
                     onChange={(e) => {
                       setApiKeyInput(e.target.value.trim());
                       setWalletError(null);
                     }}
                   />
                   {apiKeyInput.length > 0 && (
                     <div className="absolute right-2 top-1/2 -translate-y-1/2">
                       {apiKeyInput.length >= 20 ? (
                         <Check size={14} className="text-brand-emerald" />
                       ) : (
                         <AlertCircle size={14} className="text-brand-red" />
                       )}
                     </div>
                   )}
                 </div>

                 <div className="relative">
                   <input 
                     type="password"
                     className={cn(
                       "w-full bg-black/50 border rounded p-2 pr-8 text-white font-mono text-xs focus:outline-none transition-colors",
                       apiSecretInput.length === 0 ? "border-border-dim focus:border-brand-cyan" :
                       apiSecretInput.length >= 20 ? "border-brand-emerald focus:border-brand-emerald" :
                       "border-brand-red focus:border-brand-red"
                     )}
                     placeholder="API Secret"
                     value={apiSecretInput}
                     onChange={(e) => {
                       setApiSecretInput(e.target.value.trim());
                       setWalletError(null);
                     }}
                   />
                   {apiSecretInput.length > 0 && (
                     <div className="absolute right-2 top-1/2 -translate-y-1/2">
                       {apiSecretInput.length >= 20 ? (
                         <Check size={14} className="text-brand-emerald" />
                       ) : (
                         <AlertCircle size={14} className="text-brand-red" />
                       )}
                     </div>
                   )}
                 </div>

                 <div className="flex gap-2 mt-2">
                   <button 
                     onClick={() => { setImportMethod(null); setApiKeyInput(""); setApiSecretInput(""); setWalletError(null); }}
                     className="flex-1 py-2 bg-bg-primary border border-border-dim hover:bg-bg-primary/80 rounded transition-all font-bold text-xs"
                   >
                     Cancel
                   </button>
                   <button 
                     onClick={async () => {
                       if (!apiKeyInput.trim() || !apiSecretInput.trim()) {
                         setWalletError("Please enter both API Key and Secret Key.");
                         return;
                       }
                       
                       const isValidKey = apiKeyInput.trim().length >= 20;
                       const isValidSecret = apiSecretInput.trim().length >= 20;
                       
                       if (!isValidKey || !isValidSecret) {
                         setWalletError("API keys appear too short. Please double-check you copied them correctly.");
                         return;
                       }

                       setWalletStatusMessage("Verifying Binance Keys...");
                       setImportMethod(null);
                       setIsConnectingWallet(true);
                       try {
                         const res = await fetch('/api/account', {
                           method: 'POST',
                           headers: {
                             'Content-Type': 'application/json'
                           },
                           body: JSON.stringify({
                             apiKey: apiKeyInput.trim(),
                             secretKey: apiSecretInput.trim()
                           })
                         });
                         const data = await res.json();
                         if (data.success) {
                           setWalletAddress("BINANCE_SPOT");
                           setBalance(data.balance);
                           setApiCredentials({ apiKey: apiKeyInput.trim(), apiSecret: apiSecretInput.trim() });
                           setWalletConnected(true);
                           setIsConnectingWallet(false);
                           setShowWalletModal(false);
                           setApiKeyInput("");
                           setApiSecretInput("");
                         } else {
                           throw new Error(data.error);
                         }
                       } catch (err: any) {
                         const errorMessage = err.message || "Failed to verify API connection.";
                         if (errorMessage.includes("Invalid API-key, IP, or permissions for action")) {
                            setWalletError("Invalid API Key, IP address not allowed, or missing necessary permissions (like reading balances).");
                         } else if (errorMessage.includes("Signature for this request is not valid")) {
                            setWalletError("Signature verification failed. Please check if your Secret Key is correct.");
                         } else if (errorMessage.includes("Failed to fetch") || errorMessage.includes("Network Error")) {
                            setWalletError("Network error: Could not reach the server to verify your keys. Please check your connection.");
                         } else {
                            setWalletError(`API Verification Failed: ${errorMessage}`);
                         }
                         setIsConnectingWallet(false);
                         setImportMethod("binance");
                       }
                     }}
                     className="flex-[2] py-2 bg-brand-cyan text-black hover:bg-brand-cyan/80 rounded transition-all font-bold text-xs flex justify-center items-center gap-2"
                   >
                     <Key size={14} className="shrink-0" />
                     Connect Binance
                   </button>
                 </div>
                 <div className="mt-4 p-3 bg-black/40 rounded-lg border border-white/5 flex items-start gap-2">
                   <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
                   <p className="text-[10px] text-gray-500 leading-relaxed">
                     This utilizes the MT5 REST API bridge on your VPS to securely mirror <b>Balance</b>, <b>Equity</b>, and <b>Live Positions</b>.
                   </p>
                 </div>
              </div>
            ) : importMethod === "vantage" ? (
              <div className="flex flex-col gap-3 p-2">
                 <div className="text-center space-y-1 mb-4">
                    <p className="text-[10px] text-blue-400 font-mono uppercase tracking-[0.2em]">MetaTrader 5 Sync</p>
                    <h3 className="text-sm font-bold text-white">Vantage VPS Integration</h3>
                 </div>
                 
                 <div className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-xl text-center space-y-3">
                    <div className="relative inline-block">
                       <Zap size={32} className="text-blue-500 animate-pulse relative z-10" />
                       <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                       <p className="text-[10px] text-gray-400 font-mono">Syncing with dedicated terminal at:</p>
                       <p className="text-[11px] text-blue-400 font-bold font-mono">69.169.97.10:8000</p>
                    </div>
                 </div>

                 <div className="flex gap-2 mt-2">
                   <button 
                     onClick={() => { setImportMethod(null); setWalletError(null); }}
                     className="flex-1 py-2 bg-bg-primary border border-border-dim hover:bg-bg-primary/80 rounded transition-all font-bold text-xs"
                   >
                     Cancel
                   </button>
                   <button 
                     onClick={async () => {
                        setWalletStatusMessage("Syncing Vantage MT5...");
                        setIsConnectingWallet(true);
                        try {
                          const res = await fetch('/api/vps/account');
                          const data = await res.json();
                          if (data && !data.error) {
                            setWalletAddress(data.name || "VANTAGE_LIVE");
                            setBalance(data.balance || data.equity || 0);
                            setApiCredentials({ 
                               apiKey: "vantage_vps", 
                               apiSecret: "vps_active"
                            });
                            setWalletConnected(true);
                            setShowWalletModal(false);
                          } else {
                            setWalletError(data.error || "Failed to sync VPS data");
                          }
                        } catch (err: any) {
                          setWalletError("VPS Connection error: " + err.message);
                        }
                        setIsConnectingWallet(false);
                     }}
                     className="flex-[2] py-2.5 bg-blue-600 text-white hover:bg-blue-500 rounded-lg transition-all font-bold text-xs flex justify-center items-center gap-2 shadow-lg shadow-blue-600/20"
                   >
                     <Zap size={14} className="shrink-0" />
                     Sync Account Live
                   </button>
                 </div>
                 <div className="mt-2 text-[10px] text-gray-500 flex items-start gap-1">
                   <Info size={12} className="shrink-0 mt-0.5" />
                   <p>To implement live sync, the server needs the MT4/MT5 REST endpoint provided by Vantage Networks or your active MetaApi account URL.</p>
                 </div>
              </div>
            ) : isConnectingWallet ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="animate-spin text-brand-cyan mb-4" size={32} />
                <div className="text-sm font-bold animate-pulse text-white mb-2">Connecting Wallet</div>
                <div className="text-[10px] text-gray-400 font-mono text-center max-w-[250px]">
                  {walletStatusMessage || "Please wait..."}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => setImportMethod("vantage")}
                  className="w-full flex items-center justify-between px-4 py-3 bg-bg-primary border border-border-dim/50 hover:border-blue-500/50 hover:bg-blue-500/5 rounded transition-all group group-hover:shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <Wallet size={16} className="text-blue-500 group-hover:text-blue-400 transition-colors" />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-sm group-hover:text-blue-400 transition-colors">Vantage Account Connect</div>
                      <div className="text-[10px] text-gray-500 font-mono">Connect your Vantage Markets account</div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-600 group-hover:text-blue-400" />
                </button>

                <button 
                  onClick={connectRealWallet}
                  className="w-full flex items-center justify-between px-4 py-3 bg-bg-primary border border-border-dim/50 hover:border-brand-emerald/50 hover:bg-brand-emerald/5 rounded transition-all group group-hover:shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-emerald/10 flex items-center justify-center">
                      <Zap size={16} className="text-brand-emerald group-hover:text-brand-emerald transition-colors" />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-sm group-hover:text-brand-emerald transition-colors">Web3 Wallet (MetaMask)</div>
                      <div className="text-[10px] text-gray-500 font-mono">Connect browser wallet via Ethers</div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-600 group-hover:text-brand-emerald" />
                </button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-border-dim/50"></div>
                  <span className="flex-shrink-0 mx-4 text-gray-500 text-[10px] uppercase tracking-widest font-mono">or</span>
                  <div className="flex-grow border-t border-border-dim/50"></div>
                </div>

                <button 
                  onClick={() => setImportMethod("binance")}
                  className="w-full flex items-center justify-between px-4 py-3 bg-bg-primary border border-border-dim/50 hover:border-gray-400/50 hover:bg-gray-400/5 rounded transition-all group group-hover:shadow-[0_0_15px_rgba(156,163,175,0.1)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-500/10 flex items-center justify-center">
                      <Key size={16} className="text-gray-400 group-hover:text-white transition-colors" />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-sm group-hover:text-white transition-colors">Connect API Keys</div>
                      <div className="text-[10px] text-gray-500 font-mono">Binance API Key and Secret</div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-600 group-hover:text-white" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alert Notification */}
      {triggeredAlert && (
        <div className="fixed top-6 right-6 z-50 glass-panel border-l-4 border-brand-emerald p-4 shadow-2xl flex items-start gap-4 animate-in slide-in-from-right-4 fade-in">
          <div className="bg-brand-emerald text-white p-1.5 rounded-full mt-0.5">
            <BellRing size={16} />
          </div>
          <div>
            <h4 className="text-white font-bold text-sm">Alert Triggered</h4>
            <p className="text-gray-400 text-xs mt-0.5">
              {symbol} crossed{" "}
              <span className="text-white font-mono">
                ${triggeredAlert.price.toLocaleString()}
              </span>
            </p>
          </div>
          <button
            onClick={() => setTriggeredAlert(null)}
            className="text-gray-500 hover:text-white ml-2"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <TradeAlerts currentSignal={currentSignal} symbol={symbol} />

      <div className="max-w-[1600px] mx-auto space-y-4">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-border-dim/50">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-white tracking-[0.2em] font-mono">
              QUANTANGO — TERMINAL
            </span>
            <div className="flex items-center bg-bg-secondary border border-border-dim rounded p-1 gap-1">
              <button
                onClick={() => setViewMode("ai")}
                className={cn(
                  "px-2 py-0.5 text-[8px] font-bold rounded transition-all",
                  viewMode === "ai"
                    ? "bg-brand-cyan text-black"
                    : "text-gray-500 hover:text-gray-300",
                )}
              >
                QUANTANGO AI
              </button>
              <button
                onClick={() => setViewMode("pro")}
                className={cn(
                  "px-2 py-0.5 text-[8px] font-bold rounded transition-all",
                  viewMode === "pro"
                    ? "bg-brand-cyan text-black"
                    : "text-gray-500 hover:text-gray-300",
                )}
              >
                BACKTEST LAB
              </button>
            </div>
            <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-bg-secondary border border-border-dim">
              <div
                className={cn(
                  "w-1.5 h-1.5 rounded-full blur-[1px]",
                  isConnected
                    ? "bg-brand-emerald animate-blink"
                    : "bg-gray-600",
                )}
              />
              <span
                className={cn(
                  "text-[9px] font-bold uppercase tracking-widest",
                  isConnected ? "text-brand-emerald" : "text-gray-500",
                )}
              >
                {isConnected ? "LIVE STREAM" : "OFFLINE"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono text-gray-500">
            <span>SERVER: ASIA-SOUTH-1</span>
            <span className="hidden sm:inline">LATENCY: 14MS</span>
            <button
              onClick={() => walletConnected ? handleDisconnectWallet() : setShowWalletModal(true)}
              className={cn(
                "ml-2 px-3 py-1.5 flex items-center gap-2 rounded border font-bold transition-all whitespace-nowrap",
                walletConnected
                  ? "bg-bg-secondary border-brand-cyan text-brand-cyan shadow-[0_0_15px_rgba(0,229,255,0.2)]"
                  : "bg-brand-cyan text-black border-brand-cyan hover:bg-white shadow-[0_0_20px_rgba(0,229,255,0.4)] animate-pulse hover:animate-none",
              )}
            >
              <Wallet size={12} className={cn(!walletConnected && "animate-bounce")} />
              {walletConnected
                ? `ACTIVE: ${walletAddress} | $${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : "CONNECT WALLET / API"}
            </button>
            {walletConnected && (
              <button
                onClick={() => setShowTransactions(true)}
                className="ml-2 px-2 py-1.5 flex items-center gap-2 rounded border border-gray-700 bg-bg-secondary text-gray-300 hover:text-white hover:border-gray-500 transition-all"
                title="Transaction History"
              >
                <History size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Note Box */}
        <div className="flex gap-3 bg-bg-secondary/50 border border-border-dim rounded-lg p-3 text-[11px] leading-relaxed italic">
          <Info size={14} className="shrink-0 text-brand-emerald mt-0.5" />
          <p>
            <b className="text-white not-italic">Binance WebSocket</b> streams
            real-time prices with zero delay. Technical indicators are
            calculated client-side every 100ms. AI predictions utilize Anthropic
            Claude 3.5 Sonnet for institutional-grade sentiment analysis.
          </p>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-2">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter mb-1">
                Asset
              </span>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="terminal-input min-w-[140px] font-bold"
              >
                {Object.entries(SYMBOL_GROUPS).map(([group, syms]) => (
                  <optgroup key={group} label={group.toUpperCase()}>
                    {syms.map((s) => (
                      <option key={s} value={s}>
                        {s.replace("USDT", "")}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter mb-1">
                Price Alert
              </span>
              <div className="flex items-center gap-2 bg-bg-secondary border border-border-dim rounded-md px-2 py-0.5">
                <select
                  value={alertDirectionInput}
                  onChange={(e) =>
                    setAlertDirectionInput(e.target.value as "above" | "below")
                  }
                  className="bg-transparent border-none outline-none text-[10px] font-bold uppercase text-gray-400 cursor-pointer"
                >
                  <option value="above">Above</option>
                  <option value="below">Below</option>
                </select>
                <input
                  type="number"
                  value={alertPriceInput}
                  onChange={(e) => setAlertPriceInput(e.target.value)}
                  placeholder={
                    activeAlert
                      ? `${activeAlert.direction} $${activeAlert.price}`
                      : "0.00"
                  }
                  className="bg-transparent border-none outline-none text-white text-xs w-20 font-mono"
                />
                <button
                  onClick={
                    activeAlert ? () => setActiveAlert(null) : handleSetAlert
                  }
                  className={cn(
                    "p-1 rounded transition-colors",
                    activeAlert
                      ? "text-brand-red hover:bg-brand-red/10"
                      : "text-gray-500 hover:text-white",
                  )}
                >
                  {activeAlert ? <X size={14} /> : <Bell size={14} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:self-end">
            {["1m", "5m", "15m", "1h", "4h", "1d"].map((int) => (
              <button
                key={int}
                onClick={() => setIntervalState(int)}
                className={cn(
                  "px-3 py-1 text-[10px] font-mono border rounded transition-all uppercase tracking-tighter",
                  interval === int
                    ? "bg-brand-emerald border-brand-emerald text-white font-bold"
                    : "border-border-dim text-gray-500 hover:text-white hover:border-gray-500",
                )}
              >
                {int}
              </button>
            ))}
            <select
              value={backtestStrategy}
              onChange={(e) => setBacktestStrategy(e.target.value as BacktestStrategy)}
              className="ml-2 bg-bg-secondary border border-border-dim/50 text-gray-300 text-[10px] font-mono p-1 rounded outline-none cursor-pointer hover:border-gray-500 transition-colors"
            >
              <option value="rsi">RSI Mean Reversion</option>
              <option value="macd">MACD Crossover</option>
              <option value="bb">Bollinger Mean Reversion</option>
              <option value="rsi_macd">RSI + MACD</option>
            </select>
            <button
              onClick={handleRunBacktest}
              disabled={isBacktesting || marketData.length < 50}
              className="ml-2 px-4 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-bold rounded flex items-center gap-2 transition-colors uppercase tracking-wider"
            >
              {isBacktesting ? "Running..." : "Run Backtest"}{" "}
              <ChevronRight
                size={12}
                className={isBacktesting ? "animate-spin" : ""}
              />
            </button>
          </div>
        </div>

        {/* Ticker Bar */}
        <TickerBar data={tickers} />

        {/* Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <div className="glass-panel p-4 border-l-2 border-brand-cyan">
            <div className="text-[10px] text-gray-500 font-bold tracking-widest mb-1 flex items-center justify-between">
              QUANTUM EQUITY
              <div className={cn("w-1.5 h-1.5 rounded-full", walletConnected ? "bg-brand-emerald animate-pulse" : "bg-gray-600")} />
            </div>
            <div className="text-xl font-mono font-bold text-brand-cyan leading-none">
              ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1 text-[8px] text-gray-600 font-mono flex justify-between">
               <span>{walletConnected ? "LIVE SYNC ACTIVE" : "SIMULATED BAL"}</span>
               <span>{walletAddress && walletAddress !== "DEMO" ? walletAddress : ""}</span>
            </div>
          </div>
          <div className="glass-panel p-4">
            <div className="text-[10px] text-gray-500 font-bold tracking-widest mb-1">
              LAST PRICE
            </div>
            <div className="text-xl font-mono font-bold text-white leading-none">
              $
              {currentPrice.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
          <div className="glass-panel p-4">
            <div className="text-[10px] text-gray-500 font-bold tracking-widest mb-1 flex justify-between items-center">
              24H CHANGE
              {metrics.change >= 0 ? <TrendingUp size={10} className="text-brand-emerald" /> : <TrendingDown size={10} className="text-brand-red" />}
            </div>
            <div
              className={cn(
                "text-xl font-mono font-bold leading-none",
                metrics.change >= 0 ? "text-brand-emerald" : "text-brand-red",
              )}
            >
              {metrics.change >= 0 ? "+" : ""}
              {metrics.change.toFixed(2)}%
            </div>
          </div>
          <div className="glass-panel p-4">
            <div className="text-[10px] text-gray-500 font-bold tracking-widest mb-1">
              24H HIGH
            </div>
            <div className="text-xl font-mono font-bold text-brand-emerald leading-none">
              ${metrics.high.toLocaleString()}
            </div>
          </div>
          <div className="glass-panel p-4">
            <div className="text-[10px] text-gray-500 font-bold tracking-widest mb-1">
              24H LOW
            </div>
            <div className="text-xl font-mono font-bold text-brand-red leading-none">
              ${metrics.low.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Secondary Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <IndicatorCard
            label="Volume Relative"
            value={marketData[marketData.length - 1]?.volume || 0}
            status="neutral"
            icon={<BarChart2 size={16} />}
          />
          <IndicatorCard
            label="RSI Optimizer"
            value={indicators?.rsi || 0}
            status={
              indicators
                ? indicators.rsi > 70
                  ? "bearish"
                  : indicators.rsi < 30
                    ? "bullish"
                    : "neutral"
                : "neutral"
            }
            icon={<TrendingUp size={16} />}
          />
          <IndicatorCard
            label="Momentum Vector"
            value={indicators?.macd.macdLine || 0}
            subValue={`S: ${indicators?.macd.signalLine || 0}`}
            status={
              indicators
                ? indicators.macd.macdLine > indicators.macd.signalLine
                  ? "bullish"
                  : "bearish"
                : "neutral"
            }
            icon={<Activity size={16} />}
          />
        </div>

        {/* Main Terminal Area */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          {/* Main Chart + Backtest result if any */}
          <div className="xl:col-span-3 glass-panel overflow-hidden flex flex-col relative">
            {backtestResult && (
              <div className="absolute top-12 left-4 z-20 glass-panel bg-bg-secondary/90 border-brand-emerald/50 p-4 shadow-xl max-w-sm animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp size={14} className="text-brand-emerald" />
                    Backtest Analysis
                  </h3>
                  <button
                    onClick={() => setBacktestResult(null)}
                    className="text-gray-500 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div className="bg-bg-primary/50 p-2 rounded">
                    <div className="text-[8px] text-gray-500 uppercase">
                      Return (PnL)
                    </div>
                    <div
                      className={cn(
                        "text-sm font-bold",
                        parseFloat(backtestResult.pnl) >= 0
                          ? "text-brand-emerald"
                          : "text-brand-red",
                      )}
                    >
                      {backtestResult.pnl}%
                    </div>
                  </div>
                  <div className="bg-bg-primary/50 p-2 rounded">
                    <div className="text-[8px] text-gray-500 uppercase">
                      Trades Executed
                    </div>
                    <div className="text-sm font-bold text-white">
                      {backtestResult.trades}
                    </div>
                  </div>
                  <div className="bg-bg-primary/50 p-2 rounded col-span-2 border-t border-border-dim/30 mt-1">
                    <div className="text-[8px] text-gray-500 uppercase">
                      Final Balance
                    </div>
                    <div className="text-xs font-bold text-white">
                      $
                      {backtestResult.finalBalance?.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">
                    Equity Growth Curve
                  </div>
                  <div className="bg-bg-primary/30 rounded border border-border-dim/20">
                    <BacktestEquityChart data={backtestResult.equityHistory} />
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-border-dim/30 text-[9px] text-gray-400 italic">
                  Strategy: {backtestResult.strategyName || 'RSI (14) Mean Reversion'}. Period: Last{" "}
                  {marketData.length} candles.
                </div>
              </div>
            )}
            <div className="px-4 py-3 border-b border-border-dim/50 flex justify-between items-center bg-bg-secondary/40">
              <span className="text-[10px] font-bold text-gray-400 font-mono">
                {viewMode === "ai"
                  ? `LIVE AI ANALYSIS — ${symbol}`
                  : `TRADINGVIEW PRO — ${symbol}`}
              </span>
              <div className="flex gap-4">
                <span className="text-[9px] text-gray-500 uppercase tracking-widest">
                  O: {marketData[marketData.length - 1]?.open}
                </span>
                <span className="text-[9px] text-gray-500 uppercase tracking-widest">
                  H: {marketData[marketData.length - 1]?.high}
                </span>
                <span className="text-[9px] text-gray-500 uppercase tracking-widest">
                  L: {marketData[marketData.length - 1]?.low}
                </span>
              </div>
            </div>
            <div
              className={cn(
                "flex-1 relative",
                viewMode === "pro" ? "min-h-[500px]" : "min-h-[400px]",
              )}
            >
              {marketDataError && (
                <div className="absolute inset-0 z-20 bg-bg-primary/95 flex flex-col items-center justify-center p-6 text-center border border-brand-red/20 rounded">
                  <Activity className="text-brand-red mb-4 opacity-50" size={32} />
                  <h3 className="text-brand-red font-bold uppercase tracking-widest text-[11px] mb-2">Data Fetch Failed</h3>
                  <p className="text-gray-400 text-[10px] font-mono">{marketDataError}</p>
                </div>
              )}
              {loading && !marketDataError && (
                <div className="absolute inset-0 z-10 bg-bg-primary/50 flex items-center justify-center animate-pulse">
                  <Activity className="text-brand-emerald" />
                </div>
              )}
              {viewMode === "ai" ? (
                <ChartWidget data={marketData} />
              ) : (
                <TradingViewAdvancedChart symbol={symbol} />
              )}
            </div>
          </div>

          <div className="xl:col-span-1 flex flex-col gap-4">
            <div className="glass-panel flex flex-col flex-1 min-h-[400px]">
              <div className="px-4 py-3 border-b border-border-dim/50 bg-bg-secondary/40">
                <span className="text-[10px] font-bold text-gray-400 font-mono tracking-widest uppercase">
                  Historical Log — {symbol}
                </span>
              </div>
              <HistoricalTable data={marketData} />
            </div>
          </div>
        </div>

        {/* Footer Area: Strategy vs AI Predict vs News */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="flex flex-col gap-4">
            <div className="glass-panel flex flex-col flex-1">
              <div className="px-4 py-3 border-b border-border-dim/50 bg-bg-secondary/40 flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-400 font-mono tracking-widest uppercase">
                  Strategy Metrics
                </span>
              </div>
              <div className="p-4 flex-1">
                <StrategyMetricsWidget strategyName="RSI Mean Reversion" />
              </div>
            </div>

            <div className="glass-panel flex flex-col flex-1">
              <div className="px-4 py-3 border-b border-border-dim/50 bg-bg-secondary/40 flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-400 font-mono tracking-widest uppercase">
                  Global Ranking
                </span>
              </div>
              <div className="p-4 flex-1">
                <StrategyScoreboard />
              </div>
            </div>
          </div>

          <div className="glass-panel h-[400px]">
            <AIPredictionWidget
              symbol={symbol}
              price={currentPrice}
              indicators={indicators}
              change24h={metrics.change}
              newsSentiment={globalSentiment || undefined}
            />
          </div>

          <div className="glass-panel h-[400px] border-[#00FFFF]/30 shadow-[0_0_20px_rgba(0,255,255,0.05)_inset]">
            <QuantumBotWidget
              symbol={symbol}
              currentPrice={currentPrice}
              walletConnected={walletConnected}
              balance={balance}
              setBalance={setBalance}
              apiCredentials={apiCredentials}
              importMethod={importMethod}
              aiSignal={
                currentSignal?.type === "BUY"
                  ? "bullish"
                  : currentSignal?.type === "SELL"
                    ? "bearish"
                    : "neutral"
              }
              technicalSignal={{
                rsi: indicators?.rsi || 50,
                macdSignal: (indicators?.macd?.hist || 0) > 0 ? "bullish" : "bearish",
                trend: (indicators?.sma?.sma20 || 0) > (indicators?.sma?.sma50 || 0) ? "up" : "down"
              }}
              onTradeClose={(trade) =>
                setTransactions((prev) => [trade, ...prev].slice(0, 100))
              }
            />
          </div>

          <div className="glass-panel flex flex-col h-[400px] overflow-hidden border-blue-500/20">
            {walletConnected && apiCredentials?.apiKey === "vantage_vps" ? (
              <div className="flex flex-col h-full">
                <div className="px-4 py-3 border-b border-blue-500/20 bg-blue-500/5 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-blue-400 font-mono tracking-widest uppercase flex items-center gap-2">
                    <Activity size={12} />
                    Live MT5 Account
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-emerald animate-pulse" />
                    <span className="text-[9px] text-brand-emerald font-mono uppercase">Live Data</span>
                  </div>
                </div>
                
                <div className="p-4 grid grid-cols-2 gap-3 border-b border-white/5 bg-black/20">
                  <div className="space-y-0.5">
                    <p className="text-[9px] text-gray-500 font-mono uppercase">Equity</p>
                    <p className="text-sm font-bold text-white font-mono transition-all">
                      ${(mt5AccountInfo?.equity || balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="space-y-0.5 text-right">
                    <p className="text-[9px] text-gray-500 font-mono uppercase">Unrealized P/L</p>
                    <p className={cn(
                      "text-sm font-bold font-mono transition-all",
                      (mt5AccountInfo?.profit || 0) >= 0 ? "text-brand-emerald" : "text-brand-red"
                    )}>
                      {(mt5AccountInfo?.profit || 0) >= 0 ? "+" : ""}{(mt5AccountInfo?.profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-[10px] font-mono border-collapse">
                    <thead className="sticky top-0 bg-[#0f1115] text-gray-600 uppercase border-b border-white/5">
                      <tr>
                        <th className="px-3 py-1.5 font-medium">Ticket</th>
                        <th className="px-1 py-1.5 font-medium text-center">Type</th>
                        <th className="px-3 py-1.5 font-medium text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={3} className="px-3 py-8 text-center text-gray-600 italic opacity-40">
                          Execution engine active on MT5 terminal
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <NewsWidget
                symbol={symbol}
                onSentimentAnalyzed={setGlobalSentiment}
              />
            )}
          </div>
        </div>

        {/* TradingView Screener / Market Everything */}
        <div className="glass-panel w-full h-[600px] mt-4 flex flex-col">
          <div className="px-4 py-3 border-b border-border-dim/50 bg-bg-secondary/40 flex justify-between items-center">
            <span className="text-[10px] font-bold text-gray-400 font-mono tracking-widest uppercase items-center flex gap-2">
              <TrendingUp size={12} className="text-brand-emerald" />
              Market Screener — All Stocks & Meme Coins
            </span>
            <span className="text-[8px] text-gray-600 font-mono">
              POWERED BY TRADINGVIEW
            </span>
          </div>
          <div className="p-0 flex-1 overflow-hidden">
            <TradingViewScreener />
          </div>
        </div>

        {/* Market Heatmap */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="glass-panel h-[400px] flex flex-col">
            <div className="px-4 py-3 border-b border-border-dim/50 bg-bg-secondary/40 flex justify-between items-center">
              <span className="text-[10px] font-bold text-gray-400 font-mono tracking-widest uppercase items-center flex gap-2">
                <Activity size={12} className="text-brand-emerald" />
                Crypto Heatmap
              </span>
            </div>
            <div className="flex-1 p-0 overflow-hidden">
              <TradingViewHeatmap />
            </div>
          </div>

          <div className="glass-panel h-[400px] flex flex-col items-center justify-center p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-brand-emerald/10 border border-brand-emerald/30 flex items-center justify-center mb-4">
              <TrendingUp size={24} className="text-brand-emerald" />
            </div>
            <h3 className="text-white font-bold mb-2">
              Institutional Intelligence
            </h3>
            <p className="text-gray-500 text-xs leading-relaxed max-w-xs">
              Your terminal is now connected to global liquidity hubs. Use the
              Screener to find high-velocity setups across 50,000+ instruments.
            </p>
            <div className="mt-6 flex gap-2">
              <button className="px-4 py-2 bg-bg-secondary border border-border-dim rounded text-[10px] font-bold text-gray-400 hover:text-white transition-colors">
                EXPORT DATA
              </button>
              <button className="px-4 py-2 bg-brand-emerald text-white rounded text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-brand-emerald/20">
                OPEN PRO TERMINAL
              </button>
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-12 pt-6 border-t border-border-dim max-w-[1600px] mx-auto pb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="text-[10px] font-mono text-gray-600">
          © 2026 QUANTANGO PLATFORM | DATA PRV: BINANCE CLOUD
        </div>
        <div className="flex gap-4">
          <a
            href="#"
            className="text-[10px] font-mono text-gray-500 hover:text-white transition-colors"
          >
            API DOCS
          </a>
          <a
            href="#"
            className="text-[10px] font-mono text-gray-500 hover:text-white transition-colors"
          >
            STATUS
          </a>
          <a
            href="#"
            className="text-[10px] font-mono text-gray-500 hover:text-white transition-colors"
          >
            PRIVACY
          </a>
        </div>
      </footer>

      {showTransactions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0f1115]/95 border border-white/10 shadow-2xl rounded-lg w-full max-w-3xl flex flex-col h-[600px] overflow-hidden relative">
            <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,255,255,0.1),transparent_50%)] pointer-events-none" />
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center z-10 bg-black/40">
              <div className="flex items-center gap-3">
                <History className="text-[#00FFFF]" size={18} />
                <h2 className="text-sm font-bold text-white uppercase tracking-widest font-mono">
                  On-Chain Transaction Log
                </h2>
                <span className="text-[10px] font-mono text-[#00FFFF]/60 border border-[#00FFFF]/20 px-2 py-0.5 rounded ml-2">
                  {walletAddress}
                </span>
              </div>
              <button
                onClick={() => setShowTransactions(false)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 z-10 custom-scrollbar">
              {transactions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-60">
                  <Activity size={32} className="mb-4" />
                  <p className="text-xs font-mono uppercase tracking-widest">
                    No transactions recorded in current execution session.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="bg-black/40 border border-white/5 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "w-12 py-1 flex justify-center items-center rounded text-[10px] font-bold text-black",
                            tx.type === "LONG"
                              ? "bg-brand-emerald"
                              : "bg-brand-red",
                          )}
                        >
                          {tx.type}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-white font-bold">
                            {tx.symbol}{" "}
                            <span className="text-gray-500 text-[10px] ml-1">
                              USDT-M
                            </span>
                          </span>
                          <span className="text-gray-500 text-[9px] mt-0.5">
                            {tx.time.toISOString().split("T")[1].slice(0, -1)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-center flex-1 max-w-[200px] border-x border-white/5 px-4 mx-4">
                        <div className="flex flex-col items-center">
                          <span className="text-gray-500 text-[9px]">
                            ENTRY
                          </span>
                          <span className="text-gray-300">
                            {tx.entryPrice.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <ArrowRight size={12} className="text-gray-600 mx-3" />
                        <div className="flex flex-col items-center">
                          <span className="text-gray-500 text-[9px]">EXIT</span>
                          <span className="text-gray-300">
                            {tx.exitPrice.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end min-w-[80px]">
                        <span className="text-gray-500 text-[9px] mb-0.5">
                          NET PNL
                        </span>
                        <span
                          className={cn(
                            "font-bold text-sm",
                            tx.pnl >= 0
                              ? "text-brand-emerald"
                              : "text-brand-red",
                          )}
                        >
                          {tx.pnl >= 0 ? "+" : ""}
                          {tx.pnl.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-3 border-t border-white/10 bg-black/60 flex justify-between items-center z-10">
              <span className="text-[10px] text-gray-500 font-mono">
                TOTAL EXECUTIONS: {transactions.length}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 font-mono">
                  NET PROFIT:
                </span>
                <span
                  className={cn(
                    "font-bold font-mono text-xs",
                    transactions.reduce((acc, tx) => acc + tx.pnl, 0) >= 0
                      ? "text-brand-emerald"
                      : "text-brand-red",
                  )}
                >
                  {transactions.reduce((acc, tx) => acc + tx.pnl, 0).toFixed(2)}{" "}
                  USDT
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
