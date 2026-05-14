"use client";

import React, { useState } from "react";
import { AuditTabs, AuditTableHeader, AuditTableRow, AuditTableCell, cn } from "@ssot/ui";
import { PrototypeGameLayout } from "../components/PrototypeGameLayout";
import {
  CurrencyDollarIcon,
  WalletIcon,
  InformationCircleIcon,
  ChartBarIcon
} from "@heroicons/react/24/outline";

export default function RouletteRoomPrototype3() {
  const [betAmount, setBetAmount] = useState("20.00");
  const [selectedSpots, setSelectedSpots] = useState<string[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultNum, setResultNum] = useState<number | null>(null);

  const handleAmountChange = (val: number) => {
    let rounded = Math.floor(val);
    if (rounded < 1) rounded = 1;
    if (rounded > 1450) rounded = 1450;
    setBetAmount(rounded.toFixed(2));
  };

  const toggleSpot = (spot: string) => {
    if (isSpinning || showResult) return;
    if (selectedSpots.includes(spot)) setSelectedSpots(selectedSpots.filter((s) => s !== spot));
    else setSelectedSpots([...selectedSpots, spot]);
  };

  const handleSpin = () => {
    setShowResult(false);
    setIsSpinning(true);

    setTimeout(() => {
      const res = Math.floor(Math.random() * 37); // 0-36
      setResultNum(res);
      setIsSpinning(false);
      setShowResult(true);
      setTimeout(() => setShowResult(false), 4000);
    }, 3000);
  };

  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const europeanWheelOrder = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14,
    31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  ];
  const gridRows = [
    [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
    [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
    [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]
  ];

  // Dummy logic: just assume winning if the exact number or its color/parity is somewhat matched (for prototype simplicity)
  // We'll calculate a precise mock hit for the number itself:
  const isWin = resultNum !== null && selectedSpots.includes(resultNum.toString());

  const LeftPane = (
    <>
      <div className="flex justify-between items-center mb-6">
        <span className="text-sm font-bold text-white/60 flex items-center gap-2">
          <WalletIcon className="w-4 h-4" /> Wallet Balance
        </span>
        <span className="font-mono text-white bg-white/5 py-1 px-3 rounded-lg border border-white/10 shadow-inner">
          1,450.00 USDC
        </span>
      </div>

      <div className="mb-6 bg-[#050505] rounded-2xl border border-white/10 p-4 min-h-[120px]">
        <div className="flex justify-between items-center mb-3">
          <label className="text-[10px] uppercase tracking-widest font-bold text-emerald-400 block">
            Selected Targets ({selectedSpots.length})
          </label>
          <button
            onClick={() => setSelectedSpots([])}
            className="text-xs font-bold text-white/40 hover:text-white transition-colors"
          >
            Clear All
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {selectedSpots.map((spot) => {
            let c = "bg-[#111] text-white";
            const num = parseInt(spot);
            if (!isNaN(num) && spot.length <= 2) {
              if (num === 0) c = "bg-emerald-500 text-white";
              else if (redNumbers.includes(num)) c = "bg-red-600 text-white";
            } else {
              c = "bg-white/10 text-white";
            }
            return (
              <div
                key={spot}
                className={cn(
                  "px-3 py-1.5 rounded flex items-center justify-center text-xs font-bold font-mono border-b-2 border-white/20 shadow-inner",
                  c
                )}
              >
                {spot}
              </div>
            );
          })}
          {selectedSpots.length === 0 && (
            <span className="text-xs text-white/20 italic">
              No targets selected. Click the board.
            </span>
          )}
        </div>
      </div>

      <div className="mb-6">
        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">
          Bet Amount (Total)
        </label>
        <div className="bg-[#050505] border border-white/10 rounded-[1.5rem] p-2 flex flex-col gap-2 relative group focus-within:border-emerald-500/50 transition-colors shadow-inner">
          <div className="flex items-center px-4 pt-2">
            <CurrencyDollarIcon className="w-6 h-6 text-emerald-500/50" />
            <input
              type="text"
              value={betAmount}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) setBetAmount(e.target.value);
              }}
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
              onClick={() => handleAmountChange(parseFloat(betAmount) / 2)}
              className="flex-1 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-[10px] uppercase tracking-wider font-bold text-white/60 hover:text-white transition-colors border border-transparent hover:border-white/10"
            >
              1/2
            </button>
            <button
              onClick={() => handleAmountChange(parseFloat(betAmount) * 2)}
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
        <div className="bg-[#050505] p-4 rounded-2xl border border-white/10 flex flex-col shadow-inner">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1 items-center flex gap-1">
            Net Win Chance <ChartBarIcon className="w-3 h-3" />
          </span>
          <span className="text-2xl font-mono font-bold text-white">
            {(selectedSpots.length * (100 / 37)).toFixed(2)}%
          </span>
        </div>
        <div className="bg-[#050505] p-4 rounded-2xl border border-white/10 flex flex-col shadow-inner">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-1 items-center flex gap-1">
            Max Payout <InformationCircleIcon className="w-3 h-3" />
          </span>
          <span className="text-2xl font-mono font-bold text-emerald-400">36.00x</span>
        </div>
      </div>

      <button
        onClick={handleSpin}
        disabled={selectedSpots.length === 0 || isSpinning}
        className={cn(
          "mt-8 w-full py-6 rounded-2xl text-black font-extrabold text-xl shadow-[0_0_40px_rgba(16,185,129,0.3)] transition-all active:scale-[0.98] border-b-[4px] active:border-b hover:shadow-[0_0_60px_rgba(16,185,129,0.5)]",
          selectedSpots.length === 0
            ? "bg-emerald-900 text-white/30 border-emerald-900 shadow-none hover:shadow-none"
            : "bg-emerald-600 hover:bg-emerald-500 border-emerald-400"
        )}
      >
        {isSpinning ? "SPINNING..." : "SPIN WHEEL"}
      </button>
    </>
  );

  const RightPane = (
    <>
      <div className="absolute top-6 right-6 lg:top-8 lg:right-8 z-20 hidden md:block">
        <div className="flex flex-col items-end gap-2 p-3 rounded-2xl border border-white/5 bg-[#050505]/80 backdrop-blur-xl shadow-2xl">
          <div className="text-[10px] font-bold text-white/30 tracking-widest uppercase px-2">
            Recent Numbers
          </div>
          <div className="flex gap-2">
            {[
              { num: 12, c: "red" },
              { num: 0, c: "green" },
              { num: 35, c: "black" }
            ].map((res, i) => (
              <div
                key={i}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold border",
                  res.c === "red"
                    ? "bg-red-600 text-white border-red-400 shadow-[0_0_15px_rgba(220,38,38,0.3)]"
                    : res.c === "green"
                      ? "bg-emerald-500 text-white border-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                      : "bg-black text-white border-white/30"
                )}
              >
                {res.num}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CENTRAL REALISTIC EUROPEAN WHEEL */}
      <div className="relative z-10 w-full flex items-center justify-center mt-6 mb-12">
        {/* Mahogany Rim & Golden Ring */}
        <div className="w-[300px] h-[300px] md:w-[380px] md:h-[380px] rounded-full border-[12px] md:border-[16px] border-[#2C1810] shadow-[0_0_60px_rgba(0,0,0,1),inset_0_0_20px_black] ring-4 ring-[#B8860B] flex items-center justify-center p-1 md:p-2 relative bg-[#111]">
          {/* Inner Rotating Drum */}
          <div
            className={cn(
              "w-full h-full rounded-full relative flex items-center justify-center transition-transform duration-[3000ms] overflow-hidden border-2 border-[#B8860B]/50",
              isSpinning
                ? "animate-[spin_4s_cubic-bezier(0.1,0.7,0.1,1)_forwards] blur-[1px]"
                : "rotate-0"
            )}
            style={{
              background: `conic-gradient(from -${360 / 37 / 2}deg, ${europeanWheelOrder
                .map((num, i) => {
                  const color =
                    num === 0 ? "#059669" : redNumbers.includes(num) ? "#b91c1c" : "#1a1a1a";
                  const deg = 360 / 37;
                  return `${color} ${i * deg}deg ${(i + 1) * deg}deg`;
                })
                .join(", ")})`
            }}
          >
            {/* 37 Number Pockets Labels */}
            <div className="absolute inset-0 rounded-full flex items-center justify-center">
              {europeanWheelOrder.map((num, i) => {
                const deg = i * (360 / 37);
                return (
                  <div
                    key={num}
                    className="absolute inset-0 flex flex-col items-center justify-start pointer-events-none"
                    style={{ transform: `rotate(${deg}deg)` }}
                  >
                    {/* Number text perfectly centered inside the wedge */}
                    <div className="w-[22px] h-[40px] md:h-[50px] flex items-center justify-center text-[12px] md:text-[15px] font-extrabold font-mono text-white mt-1 md:mt-2 [text-shadow:0_1px_3px_black]">
                      {num}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Perfect Metal Frets (Separators) positioned exactly on the boundaries */}
            <div className="absolute inset-0 rounded-full flex items-center justify-center pointer-events-none">
              {europeanWheelOrder.map((num, i) => {
                // Offset by 1/2 slice to pinpoint the boundary between slices
                const fretDeg = i * (360 / 37) + 360 / 37 / 2;
                return (
                  <div
                    key={`fret-${num}`}
                    className="absolute inset-0 flex flex-col items-center justify-start pointer-events-none"
                    style={{ transform: `rotate(${fretDeg}deg)` }}
                  >
                    {/* Gold Metallic Line fading out inward */}
                    <div className="w-[1px] h-[50px] md:h-[70px] bg-gradient-to-b from-[#FDE047] via-[#B8860B] to-transparent shadow-[0_0_2px_black]" />
                  </div>
                );
              })}
            </div>

            {/* Central Metal Turret (Properly Centered) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180px] h-[180px] md:w-[220px] md:h-[220px] rounded-full bg-[radial-gradient(circle_at_30%_30%,#FDE047,#B8860B_70%,#4527A0)] shadow-[0_0_40px_rgba(0,0,0,0.9),inset_0_0_20px_black] border-[4px] border-[#222] flex items-center justify-center z-10">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-[radial-gradient(circle_at_center,#111,#000)] shadow-[inset_0_0_10px_black] flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-700 shadow-xl" />
              </div>
              {/* Turret Spinners */}
              <div className="absolute w-full h-[10px] bg-[#FDE047]/30 rotate-0 mix-blend-overlay" />
              <div className="absolute w-full h-[10px] bg-[#FDE047]/30 rotate-45 mix-blend-overlay" />
              <div className="absolute w-full h-[10px] bg-[#FDE047]/30 rotate-90 mix-blend-overlay" />
              <div className="absolute w-full h-[10px] bg-[#FDE047]/30 rotate-[135deg] mix-blend-overlay" />
            </div>

            {/* Inner empty track for the ball to rest */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] h-[220px] md:w-[280px] md:h-[280px] rounded-full border border-[#B8860B]/30 bg-black/40 shadow-[inset_0_0_20px_black] z-0 pointer-events-none" />
          </div>

          {/* The Spinning Ball Envelope (Counter-Rotates when active. Outside the drum so it rotates relative to the table, not the drum) */}
          <div
            className={cn(
              "absolute inset-0 rounded-full z-20 pointer-events-none transition-transform",
              // if spin finishes, it instantly jumps to the rotation of the winning number
              isSpinning ? "animate-[spin_2s_linear_infinite_reverse]" : "duration-1000 ease-out"
            )}
            style={
              // Snap ball exactly to winning number's slot if result is known
              !isSpinning && showResult && resultNum !== null
                ? { transform: `rotate(${europeanWheelOrder.indexOf(resultNum) * (360 / 37)}deg)` }
                : {}
            }
          >
            <div
              className={cn(
                "absolute left-1/2 -translate-x-1/2 w-4 h-4 md:w-5 md:h-5 bg-white rounded-full transition-all",
                // during spin it flies to the outer rim, when stopped it rests on the inner pocket track
                isSpinning
                  ? "top-[10px] md:top-[15px] shadow-[0_0_15px_white,-10px_0px_10px_black] scale-125 blur-[1px] duration-[2000ms]"
                  : "top-[42px] md:top-[55px] shadow-[0_0_10px_white,-4px_4px_10px_black] scale-100 duration-1000"
              )}
            />
          </div>
        </div>
      </div>

      {/* MASSIVE INTERACTIVE ROULETTE BOARD */}
      <div className="relative z-20 w-fit max-w-full overflow-x-auto hide-scrollbar pb-6 mx-auto">
        <div className="flex bg-[#0B1A12] border-4 border-[#222] rounded-xl p-3 md:p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_0_40px_rgba(0,0,0,0.8)] relative overflow-hidden">
          {/* Velvet Texture Overlay */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />

          {/* ZERO */}
          <button
            onClick={() => toggleSpot("0")}
            className={cn(
              "w-12 md:w-16 rounded-l-lg border flex items-center justify-center font-mono font-bold text-lg md:text-xl transition-all relative",
              selectedSpots.includes("0")
                ? "bg-emerald-400 border-emerald-300 text-black shadow-[0_0_30px_rgba(52,211,153,0.8),inset_0_2px_5px_rgba(255,255,255,0.8)] z-10 scale-[1.03] rounded-lg"
                : "bg-[#093d25] border-[#105e3a] text-emerald-100 hover:bg-[#0c4e30] border-r-0 shadow-[inset_0_2px_0_rgba(255,255,255,0.1),inset_0_-2px_0_rgba(0,0,0,0.3)]"
            )}
          >
            0
          </button>

          {/* MAIN GRID */}
          <div className="flex flex-col gap-[4px] ml-[4px]">
            {gridRows.map((row, rI) => (
              <div key={rI} className="flex gap-[4px]">
                {row.map((num) => {
                  const isRed = redNumbers.includes(num);
                  const isSelected = selectedSpots.includes(num.toString());
                  return (
                    <button
                      key={num}
                      onClick={() => toggleSpot(num.toString())}
                      className={cn(
                        "w-10 h-10 md:w-14 md:h-12 flex items-center justify-center font-mono font-bold text-sm md:text-base border transition-all relative rounded-sm",
                        isSelected && isRed
                          ? "bg-red-500 border-red-300 text-white shadow-[0_0_30px_rgba(239,68,68,0.8),inset_0_2px_5px_rgba(255,255,255,0.8)] z-10 scale-[1.1] rounded-lg font-extrabold"
                          : isSelected && !isRed
                            ? "bg-white border-gray-300 text-black shadow-[0_0_30px_rgba(255,255,255,0.9),inset_0_2px_5px_rgba(255,255,255,1)] z-10 scale-[1.1] rounded-lg font-extrabold"
                            : isRed
                              ? "bg-[#7f1d1d] hover:bg-[#991b1b] text-red-100 border-[#991b1b] shadow-[inset_0_2px_0_rgba(255,255,255,0.1),inset_0_-2px_0_rgba(0,0,0,0.4)]"
                              : "bg-[#1f2937] hover:bg-[#374151] text-gray-200 border-[#374151] shadow-[inset_0_2px_0_rgba(255,255,255,0.1),inset_0_-2px_0_rgba(0,0,0,0.4)]"
                      )}
                    >
                      {num}
                    </button>
                  );
                })}
                <button
                  onClick={() => toggleSpot(`ROW-${rI}`)}
                  className={cn(
                    "w-10 md:w-14 border font-bold text-[8px] md:text-[10px] uppercase font-mono transition-all rounded-sm relative",
                    selectedSpots.includes(`ROW-${rI}`)
                      ? "bg-blue-500 border-blue-300 text-white shadow-[0_0_30px_rgba(59,130,246,0.8),inset_0_2px_5px_rgba(255,255,255,0.8)] z-10 scale-[1.1] rounded-lg"
                      : "bg-white/5 hover:bg-white/10 border-white/10 text-white/50 shadow-[inset_0_2px_0_rgba(255,255,255,0.05),inset_0_-2px_0_rgba(0,0,0,0.2)]"
                  )}
                >
                  2:1
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* OUTSIDE BETS */}
        <div className="flex flex-col gap-[4px] mt-[4px] ml-12 md:ml-[72px] mr-10 md:mr-14">
          <div className="flex gap-[4px]">
            {["1st 12", "2nd 12", "3rd 12"].map((doz, i) => (
              <button
                key={i}
                onClick={() => toggleSpot(doz)}
                className={cn(
                  "flex-1 py-2 md:py-3 border font-bold text-xs uppercase transition-all rounded-sm",
                  selectedSpots.includes(doz)
                    ? "bg-blue-500 border-blue-300 text-white shadow-[0_0_30px_rgba(59,130,246,0.8),inset_0_2px_5px_rgba(255,255,255,0.8)] z-10 scale-[1.05] rounded-md"
                    : "bg-white/5 hover:bg-white/10 border-white/10 text-white/50 shadow-[inset_0_2px_0_rgba(255,255,255,0.05),inset_0_-2px_0_rgba(0,0,0,0.2)]"
                )}
              >
                {doz}
              </button>
            ))}
          </div>
          <div className="flex gap-[4px]">
            {["1-18", "EVEN", "RED", "BLACK", "ODD", "19-36"].map((out) => {
              let c = selectedSpots.includes(out)
                ? "bg-blue-500 border-blue-300 text-white shadow-[0_0_30px_rgba(59,130,246,0.8),inset_0_2px_5px_rgba(255,255,255,0.8)] z-10 scale-[1.05] rounded-md"
                : "bg-white/5 hover:bg-white/10 border-white/10 text-white/50 shadow-[inset_0_2px_0_rgba(255,255,255,0.05),inset_0_-2px_0_rgba(0,0,0,0.2)]";
              if (out === "RED")
                c = selectedSpots.includes(out)
                  ? "bg-red-500 border-red-300 text-white shadow-[0_0_30px_rgba(239,68,68,0.8),inset_0_2px_5px_rgba(255,255,255,0.5)] z-10 scale-[1.05] rounded-md"
                  : "bg-[#7f1d1d]/40 text-red-400 border-red-900/50 hover:bg-[#991b1b]/50 shadow-[inset_0_2px_0_rgba(255,255,255,0.05),inset_0_-2px_0_rgba(0,0,0,0.2)]";
              if (out === "BLACK")
                c = selectedSpots.includes(out)
                  ? "bg-white border-gray-300 text-black shadow-[0_0_30px_rgba(255,255,255,0.8),inset_0_2px_5px_rgba(255,255,255,1)] z-10 scale-[1.05] rounded-md"
                  : "bg-[#1f2937]/40 text-gray-400 border-gray-700/50 hover:bg-[#374151]/50 shadow-[inset_0_2px_0_rgba(255,255,255,0.05),inset_0_-2px_0_rgba(0,0,0,0.2)]";
              return (
                <button
                  key={out}
                  onClick={() => toggleSpot(out)}
                  className={cn(
                    "flex-1 py-3 border font-bold text-xs md:text-sm uppercase flex items-center justify-center transition-all rounded-sm",
                    c
                  )}
                >
                  {out === "RED" ? (
                    <div className="w-5 h-5 bg-red-600 rounded-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border border-red-800" />
                  ) : out === "BLACK" ? (
                    <div className="w-5 h-5 bg-[#111] rounded-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border border-gray-800" />
                  ) : (
                    out
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {showResult && resultNum !== null && (
        <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
          <div className="p-8 rounded-[2rem] border border-white/10 bg-[#050505] shadow-2xl flex flex-col items-center text-center">
            <h3 className="text-xl font-bold text-white/60 uppercase tracking-widest mb-2">
              Winning Number
            </h3>
            <div
              className={cn(
                "text-6xl font-extrabold mb-4 font-mono w-24 h-24 rounded-full flex items-center justify-center border-4 shadow-2xl",
                resultNum === 0
                  ? "bg-emerald-500 border-emerald-300 text-white shadow-[0_0_30px_rgba(16,185,129,0.5)]"
                  : redNumbers.includes(resultNum)
                    ? "bg-red-600 border-red-300 text-white shadow-[0_0_30px_rgba(220,38,38,0.5)]"
                    : "bg-[#111] border-white/30 text-white shadow-[0_0_30px_rgba(255,255,255,0.2)]"
              )}
            >
              {resultNum}
            </div>
            {isWin ? (
              <div className="flex flex-col items-center mt-2">
                <span className="text-emerald-400 font-bold mb-1">DIRECT HIT</span>
                <span className="text-3xl font-mono text-emerald-300">
                  +{(parseFloat(betAmount) * 36).toFixed(2)} USDC
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center mt-2">
                <span className="text-red-500 font-bold mb-1">NO DIRECT MATCH</span>
                <span className="text-sm font-mono text-white/40">
                  (Evaluating outside bets via contract...)
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  const AuditLedger = (
    <AuditTabs activeColorClass="border-emerald-400 text-emerald-400">
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
            <span className="font-bold text-white/80">Roulette</span>
          </AuditTableCell>
          <AuditTableCell>
            <div className="flex flex-col">
              <span className="text-emerald-300 font-bold font-mono text-[10px] mb-1 truncate">
                SPOTS: {selectedSpots.length}
              </span>
              <span className="text-xs text-white/50 font-mono">20.00 USDC</span>
            </div>
          </AuditTableCell>
          <AuditTableCell>
            <span className="py-1.5 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px] uppercase font-bold animate-pulse">
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
      gameName="European Roulette"
      themeColor="emerald"
      houseEdge="2.70%"
      maxPayout="100,000 USDC"
      isInteractive={true}
      leftPaneContent={LeftPane}
      rightPaneContent={RightPane}
      auditLedgerContent={AuditLedger}
    />
  );
}
