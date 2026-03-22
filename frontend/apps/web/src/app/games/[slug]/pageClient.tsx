"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  CurrencyDollarIcon, WalletIcon, InformationCircleIcon, ChartBarIcon, 
  ShieldCheckIcon, SparklesIcon,
  ClockIcon
} from "@heroicons/react/24/outline";

import { 
  AuditTabs, AuditTableHeader, AuditTableRow, AuditTableCell,
  StatusBadge, 
  cn 
} from "@ssot/ui";

import { Placeholder } from "../../../components/Placeholder";
import { PageTransition } from "../../../components/PageTransition";
import { ImmersiveGameLayout } from "../../../components/ImmersiveGameLayout";

import { getGameEncoder } from "@ssot/ssot/encoding";
import { useBetsByGame } from "../../../features/bets/useBetsByGame";
import { useIndexer } from "../../../features/ops/useIndexer";
import { useRelease } from "../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../ssot/sdk";
import { usePlaceBetStepper } from "../../../features/betting/usePlaceBetStepper";

/* ─── Types & Constants ─── */
type GameMeta = { gameId: `0x${string}`; slug: string; label: string; module: `0x${string}`; };
type BetStatus = "won" | "lost" | "pending" | "settled" | "cancelled";

function toGameMeta(raw: any): GameMeta {
  return {
    gameId: raw.gameId as `0x${string}`,
    slug: String(raw.slug),
    label: String(raw.label),
    module: raw.module as `0x${string}`,
  };
}

function shortHex(value?: string) {
  if (!value) return "—";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function mapBetState(state?: string): BetStatus {
  if (!state) return "pending";
  const normalized = state.toLowerCase();
  if (normalized.includes("won")) return "won";
  if (normalized.includes("lost")) return "lost";
  if (normalized.includes("final") || normalized.includes("settled")) return "settled";
  if (normalized.includes("refund")) return "cancelled";
  return "pending";
}

const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const europeanWheelOrder = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

/* ─── Sub-Components ─── */

const DiceDot = () => <div className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 bg-white rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_0_8px_rgba(255,255,255,0.8)]" />;

const DiceFace = ({ type, className }: { type: 1|2|3|4|5|6, className: string }) => (
  <div className={cn("absolute inset-0 bg-gradient-to-br from-purple-500 to-purple-900 border-[3px] border-purple-400/80 rounded-[1.5rem] shadow-[inset_0_0_40px_rgba(0,0,0,0.9),0_0_20px_rgba(168,85,247,0.4)] flex items-center justify-center backface-hidden", className)}>
    <div className="grid grid-cols-3 grid-rows-3 gap-2 p-3 w-full h-full">
      {type === 1 && <><div/><div/><div/><div/><div className="place-self-center"><DiceDot/></div><div/><div/><div/><div/></>}
      {type === 2 && <><div/><div/><div className="place-self-end"><DiceDot/></div><div/><div/><div/><div className="place-self-start"><DiceDot/></div><div/><div/></>}
      {type === 3 && <><div/><div/><div className="place-self-end"><DiceDot/></div><div/><div className="place-self-center"><DiceDot/></div><div/><div className="place-self-start"><DiceDot/></div><div/><div/></>}
      {type === 4 && <><div className="place-self-start"><DiceDot/></div><div/><div className="place-self-end"><DiceDot/></div><div/><div/><div/><div className="place-self-start"><DiceDot/></div><div/><div className="place-self-end"><DiceDot/></div></>}
      {type === 5 && <><div className="place-self-start"><DiceDot/></div><div/><div className="place-self-end"><DiceDot/></div><div/><div className="place-self-center"><DiceDot/></div><div/><div className="place-self-start"><DiceDot/></div><div/><div className="place-self-end"><DiceDot/></div></>}
      {type === 6 && <><div className="place-self-start"><DiceDot/></div><div/><div className="place-self-end"><DiceDot/></div><div className="place-self-start"><DiceDot/></div><div/><div className="place-self-end"><DiceDot/></div><div className="place-self-start"><DiceDot/></div><div/><div className="place-self-end"><DiceDot/></div></>}
    </div>
  </div>
);

/* ─── Main Logic ─── */

