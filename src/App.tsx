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
  History,
  ArrowRight,
  Loader2,
  Key,
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
  const [balance, setBalance] = useState(25000);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showTransactions, setShowTransactions] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importInput, setImportInput] = useState("");

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
        
        setWalletConnected(true);
        setWalletAddress(
          address.substring(0, 6) + "..." + address.substring(address.length - 4)
        );
        setBalance(Number(ethers.formatEther(balanceWei)));
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
            
            {isImporting ? (
              <div className="flex flex-col gap-3">
                 <p className="text-xs text-gray-300 font-mono">Enter your Seed Phrase or Private Key to import your wallet.</p>
                 <textarea 
                   className="w-full h-24 bg-black/50 border border-border-dim rounded p-2 text-white font-mono text-xs focus:border-brand-cyan focus:outline-none resize-none"
                   placeholder="e.g. word1 word2 word3..."
                   value={importInput}
                   onChange={(e) => setImportInput(e.target.value)}
                 />
                 <div className="flex gap-2 mt-2">
                   <button 
                     onClick={() => { setIsImporting(false); setImportInput(""); setWalletError(null); }}
                     className="flex-1 py-2 bg-bg-primary border border-border-dim hover:bg-bg-primary/80 rounded transition-all font-bold text-xs"
                   >
                     Cancel
                   </button>
                   <button 
                     onClick={async () => {
                       if (!importInput.trim()) {
                         setWalletError("Please enter a valid seed phrase or private key.");
                         return;
                       }
                       setWalletStatusMessage("Importing wallet...");
                       setIsImporting(false);
                       setIsConnectingWallet(true);
                       try {
                         let wallet;
                         const input = importInput.trim();
                         // Check if it's a seed phrase (usually 12 or 24 words)
                         if (input.split(" ").length >= 12) {
                           wallet = ethers.Wallet.fromPhrase(input);
                         } else {
                           // Assume private key
                           // Private keys usually start with 0x, add if missing
                           const formattedKey = input.startsWith("0x") ? input : `0x${input}`;
                           wallet = new ethers.Wallet(formattedKey);
                         }

                         setWalletStatusMessage("Fetching balance from network...");
                         // Using public RPC to fetch ETH balance (could be any EVM chain)
                         const provider = new ethers.JsonRpcProvider("https://eth.llamarpc.com");
                         const balanceWei = await provider.getBalance(wallet.address);
                         const balanceEth = Number(ethers.formatEther(balanceWei));

                         setWalletAddress(wallet.address.substring(0, 6) + "..." + wallet.address.substring(wallet.address.length - 4));
                         setBalance(balanceEth);
                         setWalletConnected(true);
                         setIsConnectingWallet(false);
                         setShowWalletModal(false);
                         setImportInput("");
                       } catch (err: any) {
                         setWalletError("Invalid Private Key or Seed Phrase.");
                         setIsConnectingWallet(false);
                       }
                     }}
                     className="flex-[2] py-2 bg-brand-cyan text-black hover:bg-brand-cyan/80 rounded transition-all font-bold text-xs"
                   >
                     Import Wallet
                   </button>
                 </div>
                 <div className="mt-2 text-[10px] text-gray-500 flex items-start gap-1">
                   <Info size={12} className="shrink-0 mt-0.5" />
                   <p>For your security during this simulation, any mock key can be used. Do not enter real seed phrases.</p>
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
                  onClick={() => {
                     // Attempt to open Binance App via deep link
                     if (isMobile) {
                        window.location.href = "bnc://app.binance.com/";
                        setTimeout(() => {
                          setWalletError("If the Binance app didn't open, please ensure it is installed.");
                        }, 2000);
                     } else {
                        // Check if browser extension exists
                        if (typeof (window as any).BinanceChain !== "undefined") {
                           setWalletStatusMessage("Requesting connection to Binance Wallet...");
                           setIsConnectingWallet(true);
                           (window as any).BinanceChain.request({ method: 'eth_requestAccounts' })
                              .then((accounts: string[]) => {
                                 setWalletAddress(accounts[0].substring(0, 6) + "..." + accounts[0].substring(accounts[0].length - 4));
                                 setBalance(Math.floor(Math.random() * 50000) + 10000);
                                 setWalletConnected(true);
                                 setIsConnectingWallet(false);
                                 setShowWalletModal(false);
                              })
                              .catch((err: any) => {
                                setWalletError(err.message || "Failed to connect to Binance Wallet");
                                setIsConnectingWallet(false);
                              });
                        } else {
                           setWalletError("Binance Wallet has not been detected. Please install the App or extension.");
                           window.open("https://www.binance.com/en/web3wallet", "_blank");
                        }
                     }
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 bg-bg-primary border border-border-dim/50 hover:border-[#FCD535]/50 hover:bg-[#FCD535]/5 rounded transition-all group group-hover:shadow-[0_0_15px_rgba(252,213,53,0.1)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#FCD535]/10 flex items-center justify-center">
                      <div className="w-5 h-5 rounded bg-[#FCD535] flex items-center justify-center text-black font-bold text-[10px]">BNB</div>
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-sm group-hover:text-[#FCD535] transition-colors">Binance Web3 Wallet</div>
                      <div className="text-[10px] text-gray-500 font-mono">Binance App / Extension</div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-600 group-hover:text-[#FCD535]" />
                </button>
                
                <button 
                  onClick={() => {
                     // Phantom wallet integration
                     const isPhantomInstalled = (window as any).phantom?.solana?.isPhantom || (window as any).solana?.isPhantom;
                     if (isPhantomInstalled) {
                        const provider = (window as any).phantom?.solana || (window as any).solana;
                        setWalletStatusMessage("Connecting to Phantom...");
                        setIsConnectingWallet(true);
                        provider.connect()
                           .then((resp: any) => {
                              setWalletAddress(resp.publicKey.toString().substring(0, 6) + "..." + resp.publicKey.toString().substring(resp.publicKey.toString().length - 4));
                              setBalance(Math.random() * 100); // Mock SOL balance 
                              setWalletConnected(true);
                              setIsConnectingWallet(false);
                              setShowWalletModal(false);
                           })
                           .catch((err: any) => {
                              setWalletError(err.message || "Failed to connect to Phantom");
                              setIsConnectingWallet(false);
                           });
                     } else {
                        setWalletError("Phantom Wallet not detected. Please install the browser extension.");
                        window.open("https://phantom.app/", "_blank");
                     }
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 bg-bg-primary border border-border-dim/50 hover:border-[#AB9FF2]/50 hover:bg-[#AB9FF2]/5 rounded transition-all group group-hover:shadow-[0_0_15px_rgba(171,159,242,0.1)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#AB9FF2]/10 flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-[#AB9FF2] flex items-center justify-center text-white border border-white/20">
                          <svg width="12" height="12" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M54.5455 11.239C63.8182 12.0163 118.727 16.294 121.818 51.6841C122.909 63.3551 113.818 73.0805 106.909 77.3582C96.3636 84.7495 62.1818 64.9094 58.9091 59.8521L58.5455 60.241C55.2727 64.5204 22.9091 80.8601 22.9091 80.8601L25.8182 60.241C25.8182 60.241 -2.90909 46.2343 0.363636 29.8967C2.90909 8.11326 43.6364 10.4616 54.5455 11.239Z" fill="white"/><path d="M78.1818 41.1793C83.2727 41.1793 87.2727 45.0684 87.2727 50.1264C87.2727 55.1843 83.2727 59.0734 78.1818 59.0734C73.0909 59.0734 69.0909 55.1843 69.0909 50.1264C69.0909 45.0684 73.0909 41.1793 78.1818 41.1793Z" fill="#AB9FF2"/><path d="M43.6364 41.1793C48.7273 41.1793 52.7273 45.0684 52.7273 50.1264C52.7273 55.1843 48.7273 59.0734 43.6364 59.0734C38.5455 59.0734 34.5455 55.1843 34.5455 50.1264C34.5455 45.0684 38.5455 41.1793 43.6364 41.1793Z" fill="#AB9FF2"/></svg>
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-sm group-hover:text-[#AB9FF2] transition-colors">Phantom</div>
                      <div className="text-[10px] text-gray-500 font-mono">Solana / Ethereum Extension</div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-600 group-hover:text-[#AB9FF2]" />
                </button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-border-dim/50"></div>
                  <span className="flex-shrink-0 mx-4 text-gray-500 text-[10px] uppercase tracking-widest font-mono">or</span>
                  <div className="flex-grow border-t border-border-dim/50"></div>
                </div>

                <button 
                  onClick={() => setIsImporting(true)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-bg-primary border border-border-dim/50 hover:border-gray-400/50 hover:bg-gray-400/5 rounded transition-all group group-hover:shadow-[0_0_15px_rgba(156,163,175,0.1)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-500/10 flex items-center justify-center">
                      <Key size={16} className="text-gray-400 group-hover:text-white transition-colors" />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-sm group-hover:text-white transition-colors">Import Wallet</div>
                      <div className="text-[10px] text-gray-500 font-mono">Use Private Key or Seed Phrase</div>
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
                  ? "bg-bg-secondary border-brand-cyan text-brand-cyan shadow-[0_0_10px_rgba(0,229,255,0.2)]"
                  : "bg-brand-cyan text-black border-brand-cyan hover:bg-brand-cyan/80",
              )}
            >
              <Wallet size={12} />
              {walletConnected
                ? `${walletAddress} | $${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : "CONNECT WALLET"}
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            <div className="text-[10px] text-gray-500 font-bold tracking-widest mb-1">
              24H CHANGE
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

          <div className="glass-panel h-[400px] flex flex-col">
            <NewsWidget
              symbol={symbol}
              onSentimentAnalyzed={setGlobalSentiment}
            />
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
