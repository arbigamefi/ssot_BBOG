"use client";

import React, { useState, useEffect } from "react";
import { AuditTabs, AuditTableHeader, AuditTableRow, AuditTableCell, cn } from "@ssot/ui";
import { PrototypeGameLayout } from "../components/PrototypeGameLayout";
import {
  CurrencyDollarIcon,
  WalletIcon,
  InformationCircleIcon,
  ChartBarIcon,
  ArrowsRightLeftIcon
} from "@heroicons/react/24/outline";

export default function DiceRoomPrototype3() {
  const [betAmount, setBetAmount] = useState<number>(10);
  const [isRolling, setIsRolling] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [rollResult, setRollResult] = useState<number | null>(null);

  // Interactive UI States added for premium control
  const [targetNumber, setTargetNumber] = useState<number>(50);
  const [rollType, setRollType] = useState<"under" | "over">("under");

  const handleAmountChange = (val: number) => {
    let rounded = Math.floor(val);
    if (rounded < 1) rounded = 1;
    if (rounded > 1450) rounded = 1450;
    setBetAmount(rounded);
  };

  // Live Math calculations
  const winChance = rollType === "under" ? targetNumber : 100 - targetNumber;
  const currentMultiplier = winChance === 0 ? 0 : 99 / winChance;
  const expectedPayout = betAmount * currentMultiplier;

  const handleRoll = () => {
    setShowResult(false);
    setIsRolling(true);

    setTimeout(() => {
      setRollResult(Math.floor(Math.random() * 101)); // 0-100
      setIsRolling(false);
      setShowResult(true);
      setTimeout(() => setShowResult(false), 4000);
    }, 2000);
  };

  const isWin =
    rollResult !== null &&
    (rollType === "under" ? rollResult <= targetNumber : rollResult >= targetNumber);

  const LeftPane = (
    <>
      <div className="flex justify-between items-center mb-6">
        <span className="text-sm font-bold text-white/60 flex items-center gap-2">
          <WalletIcon className="w-4 h-4" /> Wallet Balance
        </span>
        <span className="font-mono text-white bg-white/5 py-1 px-3 rounded-lg border border-white/10 shadow-inner">
          1,450 USDC
        </span>
      </div>

      <div className="mb-6">
        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">
          Bet Amount
        </label>
        <div className="bg-[#050505] border border-white/10 rounded-2xl p-2 flex flex-col gap-2 relative group focus-within:border-purple-500/50 transition-colors">
          <div className="flex items-center px-4 pt-2">
            <CurrencyDollarIcon className="w-6 h-6 text-purple-500/50" />
            <input
              type="number"
              value={betAmount}
              onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0)}
              className="bg-transparent border-none outline-none text-4xl font-mono text-white w-full pr-2 text-right placeholder:text-white/20"
            />
          </div>
          <div className="flex gap-1 p-1 bg-white/[0.02] rounded-xl border border-white/5">
            <button
              onClick={() => handleAmountChange(1)}
              className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase tracking-wider font-bold text-white/60 hover:text-white transition-colors border border-transparent hover:border-white/10"
            >
              Min
            </button>
            <button
              onClick={() => handleAmountChange(betAmount / 2)}
              className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase tracking-wider font-bold text-white/60 hover:text-white transition-colors border border-transparent hover:border-white/10"
            >
              1/2
            </button>
            <button
              onClick={() => handleAmountChange(betAmount * 2)}
              className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase tracking-wider font-bold text-white/60 hover:text-white transition-colors border border-transparent hover:border-white/10"
            >
              2x
            </button>
            <button
              onClick={() => handleAmountChange(1450)}
              className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase tracking-wider font-bold text-white/60 hover:text-white transition-colors border border-transparent hover:border-white/10"
            >
              Max
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-auto">
        <div className="bg-[#050505] p-4 rounded-2xl border border-white/10 flex flex-col shadow-inner select-none transition-colors">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1 items-center flex gap-1">
            Multiplier <InformationCircleIcon className="w-3 h-3" />
          </span>
          <span className="text-2xl font-mono font-bold text-purple-400">
            {currentMultiplier.toFixed(3)}x
          </span>
        </div>
        <div className="bg-[#050505] p-4 rounded-2xl border border-white/10 flex flex-col shadow-inner select-none transition-colors">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1 items-center flex gap-1">
            Win Chance <ChartBarIcon className="w-3 h-3" />
          </span>
          <span className="text-2xl font-mono font-bold text-white">{winChance}%</span>
        </div>
        <div className="col-span-2 bg-[#050505] p-4 rounded-2xl border border-white/10 flex flex-col shadow-[inset_0_2px_15px_rgba(0,0,0,0.5)] select-none">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1">
            Expected Payout
          </span>
          <span className="text-3xl font-mono font-extrabold text-emerald-400 flex items-baseline gap-2">
            {expectedPayout.toFixed(2)}{" "}
            <span className="text-sm font-bold text-emerald-500/50">USDC</span>
          </span>
        </div>
      </div>

      <button
        onClick={handleRoll}
        disabled={isRolling || winChance === 0}
        className={cn(
          "mt-8 w-full py-6 rounded-2xl text-white font-extrabold text-xl shadow-[0_0_40px_rgba(147,51,234,0.4)] transition-all active:scale-[0.98] border-b-[4px] active:border-b hover:shadow-[0_0_60px_rgba(168,85,247,0.6)] group",
          isRolling || winChance === 0
            ? "bg-purple-900 border-purple-900 shadow-none hover:shadow-none opacity-50 cursor-not-allowed"
            : "bg-purple-600 hover:bg-purple-500 border-purple-400"
        )}
      >
        {isRolling ? "ROLLING..." : "PLACE BET"}
      </button>
    </>
  );

  const DiceDot = () => (
    <div className="w-3 h-3 md:w-5 md:h-5 bg-gradient-to-br from-white to-gray-300 rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_0_10px_rgba(255,255,255,1)]" />
  );

  const DiceFace = ({ type, className }: { type: 1 | 2 | 3 | 4 | 5 | 6; className: string }) => {
    return (
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br from-purple-500 to-purple-900 border-[3px] border-purple-400/80 rounded-[2rem] shadow-[inset_0_0_50px_rgba(0,0,0,0.9),0_0_20px_rgba(168,85,247,0.5)] flex items-center justify-center backface-hidden backdrop-blur-sm",
          className
        )}
      >
        <div className="grid grid-cols-3 grid-rows-3 gap-3 md:gap-4 p-5 md:p-6 w-full h-full">
          {type === 1 && (
            <>
              <div />
              <div />
              <div />
              <div />
              <div className="place-self-center">
                <DiceDot />
              </div>
              <div />
              <div />
              <div />
              <div />
            </>
          )}
          {type === 2 && (
            <>
              <div />
              <div />
              <div className="place-self-end">
                <DiceDot />
              </div>
              <div />
              <div />
              <div />
              <div className="place-self-start">
                <DiceDot />
              </div>
              <div />
              <div />
            </>
          )}
          {type === 3 && (
            <>
              <div />
              <div />
              <div className="place-self-end">
                <DiceDot />
              </div>
              <div />
              <div className="place-self-center">
                <DiceDot />
              </div>
              <div />
              <div className="place-self-start">
                <DiceDot />
              </div>
              <div />
              <div />
            </>
          )}
          {type === 4 && (
            <>
              <div className="place-self-start">
                <DiceDot />
              </div>
              <div />
              <div className="place-self-end">
                <DiceDot />
              </div>
              <div />
              <div />
              <div />
              <div className="place-self-start">
                <DiceDot />
              </div>
              <div />
              <div className="place-self-end">
                <DiceDot />
              </div>
            </>
          )}
          {type === 5 && (
            <>
              <div className="place-self-start">
                <DiceDot />
              </div>
              <div />
              <div className="place-self-end">
                <DiceDot />
              </div>
              <div />
              <div className="place-self-center">
                <DiceDot />
              </div>
              <div />
              <div className="place-self-start">
                <DiceDot />
              </div>
              <div />
              <div className="place-self-end">
                <DiceDot />
              </div>
            </>
          )}
          {type === 6 && (
            <>
              <div className="place-self-start">
                <DiceDot />
              </div>
              <div />
              <div className="place-self-end">
                <DiceDot />
              </div>
              <div className="place-self-start">
                <DiceDot />
              </div>
              <div />
              <div className="place-self-end">
                <DiceDot />
              </div>
              <div className="place-self-start">
                <DiceDot />
              </div>
              <div />
              <div className="place-self-end">
                <DiceDot />
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const RightPane = (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes dice-roll-3d {
          0% { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(0.8); }
          50% { transform: rotateX(540deg) rotateY(720deg) rotateZ(360deg) scale(1.2); }
          100% { transform: rotateX(1080deg) rotateY(1440deg) rotateZ(720deg) scale(1); }
        }
        .animate-dice-roll-3d { animation: dice-roll-3d 2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
      `
        }}
      />

      {/* Floating Recent Logs */}
      <div className="absolute top-6 right-6 lg:top-8 lg:right-8 z-20 hidden sm:block">
        <div className="flex flex-col items-end gap-2 p-3 rounded-2xl border border-white/5 bg-[#050505]/80 backdrop-blur-xl shadow-2xl">
          <div className="text-[10px] font-bold text-white/30 tracking-widest uppercase px-2">
            Recent Rolls
          </div>
          <div className="flex gap-2">
            {[42, 89, 12, 77, 50].map((res, i) => (
              <div
                key={i}
                className={cn(
                  "w-12 h-10 rounded-xl flex items-center justify-center font-mono font-bold border transition-all hover:scale-110 cursor-default",
                  (rollType === "under" ? res <= targetNumber : res >= targetNumber)
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                    : "bg-red-500/10 text-red-500 border-red-500/20"
                )}
              >
                {res}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Majestic Dice Presentation Stage */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10 pointer-events-none">
        {/* The 3D Dice */}
        <div
          className={cn(
            "relative flex items-center justify-center transition-all duration-500 mt-[-100px]",
            isRolling ? "" : "hover:scale-105"
          )}
        >
          {/* Ambient Base Light */}
          <div className="absolute -bottom-12 w-64 h-16 bg-purple-500/30 blur-[40px] rounded-full pointer-events-none" />

          <div
            className="w-32 h-32 md:w-48 md:h-48 relative animate-[spin_30s_linear_infinite]"
            style={{ perspective: "1200px" }}
          >
            <div
              className={cn("w-full h-full relative", isRolling ? "animate-dice-roll-3d" : "")}
              style={{ transformStyle: "preserve-3d", transform: "rotateX(-20deg) rotateY(30deg)" }}
            >
              <DiceFace
                type={1}
                className="[transform:rotateY(0deg)_translateZ(4rem)] md:[transform:rotateY(0deg)_translateZ(6rem)]"
              />
              <DiceFace
                type={6}
                className="[transform:rotateY(180deg)_translateZ(4rem)] md:[transform:rotateY(180deg)_translateZ(6rem)]"
              />
              <DiceFace
                type={3}
                className="[transform:rotateY(90deg)_translateZ(4rem)] md:[transform:rotateY(90deg)_translateZ(6rem)]"
              />
              <DiceFace
                type={4}
                className="[transform:rotateY(-90deg)_translateZ(4rem)] md:[transform:rotateY(-90deg)_translateZ(6rem)]"
              />
              <DiceFace
                type={2}
                className="[transform:rotateX(90deg)_translateZ(4rem)] md:[transform:rotateX(90deg)_translateZ(6rem)]"
              />
              <DiceFace
                type={5}
                className="[transform:rotateX(-90deg)_translateZ(4rem)] md:[transform:rotateX(-90deg)_translateZ(6rem)]"
              />
            </div>
          </div>
        </div>

        {/* Hyper-Premium Interactive Control Console */}
        <div
          className={cn(
            "absolute bottom-8 w-[90%] max-w-3xl rounded-[2.5rem] border border-white/10 bg-[#0a0a0a]/90 backdrop-blur-2xl p-6 md:p-8 flex flex-col gap-8 shadow-2xl transition-all duration-500 z-50 pointer-events-auto",
            isRolling
              ? "opacity-30 blur-sm pointer-events-none scale-95 transform translate-y-4"
              : "opacity-100"
          )}
        >
          {/* Top Stat Headers & Controls */}
          <div className="flex items-center justify-between">
            {/* Left: Mode Toggle */}
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 relative">
              <div
                className={cn(
                  "absolute inset-y-1 w-[calc(50%-4px)] rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.5)]",
                  rollType === "under"
                    ? "bg-purple-600 left-1"
                    : "bg-purple-600 left-[calc(50%+2px)]"
                )}
              />
              <button
                onClick={() => setRollType("under")}
                className={cn(
                  "px-6 py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs relative z-10 transition-colors",
                  rollType === "under" ? "text-white" : "text-white/40 hover:text-white"
                )}
              >
                Roll Under
              </button>
              <button
                onClick={() => setRollType("over")}
                className={cn(
                  "px-6 py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs relative z-10 transition-colors",
                  rollType === "over" ? "text-white" : "text-white/40 hover:text-white"
                )}
              >
                Roll Over
              </button>
            </div>

            {/* Right: Selected Target Display */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="block text-[10px] text-white/40 uppercase tracking-widest font-bold">
                  Target Range
                </span>
                <span className="text-xl font-mono font-bold text-white">
                  {rollType === "under" ? `0 - ${targetNumber}` : `${targetNumber} - 100`}
                </span>
              </div>
            </div>
          </div>

          {/* The Ultimate Slider Track */}
          <div className="relative w-full h-20 flex items-center mt-2 group">
            {/* Track Base */}
            <div className="absolute inset-x-0 w-full h-4 bg-[#030303] rounded-full border border-white/10 shadow-[inner_0_4px_10px_rgba(0,0,0,0.8)] overflow-hidden">
              {/* Winning Green Zone */}
              <div
                className="absolute inset-y-0 bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all ease-out"
                style={{
                  left: rollType === "under" ? "0%" : `${targetNumber}%`,
                  width: rollType === "under" ? `${targetNumber}%` : `${100 - targetNumber}%`
                }}
              />
              {/* Losing Red Zone */}
              <div
                className="absolute inset-y-0 bg-red-900/40 border-l border-red-500/20 shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)] transition-all ease-out"
                style={{
                  left: rollType === "under" ? `${targetNumber}%` : "0%",
                  width: rollType === "under" ? `${100 - targetNumber}%` : `${targetNumber}%`
                }}
              />
            </div>

            {/* Number Line Ticks (0, 25, 50, 75, 100) */}
            <div className="absolute inset-x-0 bottom-[-24px] flex justify-between px-2 text-[10px] font-mono font-bold text-white/20">
              <span>0</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>

            {/* The Ghost Track for Input Range */}
            <input
              type="range"
              min="2"
              max="98"
              value={targetNumber}
              onChange={(e) => setTargetNumber(parseInt(e.target.value))}
              className="absolute inset-x-0 w-full h-full opacity-0 cursor-ew-resize z-20"
            />

            {/* The Huge Precision Handle/Thumb (Moves exactly with range) */}
            <div
              className="absolute z-10 w-16 h-16 -ml-8 flex flex-col items-center justify-center transition-all ease-out pointer-events-none"
              style={{ left: `${targetNumber}%` }}
            >
              {/* Glowing Floating Number above Handle */}
              <div className="absolute bottom-[110%] bg-purple-600 rounded-xl px-4 py-2 shadow-[0_10px_30px_rgba(147,51,234,0.6)] border border-purple-400 font-mono text-2xl font-extrabold text-white scale-110 group-hover:scale-125 transition-transform mb-2">
                {targetNumber}
                {/* Down Triangle Pointer */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-purple-600" />
              </div>

              {/* Physical Glassy Handle */}
              <div className="w-8 h-8 rounded-full bg-white border-[6px] border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.8),inset_0_0_10px_rgba(0,0,0,0.5)] flex items-center justify-center transform group-hover:scale-110 transition-transform">
                <div className="w-2 h-2 rounded-full bg-purple-900" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Win/Loss Result Overlay Screen */}
      {showResult && rollResult !== null && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
          <div className="p-10 rounded-[3rem] border border-white/10 bg-[#050505] shadow-[0_0_100px_rgba(0,0,0,1)] flex flex-col items-center text-center max-w-sm w-full relative overflow-hidden">
            {/* Result background glow */}
            <div
              className={cn(
                "absolute inset-0 blur-[80px] opacity-20",
                isWin ? "bg-emerald-500" : "bg-red-500"
              )}
            />

            <h3 className="text-xl font-bold text-white/60 uppercase tracking-widest mb-4 relative z-10">
              Verification Result
            </h3>
            <div
              className={cn(
                "text-7xl font-extrabold mb-6 font-mono w-48 h-32 rounded-[2rem] flex items-center justify-center border-4 shadow-2xl relative z-10 transition-transform scale-110",
                isWin
                  ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_50px_rgba(16,185,129,0.5)]"
                  : "bg-red-500/20 border-red-500/50 text-red-500 shadow-[0_0_50px_rgba(239,68,68,0.5)]"
              )}
            >
              {rollResult}
            </div>

            <div className="relative z-10 flex flex-col items-center">
              {isWin ? (
                <>
                  <span className="text-emerald-400 font-bold mb-2 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> TARGET HIT
                  </span>
                  <span className="text-4xl font-mono text-emerald-300 font-extrabold">
                    +{expectedPayout.toFixed(2)} <span className="text-lg">USDC</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="text-red-500 font-bold mb-2 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" /> TARGET MISSED
                  </span>
                  <span className="text-2xl font-mono text-white/30 font-bold">
                    -{betAmount.toFixed(2)} USDC
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  const AuditLedger = (
    <AuditTabs activeColorClass="border-purple-400 text-purple-400">
      <AuditTableHeader>
        <div className="grid grid-cols-[1fr_1.5fr_1.5fr_1fr_80px] text-white/30 font-bold uppercase tracking-widest text-[10px] px-4">
          <div>Time / Player</div>
          <div>Game Module</div>
          <div>Logic & Wager</div>
          <div>Settlement</div>
          <div className="text-right">Verify</div>
        </div>
      </AuditTableHeader>
      <AuditTableRow className="hover:bg-white/[0.02] transition-colors border-b border-white/5 py-4 px-4">
        <div className="grid grid-cols-[1fr_1.5fr_1.5fr_1fr_80px] items-center">
          <AuditTableCell>
            <div className="flex flex-col">
              <span className="text-white font-mono text-xs">14:02:11</span>
              <span className="text-[10px] font-mono text-white/40">0xeb...2a1f</span>
            </div>
          </AuditTableCell>
          <AuditTableCell>
            <span className="font-bold text-white/80">Precision Dice</span>
          </AuditTableCell>
          <AuditTableCell>
            <div className="flex flex-col">
              <span className="text-purple-300 font-bold font-mono text-xs mb-1">
                {rollType === "under" ? `UNDER ${targetNumber}` : `OVER ${targetNumber}`}
              </span>
              <span className="text-xs text-white/50 font-mono">{betAmount} USDC</span>
            </div>
          </AuditTableCell>
          <AuditTableCell>
            <span className="py-1.5 px-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 font-mono text-[10px] uppercase font-bold animate-pulse">
              Awaiting VRF...
            </span>
          </AuditTableCell>
          <AuditTableCell className="justify-end">
            <button className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
              ↗
            </button>
          </AuditTableCell>
        </div>
      </AuditTableRow>
    </AuditTabs>
  );

  return (
    <PrototypeGameLayout
      gameName="Precision Dice"
      themeColor="purple"
      houseEdge="1.00%"
      maxPayout="25,000 USDC"
      isInteractive={true}
      leftPaneContent={LeftPane}
      rightPaneContent={RightPane}
      auditLedgerContent={AuditLedger}
    />
  );
}