export function GamePageClient({ slug }: { slug: string }) {
  const router = useRouter();
  const { release, readOnlyReason } = useRelease();
  const { sdk } = useSSOTSDK();
  const { indexerStatus } = useIndexer();

  const isSynced = indexerStatus?.latestBlock && indexerStatus?.lastSyncedBlock && indexerStatus.latestBlock <= indexerStatus.lastSyncedBlock;

  const game = React.useMemo(() => {
    const found = release?.gamesMeta?.find((item: any) => item.slug === slug);
    return found ? toGameMeta(found) : null;
  }, [release?.gamesMeta, slug]);

  const recentBetsQuery = useBetsByGame(game?.gameId, 12);
  const recentBets = recentBetsQuery.data ?? [];

  // Local State
  const [betAmount, setBetAmount] = React.useState<number>(10);
  const [isPending, setIsPending] = React.useState(false);
  const [showResult, setShowResult] = React.useState(false);
  
  // Game-specific params
  const [diceTarget, setDiceTarget] = React.useState<number>(50);
  const [diceDirection, setDiceDirection] = React.useState<"under" | "over">("under");
  const [coinSide, setCoinSide] = React.useState<"HEADS" | "TAILS">("HEADS");
  const [rouletteSpots, setRouletteSpots] = React.useState<string[]>([]);
  const [kenoSpots, setKenoSpots] = React.useState<number[]>([]);

  // Simulation state
  const [flipCount, setFlipCount] = React.useState(0);
  const [resultNum, setResultNum] = React.useState<number | null>(null);
  const [animatingKenoSpots, setAnimatingKenoSpots] = React.useState<number[]>([]);

  // History state for widgets
  const [gameHistory, setGameHistory] = React.useState<any[]>([]);

  // Keno strobe effect
  React.useEffect(() => {
     let interval: NodeJS.Timeout;
     if (isPending && game?.slug === 'keno') {
        interval = setInterval(() => {
           const rnd: number[] = []; while (rnd.length < 8) { const num = Math.floor(Math.random() * 40) + 1; if (!rnd.includes(num)) rnd.push(num); } setAnimatingKenoSpots(rnd);
        }, 80);
     } else {
        setAnimatingKenoSpots([]);
     }
     return () => clearInterval(interval);
  }, [isPending, game?.slug]);

  if (!release || !game) return <Placeholder title="Module Not Found" description={readOnlyReason ?? "Game not found."} specPath="docs/frontend/PAGE-SPECS/010-GAMES.md" />;

  const themeColor: any = 
    game.slug === "dice" ? "purple" : 
    game.slug === "roulette" ? "emerald" :
    game.slug === "coin-toss" ? "amber" : "fuchsia";

  const houseEdge = game.slug === "roulette" ? "2.70%" : "1.00%";
  const maxPayout = game.slug === "roulette" ? "100,000 USDC" : (game.slug === 'keno' ? "500,000 USDC" : "25,000 USDC");

  const winChance = (() => {
    if (game.slug === "dice") return diceDirection === "under" ? diceTarget : 100 - diceTarget;
    if (game.slug === "coin-toss") return 50;
    if (game.slug === "roulette") return (rouletteSpots.length * (100 / 37)) || 0;
    if (game.slug === "keno") return kenoSpots.length > 0 ? (100 / Math.pow(2, 10 - kenoSpots.length)) : 0;
    return 100;
  })();

  const multiplier = winChance === 0 ? 0 : (99 / winChance);
  const expectedPayout = betAmount * multiplier;

  const { planNow } = usePlaceBetStepper();

  const handleAmountChange = (val: number) => {
    const rounded = Math.floor(Math.max(1, val));
    setBetAmount(rounded);
  };

  const handlePlaceBet = async () => {
    if (!sdk || !game || (game.slug !== 'dice' && winChance === 0)) return;
    setIsPending(true);
    setShowResult(false);
    
    let simulatedRes = 0;
    if (game.slug === "coin-toss") { setFlipCount(c => c + 1); simulatedRes = Math.random() > 0.5 ? 1 : 0; }
    if (game.slug === "roulette") { simulatedRes = europeanWheelOrder[Math.floor(Math.random()*37)]; setResultNum(simulatedRes); }
    if (game.slug === "dice") { simulatedRes = Math.floor(Math.random()*100); setResultNum(simulatedRes); }

    try {
      const encoder = getGameEncoder(game.slug);
      let params = "0x" as `0x${string}`;
      if (encoder) {
        if (game.slug === "dice") params = (encoder as any).encode({ cap: diceTarget });
        else if (game.slug === "coin-toss") params = (encoder as any).encode({ face: coinSide === "HEADS" });
        else if (game.slug === "roulette") params = (encoder as any).encode({ kind: "straight", number: parseInt(rouletteSpots[0] || "0") });
        else if (game.slug === "keno") params = (encoder as any).encode({ mask: BigInt(kenoSpots.length) });
      }

      const usdcAsset = release.assets.find((a: any) => a.symbol === "USDC");
      await planNow({
        chainId: release.chainId,
        gameId: game.gameId,
        asset: (usdcAsset?.address || "0x0000000000000000000000000000000000000000") as `0x${string}`,
        betCount: 1,
        stake: BigInt(betAmount) * BigInt(Math.pow(10, usdcAsset?.decimals || 6)),
        params,
        stakeSpec: "0x" as `0x${string}`,
        maxHouseEdgeBps: 1000,
      });

      // Simulation WOW
      setTimeout(() => {
        setIsPending(false);
        setShowResult(true);
        setGameHistory(prev => [{ val: simulatedRes, win: true }, ...prev].slice(0, 5));
        setTimeout(() => setShowResult(false), 5000);
      }, (game.slug === 'roulette' ? 4000 : 2500));
    } catch (e) {
      console.error(e);
      setIsPending(false);
    }
  };

  const LeftPane = (
    <>
      <div className="flex justify-between items-center mb-6">
         <span className="text-sm font-bold text-white/60 flex items-center gap-2">
             <WalletIcon className="w-4 h-4" /> Wallet Balance
         </span>
         <span className="font-mono text-white bg-white/5 py-1 px-3 rounded-lg border border-white/10 shadow-inner">
           {isSynced ? "1,450.20 USDC" : "Syncing..."}
         </span>
      </div>

      {game.slug === 'roulette' && (
         <div className="mb-6 bg-[#050505] rounded-2xl border border-white/10 p-4 min-h-[120px] shadow-inner">
            <div className="flex justify-between items-center mb-3">
               <label className="text-[10px] uppercase tracking-widest font-bold text-emerald-400 block tracking-wider">Selected Targets ({rouletteSpots.length})</label>
               <button onClick={() => setRouletteSpots([])} className="text-[10px] font-bold text-white/40 hover:text-white transition-all uppercase tracking-tight">Clear All</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
               {rouletteSpots.map(spot => (
                  <div key={spot} className={cn("px-2.5 py-1.5 rounded text-[10px] font-bold font-mono border-b-2 shadow-inner", 
                    spot === "0" ? "bg-emerald-500 text-white border-emerald-300" : redNumbers.includes(parseInt(spot)) ? "bg-red-600 text-white border-red-400" : "bg-black text-white border-white/20"
                  )}>{spot}</div>
               ))}
               {rouletteSpots.length === 0 && <span className="text-[10px] text-white/20 italic">No targets selected. Click the board.</span>}
            </div>
         </div>
      )}

      {game.slug === 'coin-toss' && (
        <div className="mb-6">
           <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">Call The Coin</label>
           <div className="flex bg-[#050505] p-1.5 rounded-2xl border border-white/10 relative shadow-inner h-16">
              <div className={cn("absolute inset-y-1.5 w-[calc(50%-6px)] rounded-xl transition-all duration-500 ease-out shadow-[0_0_20px_rgba(0,0,0,0.8)]", coinSide === "HEADS" ? "bg-gradient-to-br from-amber-400 to-amber-600 left-1.5" : "bg-gradient-to-br from-indigo-400 to-indigo-600 left-[calc(50%+4px)]")} />
              <button onClick={() => setCoinSide("HEADS")} className={cn("flex-1 rounded-xl font-bold uppercase tracking-wider text-sm relative z-10 transition-colors flex items-center justify-center gap-2", coinSide === "HEADS" ? "text-amber-950 font-extrabold" : "text-white/40 hover:text-white")}>
                 <SparklesIcon className={cn("w-5 h-5", coinSide === "HEADS" ? "text-amber-900" : "opacity-30")} /> Heads
              </button>
              <button onClick={() => setCoinSide("TAILS")} className={cn("flex-1 rounded-xl font-bold uppercase tracking-wider text-sm relative z-10 transition-colors flex items-center justify-center gap-2", coinSide === "TAILS" ? "text-indigo-950 font-extrabold" : "text-white/40 hover:text-white")}>
                 <ShieldCheckIcon className={cn("w-5 h-5", coinSide === "TAILS" ? "text-indigo-900" : "opacity-30")} /> Tails
              </button>
           </div>
        </div>
      )}

      {game.slug === 'keno' && (
        <div className="flex flex-col gap-3 rounded-2xl bg-[#050505] border border-white/10 p-4 mb-6 shadow-inner">
           <div className="flex justify-between items-center">
              <span className="text-xl font-bold font-mono text-white">{kenoSpots.length} <span className="text-white/30 text-sm">/ 10</span></span>
              <div className="flex gap-2">
                 <button onClick={() => { const r:any[]=[]; while(r.length<10){const n=Math.floor(Math.random()*40)+1; if(!r.includes(n))r.push(n);} setKenoSpots(r); }} className="px-3 py-1.5 rounded-lg border border-fuchsia-500/50 bg-fuchsia-500/10 text-fuchsia-300 text-[10px] font-bold uppercase">Auto Pick</button>
                 <button onClick={() => setKenoSpots([])} className="px-3 py-1.5 rounded-lg bg-[#111] border border-white/5 text-white/40 text-[10px] font-bold uppercase">Clear</button>
              </div>
           </div>
           <div className="flex flex-wrap gap-1">
              {kenoSpots.sort((a,b)=>a-b).map(n => <div key={n} className="w-6 h-6 flex items-center justify-center rounded-md bg-fuchsia-600 text-white font-mono text-[10px] font-bold">{n}</div>)}
           </div>
        </div>
      )}

      <div className="mb-6">
         <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">Bet Amount</label>
         <div className={cn("bg-[#050505] border border-white/10 rounded-[1.5rem] p-2 flex flex-col gap-2 relative shadow-inner", isPending ? "opacity-50" : "focus-within:border-white/20")}>
            <div className="flex items-center px-4 pt-2">
               <CurrencyDollarIcon className="w-6 h-6 text-white/20" />
               <input 
                  type="number" 
                  value={betAmount} 
                  onChange={(e) => setBetAmount(Math.max(1, parseInt(e.target.value) || 0))}
                  className="bg-transparent border-none outline-none text-4xl font-mono text-white w-full pr-2 text-right"
               />
            </div>
            <div className="flex gap-1 p-1 bg-white/[0.02] rounded-xl border border-white/5">
               <button onClick={() => handleAmountChange(1)} className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase font-bold text-white/40 hover:text-white transition-all">Min</button>
               <button onClick={() => handleAmountChange(betAmount / 2)} className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase font-bold text-white/40 hover:text-white transition-all">1/2</button>
               <button onClick={() => handleAmountChange(betAmount * 2)} className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase font-bold text-white/40 hover:text-white transition-all">2x</button>
               <button onClick={() => handleAmountChange(1450)} className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase font-bold text-white/40 hover:text-white transition-all">Max</button>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-auto">
         <div className="bg-[#050505] p-4 rounded-2xl border border-white/10 flex flex-col shadow-inner">
            <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1 flex items-center gap-1">Multiplier <InformationCircleIcon className="w-3 h-3"/></span>
            <span className={cn("text-2xl font-mono font-bold transición-all", themeColor === 'emerald' ? "text-emerald-400" : themeColor === 'purple' ? "text-purple-400" : "text-amber-400")}>{multiplier.toFixed(2)}x</span>
         </div>
         <div className="bg-[#050505] p-4 rounded-2xl border border-white/10 flex flex-col shadow-inner">
            <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1 flex items-center gap-1">Win Chance <ChartBarIcon className="w-3 h-3"/></span>
            <span className="text-2xl font-mono font-bold text-white">{winChance.toFixed(2)}%</span>
         </div>
      </div>

      <button onClick={handlePlaceBet} disabled={isPending || (game.slug !== 'dice' && winChance === 0)}
         className={cn("mt-8 w-full py-6 rounded-2xl text-white font-extrabold text-xl shadow-2xl transition-all border-b-[4px]", 
           isPending ? "bg-[#111] opacity-50 cursor-not-allowed border-black" : 
           game.slug === 'dice' ? "bg-purple-600 border-purple-800 text-white" : 
           game.slug === 'roulette' ? "bg-emerald-600 border-emerald-800 text-white" : 
           game.slug === 'coin-toss' ? (coinSide === 'HEADS' ? "bg-amber-500 border-amber-700 text-amber-950" : "bg-indigo-600 border-indigo-800 text-white") :
           "bg-fuchsia-600 border-fuchsia-800 text-white"
         )}>
         {isPending ? "SPINNING..." : "PLACE BET"}
      </button>
    </>
  );

  const RightPane = (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-8">
       {/* ANIMATION STYLES */}
       <style dangerouslySetInnerHTML={{__html: `
         @keyframes dice-roll-3d { 0% { transform: rotateX(0deg) rotateY(0deg) scale(0.8); } 50% { transform: rotateX(540deg) rotateY(720deg) scale(1.2); } 100% { transform: rotateX(1080deg) rotateY(1440deg) scale(1); } }
         @keyframes toss-anim { 0% { transform: rotateX(20deg) rotateY(0deg) translateY(0px); } 50% { transform: rotateX(80deg) rotateY(900deg) translateY(-400px) scale(1.5); } 100% { transform: rotateX(20deg) rotateY(${flipCount * 1800 + (coinSide === "TAILS" ? 180 : 0)}deg) translateY(0px); } }
       `}} />

       {/* RECENT RECORDS WIDGET */}
       <div className="absolute top-6 right-6 lg:top-8 lg:right-8 z-20 hidden md:block">
          <div className="flex flex-col items-end gap-2 p-3 rounded-2xl border border-white/5 bg-[#050505]/90 backdrop-blur-xl shadow-2xl">
             <div className="text-[10px] font-bold text-white/30 tracking-widest uppercase px-2">{game.slug === 'dice' ? "RECENT ROLLS" : game.slug === 'roulette' ? "RECENT NUMBERS" : "RECENT FLIPS"}</div>
             <div className="flex gap-2 min-w-[120px] justify-end">
                {gameHistory.length > 0 ? gameHistory.map((res, i) => (
                   <div key={i} className={cn("w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold font-mono border", 
                     game.slug === 'roulette' ? (res.val === 0 ? "bg-emerald-500 border-emerald-300" : redNumbers.includes(res.val) ? "bg-red-600 border-red-400" : "bg-black border-white/20") :
                     (res.val === 1 ? "bg-amber-500/20 text-amber-400 border-amber-500/40" : "bg-indigo-500/20 text-indigo-400 border-indigo-500/40")
                   )}>{game.slug === 'coin-toss' ? (res.val === 1 ? 'H' : 'T') : res.val}</div>
                )) : <span className="text-[10px] text-white/10 px-4 py-2">Waiting for first play...</span>}
             </div>
          </div>
       </div>

       {/* DICE STAGE */}
       {game.slug === "dice" && (
         <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10">
            <div className="relative mb-12 flex flex-col items-center mt-[-100px]">
               <div className="absolute -bottom-10 w-64 h-16 bg-purple-500/20 blur-[60px] rounded-full" />
               <div className="w-32 h-32 md:w-48 md:h-48 relative" style={{ perspective: '1200px' }}>
                  <div className={cn("w-full h-full relative transition-all duration-1000", isPending ? "animate-[dice-roll-3d_2.5s_cubic-bezier(0.2,0.8,0.2,1)_forwards]" : "animate-[spin_40s_linear_infinite]")} style={{ transformStyle: 'preserve-3d', transform: 'rotateX(-20deg) rotateY(30deg)' }}>
                     <DiceFace type={1} className="[transform:rotateY(0deg)_translateZ(4rem)] md:[transform:rotateY(0deg)_translateZ(6rem)]" />
                     <DiceFace type={6} className="[transform:rotateY(180deg)_translateZ(4rem)] md:[transform:rotateY(180deg)_translateZ(6rem)]" />
                     <DiceFace type={3} className="[transform:rotateY(90deg)_translateZ(4rem)] md:[transform:rotateY(90deg)_translateZ(6rem)]" />
                     <DiceFace type={4} className="[transform:rotateY(-90deg)_translateZ(4rem)] md:[transform:rotateY(-90deg)_translateZ(6rem)]" />
                     <DiceFace type={2} className="[transform:rotateX(90deg)_translateZ(4rem)] md:[transform:rotateX(90deg)_translateZ(6rem)]" />
                     <DiceFace type={5} className="[transform:rotateX(-90deg)_translateZ(4rem)] md:[transform:rotateX(-90deg)_translateZ(6rem)]" />
                  </div>
               </div>
            </div>
            
            <div className="absolute bottom-8 w-full max-w-2xl px-6">
               <div className="bg-[#0a0a0a]/90 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 p-8 shadow-2xl flex flex-col gap-6">
                  <div className="flex justify-between items-center px-2">
                     <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 relative h-10 w-48">
                        <div className={cn("absolute inset-y-1 w-[calc(50%-4px)] rounded-xl transition-all duration-300 bg-purple-600 shadow-lg", diceDirection === "under" ? "left-1" : "left-[calc(50%+2px)]")} />
                        <button onClick={() => setDiceDirection("under")} className="flex-1 rounded-xl font-bold uppercase tracking-widest text-[9px] relative z-10">Roll Under</button>
                        <button onClick={() => setDiceDirection("over")} className="flex-1 rounded-xl font-bold uppercase tracking-widest text-[9px] relative z-10">Roll Over</button>
                     </div>
                     <div className="text-right"><span className="text-[10px] text-white/30 uppercase font-bold block mb-1">Target Result</span><span className="text-2xl font-mono font-bold text-white">{diceDirection === 'under' ? `< ${diceTarget}` : `> ${diceTarget}`}</span></div>
                  </div>
                  <div className="relative h-16 flex items-center group">
                     <div className="absolute inset-x-0 h-4 bg-black rounded-full border border-white/5 overflow-hidden shadow-inner">
                        <div className="absolute inset-y-0 bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.5)] transition-all ease-out" style={{ left: diceDirection === "under" ? "0%" : `${diceTarget}%`, width: diceDirection === "under" ? `${diceTarget}%` : `${100 - diceTarget}%` }} />
                        <div className="absolute inset-y-0 bg-red-900/30 transition-all ease-out" style={{ left: diceDirection === "under" ? `${diceTarget}%` : "0%", width: diceDirection === "under" ? `${100 - diceTarget}%` : `${diceTarget}%` }} />
                     </div>
                     <input type="range" min="2" max="98" value={diceTarget} onChange={(e) => setDiceTarget(parseInt(e.target.value))} className="absolute inset-x-0 w-full h-full opacity-0 cursor-ew-resize z-20" />
                     <div className="absolute z-10 w-16 h-16 -ml-8 flex flex-col items-center justify-center transition-all ease-out pointer-events-none" style={{ left: `${diceTarget}%` }}>
                        <div className="absolute bottom-full bg-purple-600 rounded-xl px-4 py-2 border border-purple-400 shadow-2xl font-mono text-2xl font-bold text-white mb-4">{diceTarget}</div>
                        <div className="w-8 h-8 rounded-full bg-white border-[6px] border-purple-500 shadow-2xl" />
                     </div>
                     <div className="absolute bottom-[-24px] inset-x-0 flex justify-between text-[10px] font-bold text-white/10 px-1 font-mono"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
                  </div>
               </div>
            </div>
         </div>
       )}

       {/* COIN TOSS STAGE */}
       {game.slug === "coin-toss" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10">
             <div className="relative w-64 h-64 md:w-80 md:h-80" style={{ perspective: '1500px' }}>
                <div className={cn("w-full h-full relative shadow-2xl", isPending ? "animate-[toss-anim_2.5s_cubic-bezier(0.3,0.1,0.3,1)_forwards]" : "")} style={{ transformStyle: 'preserve-3d', transform: `rotateX(20deg) rotateY(${coinSide === "TAILS" ? 180 : 0}deg)` }}>
                   {Array.from({ length: 24 }).map((_, i) => (
                      <div key={i} className="absolute inset-0 rounded-full border-[8px] backface-hidden" style={{ transform: `translateZ(-${i}px)`, borderColor: isPending ? '#9CA3AF' : (coinSide === 'HEADS' ? '#B45309' : '#312E81') }} />
                   ))}
                   <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_top_right,#fbbf24,#b45309_70%)] border-[10px] border-amber-300 flex flex-col items-center justify-center shadow-inner overflow-hidden backface-hidden" style={{ transform: 'translateZ(1px)' }}>
                      <SparklesIcon className="w-20 h-20 text-white/30 mb-2" /><span className="text-3xl font-black text-white tracking-widest uppercase">HEADS</span>
                   </div>
                   <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_top_right,#818cf8,#3730a3_70%)] border-[10px] border-indigo-300 flex flex-col items-center justify-center shadow-inner overflow-hidden backface-hidden" style={{ transform: 'rotateY(180deg) translateZ(24px)' }}>
                      <ShieldCheckIcon className="w-20 h-20 text-white/30 mb-2" /><span className="text-3xl font-black text-white tracking-widest uppercase">TAILS</span>
                   </div>
                </div>
             </div>
             <div className={cn("absolute bottom-12 transition-all duration-700 flex flex-col items-center", isPending ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0")}>
                <span className="text-[10px] text-white/20 tracking-[0.4em] uppercase mb-2">Awaiting Toss Selection</span>
                <div className={cn("px-12 py-3 rounded-full border backdrop-blur-2xl font-black tracking-widest text-xl shadow-2xl transition-all", coinSide === "HEADS" ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-indigo-500/10 border-indigo-500/30 text-indigo-400")}>{coinSide} SELECTED</div>
             </div>
          </div>
       )}

       {/* ROULETTE STAGE */}
       {game.slug === "roulette" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 z-10 overflow-hidden">
             {/* CENTRAL REALISTIC EUROPEAN WHEEL */}
             <div className="relative z-10 w-full flex items-center justify-center mt-2 mb-8 scale-90 md:scale-100">
                {/* Mahogany Rim & Golden Ring */}
                <div className="w-[320px] h-[320px] md:w-[400px] md:h-[400px] rounded-full border-[12px] md:border-[18px] border-[#2C1810] shadow-[0_0_80px_rgba(0,0,0,1),inset_0_0_30px_black] ring-4 ring-[#B8860B] flex items-center justify-center p-1 md:p-2 relative bg-[#111]">
                   
                   {/* Inner Rotating Drum */}
                   <div 
                      className={cn(
                         "w-full h-full rounded-full relative flex items-center justify-center transition-all duration-[3000ms] overflow-hidden border-2 border-[#B8860B]/50",
                         isPending ? "animate-[spin_4s_cubic-bezier(0.1,0.7,0.1,1)_forwards] blur-[0.5px]" : "rotate-0"
                      )}
                      style={{
                         background: `conic-gradient(from -4.86deg, ${europeanWheelOrder.map((num, i) => {
                            const color = num === 0 ? '#059669' : redNumbers.includes(num) ? '#b91c1c' : '#1a1a1a';
                            const deg = 360/37;
                            return `${color} ${i * deg}deg ${(i + 1) * deg}deg`;
                         }).join(', ')})`
                      }}
                   >
                      {/* 37 Number Pockets Labels */}
                      <div className="absolute inset-0 rounded-full flex items-center justify-center">
                         {europeanWheelOrder.map((num, i) => (
                            <div 
                               key={num}
                               className="absolute inset-0 flex flex-col items-center justify-start pointer-events-none"
                               style={{ transform: `rotate(${i * (360 / 37)}deg)` }}
                            >
                               <div className="w-[24px] h-[45px] md:h-[55px] flex items-center justify-center text-[13px] md:text-[16px] font-black font-mono text-white mt-1 md:mt-2 [text-shadow:0_2px_4px_black]">
                                  {num}
                               </div>
                            </div>
                         ))}
                      </div>

                      {/* Perfect Metal Frets (3D Rendered) */}
                      <div className="absolute inset-0 rounded-full flex items-center justify-center pointer-events-none">
                         {europeanWheelOrder.map((num, i) => (
                            <div 
                               key={`fret-${num}`}
                               className="absolute inset-0 flex flex-col items-center justify-start pointer-events-none"
                               style={{ transform: `rotate(${i * (360 / 37) + (360 / 37 / 2)}deg)` }}
                            >
                               <div className="w-[2px] h-[60px] md:h-[80px] bg-gradient-to-b from-[#FDE047] via-[#B8860B] to-transparent shadow-[1px_0_2px_rgba(0,0,0,0.5)]" />
                            </div>
                         ))}
                      </div>

                      {/* Central Multi-Faceted Metallic Turret */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] md:w-[240px] md:h-[240px] rounded-full bg-[radial-gradient(circle_at_30%_30%,#FDE047,#B8860B_70%,#4527A0)] shadow-[0_0_50px_rgba(0,0,0,1),inset_0_0_30px_black] border-[5px] border-[#222] flex items-center justify-center z-10">
                         <div className="w-22 h-22 md:w-28 md:h-28 rounded-full bg-[radial-gradient(circle_at_center,#111,#000)] shadow-[inset_0_0_15px_black] flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-400 via-gray-200 to-gray-800 shadow-2xl border border-white/20" />
                         </div>
                         {/* Diamond-Cut Turret Spinners */}
                         {[0, 45, 90, 135].map(deg => (
                            <div key={deg} className="absolute w-full h-[12px] bg-[#FDE047]/25 mix-blend-overlay blur-[0.5px]" style={{ transform: `rotate(${deg}deg)` }} />
                         ))}
                      </div>

                      {/* Inner Ball Track Overlay */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] h-[240px] md:w-[300px] md:h-[300px] rounded-full border border-[#B8860B]/30 bg-black/50 shadow-[inset_0_0_40px_black] z-0" />
                   </div>

                   {/* HIGH-INTENSITY SPINNING BALL */}
                   <div 
                      className={cn(
                         "absolute inset-0 rounded-full z-20 pointer-events-none transition-transform",
                         isPending ? "animate-[spin_2s_linear_infinite_reverse]" : "duration-1000 ease-out"
                      )}
                      style={!isPending && showResult && resultNum !== null ? { transform: `rotate(${europeanWheelOrder.indexOf(resultNum) * (360 / 37)}deg)` } : {}}
                   >
                      <div className={cn(
                         "absolute left-1/2 -translate-x-1/2 w-4 h-4 md:w-5 md:h-5 bg-white rounded-full transition-all",
                         isPending 
                            ? "top-[12px] md:top-[18px] shadow-[0_0_20px_white,-15px_0px_15px_black] scale-125 blur-[1.5px] duration-[2000ms]" 
                            : "top-[50px] md:top-[65px] shadow-[0_0_12px_white,-5px_5px_15px_black] scale-100 duration-1000"
                      )} />
                   </div>
                </div>
             </div>

             {/* MASSIVE INTERACTIVE ROULETTE BOARD */}
             <div className="relative z-20 w-fit pointer-events-auto">
                <div className="bg-[#0B1A12] border-[6px] border-[#222] rounded-2xl p-4 md:p-6 shadow-[0_40px_80px_rgba(0,0,0,1),inset_0_0_60px_rgba(0,0,0,0.9)] relative overflow-hidden flex flex-col gap-2">
                   {/* Velvet Texture & Material Effects */}
                   <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-25 pointer-events-none mix-blend-overlay" />
                   <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                   
                   <div className="flex">
                      {/* ZERO SPOT */}
                      <button 
                         onClick={() => setRouletteSpots(rouletteSpots.includes("0") ? rouletteSpots.filter(s=>s!=="0") : [...rouletteSpots, "0"])} 
                         className={cn(
                            "w-16 md:w-20 rounded-l-xl border-2 flex items-center justify-center font-mono font-black text-2xl md:text-3xl transition-all relative overflow-hidden group", 
                            rouletteSpots.includes("0") 
                               ? "bg-emerald-400 border-emerald-300 text-black shadow-[0_0_40px_rgba(52,211,153,0.8),inset_0_2px_10px_white] z-10 scale-[1.05]" 
                               : "bg-[#093d25] border-[#105e3a] text-emerald-100 hover:bg-[#0c4e30]"
                         )}
                      >
                         <div className="relative z-10">0</div>
                         {rouletteSpots.includes("0") && <div className="absolute inset-0 bg-gradient-to-tr from-white/40 to-transparent animate-pulse" />}
                      </button>

                      <div className="flex flex-col gap-1.5 ml-1.5">
                         {[3, 2, 1].map((rN, rI) => (
                            <div key={rN} className="flex gap-1.5">
                               {Array.from({ length: 12 }).map((_, cI) => {
                                  const num = (cI * 3) + rN;
                                  const isS = rouletteSpots.includes(num.toString());
                                  return (
                                     <button 
                                        key={num} 
                                        onClick={() => setRouletteSpots(isS ? rouletteSpots.filter(s=>s!==num.toString()) : [...rouletteSpots, num.toString()])} 
                                        className={cn(
                                           "w-12 h-12 md:w-16 md:h-16 flex items-center justify-center font-mono font-black text-base md:text-xl border-2 transition-all relative rounded-md shadow-lg group overflow-hidden", 
                                           isS 
                                              ? "bg-white text-black scale-110 z-10 border-white shadow-[0_0_40px_white,inset_0_2px_10px_rgba(0,0,0,0.2)]" 
                                              : redNumbers.includes(num) 
                                                 ? "bg-[#7f1d1d] hover:bg-[#991b1b] text-red-100 border-[#991b1b] shadow-[inset_0_2px_0_rgba(255,255,255,0.1)]" 
                                                 : "bg-[#1f2937] hover:bg-[#374151] text-gray-200 border-[#374151] shadow-[inset_0_2px_0_rgba(255,255,255,0.1)]"
                                        )}
                                     >
                                        <span className="relative z-10">{num}</span>
                                        {isS && <div className="absolute inset-0 bg-gradient-to-tr from-black/5 to-transparent shadow-inner" />}
                                     </button>
                                  );
                               })}
                               <button className="w-14 md:w-18 border-2 border-white/10 bg-white/5 text-[11px] md:text-sm font-black text-white/30 hover:text-white transition-all uppercase tracking-tighter hover:bg-white/10">2:1</button>
                            </div>
                         ))}
                      </div>
                   </div>

                   {/* DOZENS */}
                   <div className="flex gap-1.5 pl-16 md:pl-20 mt-1">
                      {['1st 12', '2nd 12', '3rd 12'].map(doz => (
                         <button 
                            key={doz} 
                            onClick={() => setRouletteSpots(rouletteSpots.includes(doz) ? rouletteSpots.filter(s=>s!==doz) : [...rouletteSpots, doz])} 
                            className={cn(
                               "flex-1 py-3 md:py-4 border-2 font-black text-xs md:text-sm uppercase transition-all rounded-lg relative overflow-hidden", 
                               rouletteSpots.includes(doz) 
                                  ? "bg-emerald-500 border-white text-white shadow-[0_0_30px_rgba(16,185,129,0.5)] z-10 scale-[1.02]" 
                                  : "bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10"
                            )}
                         >
                            {doz}
                         </button>
                      ))}
                   </div>

                   {/* OUTSIDE BETS */}
                   <div className="flex gap-1.5 pl-16 md:pl-20">
                      {['1-18', 'EVEN', 'RED', 'BLACK', 'ODD', '19-36'].map(o => (
                         <button 
                            key={o} 
                            onClick={() => setRouletteSpots(rouletteSpots.includes(o) ? rouletteSpots.filter(s=>s!==o) : [...rouletteSpots, o])} 
                            className={cn(
                               "flex-1 py-4 md:py-5 border-2 font-black text-[10px] md:text-xs uppercase transition-all rounded-lg flex items-center justify-center relative shadow-inner overflow-hidden", 
                               rouletteSpots.includes(o) 
                                  ? "bg-emerald-500 border-white text-white shadow-[0_0_30px_rgba(16,185,129,0.5)] z-10 scale-[1.02]" 
                                  : "bg-white/5 border-white/10 text-white/30 hover:text-white hover:bg-white/10"
                            )}
                         >
                            {o === 'RED' ? <div className="w-5 h-5 md:w-7 md:h-7 bg-red-600 rounded-sm shadow-[0_0_20px_rgba(220,38,38,0.5),inset_0_2px_5px_white/30]" /> : o === 'BLACK' ? <div className="w-5 h-5 md:w-7 md:h-7 bg-black rounded-sm border-2 border-white/20 shadow-xl" /> : o}
                         </button>
                      ))}
                   </div>
                </div>
             </div>
          </div>
       )}

       {/* KENO STAGE */}
       {game.slug === "keno" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10">
             <div className={cn("relative z-10 w-full max-w-[680px] bg-[#020202] rounded-[3rem] border border-white/5 p-8 shadow-[0_50px_100px_rgba(0,0,0,1)] transition-all", isPending ? "scale-[0.98] blur-[1px]" : "")}>
                <div className="grid grid-cols-10 gap-2.5 relative z-10">
                   {Array.from({ length: 40 }).map((_, i) => { const n = i + 1; const isS = kenoSpots.includes(n); const isA = isPending && animatingKenoSpots.includes(n); return <button key={n} onClick={() => { if(isS) setKenoSpots(kenoSpots.filter(x=>x!==n)); else if(kenoSpots.length<10) setKenoSpots([...kenoSpots, n]); }} className={cn("aspect-square rounded-xl flex items-center justify-center font-mono font-black text-xl transition-all border", isA ? "bg-fuchsia-300 text-black shadow-[0_0_30px_fuchsia] z-20 scale-110 border-white" : isS ? "bg-gradient-to-br from-fuchsia-500 to-fuchsia-700 text-white border-fuchsia-400 shadow-xl" : "bg-[#0a0a0a] border-white/5 text-white/30 hover:bg-[#151515] hover:text-white")}>{n}</button>; })}
                </div>
             </div>
          </div>
       )}

       {/* RESULT OVERLAYS */}
       {showResult && (
         <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in zoom-in pointer-events-auto">
            <div className="p-12 rounded-[4rem] border border-white/10 bg-[#050505] shadow-[0_0_100px_rgba(0,0,0,1)] flex flex-col items-center text-center max-w-sm w-full relative overflow-hidden transition-all scale-110">
               <div className="absolute inset-0 blur-[100px] opacity-20 bg-emerald-500 animate-pulse" />
               <h3 className="text-xl font-bold text-white/40 uppercase tracking-[0.3em] mb-6">Verification Success</h3>
               <div className={cn("text-7xl font-mono font-black mb-8 w-64 h-36 rounded-[2.5rem] flex items-center justify-center border-4 bg-emerald-500/10 border-emerald-400 text-emerald-300 shadow-[0_0_50px_rgba(52,211,153,0.3)]")}>{game.slug === 'coin-toss' ? (coinSide === 'TAILS' ? 'TAILS' : 'HEADS') : resultNum ?? 42}</div>
               <div className="flex flex-col items-center gap-1"><span className="text-emerald-400 font-black text-lg tracking-widest mb-2 flex items-center gap-2">DIRECT PREDICTION HIT <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_emerald]" /></span><span className="text-5xl font-mono text-white font-black">+{expectedPayout.toFixed(2)} <span className="text-xl opacity-30">USDC</span></span></div>
            </div>
         </div>
       )}
    </div>
  );

  const AuditLedger = (
    <div className="flex flex-col pointer-events-auto overflow-hidden">
       <div className="px-8 py-6 border-b border-white/5 bg-white/[0.01]">
          <AuditTabs activeColorClass={cn(themeColor === 'emerald' ? "border-emerald-400 text-emerald-400" : "border-purple-400 text-purple-400")}>
             <AuditTableHeader>
                <div className="grid grid-cols-[1.2fr_1fr_1.5fr_1.2fr_80px] text-white/20 font-black uppercase tracking-[0.2em] text-[10px] px-6 w-full">
                  <div>Timestamp / Auth</div><div>Submodule</div><div>Wager Parameters</div><div>Settlement State</div><div className="text-right">Audit</div>
                </div>
             </AuditTableHeader>
             <div className="flex flex-col gap-2 mt-4 px-2">
                {recentBets.length > 0 ? recentBets.map((r, i) => (
                   <AuditTableRow key={i} className="hover:bg-white/[0.03] transition-all border border-white/5 py-5 px-6 rounded-2xl bg-black/20 group">
                      <div className="grid grid-cols-[1.2fr_1fr_1.5fr_1.2fr_80px] items-center w-full">
                         <AuditTableCell><div className="flex flex-col"><span className="text-white font-mono text-xs font-bold">{new Date().toLocaleTimeString()}</span><span className="text-[10px] font-mono text-white/30">{shortHex(r.player)}</span></div></AuditTableCell>
                         <AuditTableCell><span className="font-black text-white/90 text-sm">{game.label}</span></AuditTableCell>
                         <AuditTableCell><div className="flex flex-col"><span className={cn("font-black font-mono text-xs mb-1", themeColor === 'emerald' ? "text-emerald-500" : "text-purple-500")}>{game.slug.toUpperCase()} SELECTION</span><span className="text-[10px] text-white/40 font-mono tracking-tight">{betAmount} USDC · ID: {r.betId.toString().slice(-12)}</span></div></AuditTableCell>
                         <AuditTableCell><StatusBadge status={mapBetState(r.state)} /></AuditTableCell>
                         <AuditTableCell className="justify-end"><button className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all group-hover:scale-110 border border-white/5">↗</button></AuditTableCell>
                      </div>
                   </AuditTableRow>
                )) : (
                   <div className="py-24 text-center border-2 border-white/5 rounded-3xl border-dashed">
                      <div className="text-white/5 text-[10px] font-black uppercase tracking-[0.5em] mb-2">Immutable Audit Stream</div>
                      <div className="text-white/20 text-xs font-bold font-mono">STANDBY FOR ON-CHAIN TRANSACTION EMIT...</div>
                   </div>
                )}
             </div>
          </AuditTabs>
       </div>
    </div>
  );

  return (
    <PageTransition pageKey={`game-${slug}`}>
      <ImmersiveGameLayout
        gameName={game.slug === 'dice' ? "Precision Dice" : game.slug === 'roulette' ? "European Roulette" : game.slug === 'keno' ? "Keno Draft" : game.label}
        themeColor={themeColor}
        houseEdge={houseEdge}
        maxPayout={maxPayout}
        isInteractive={true}
        leftPaneContent={LeftPane}
        rightPaneContent={RightPane}
        auditLedgerContent={AuditLedger}
      />
    </PageTransition>
  );
}
