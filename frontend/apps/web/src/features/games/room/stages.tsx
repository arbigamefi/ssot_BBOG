import * as React from "react";
import { ShieldCheckIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { cn } from "@ssot/ui";

import type { CoinSide, DiceDirection } from "./params";

const DiceDot = () => (
  <div className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 bg-white rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_0_8px_rgba(255,255,255,0.8)]" />
);

const DiceFace = ({ type, className }: { type: 1 | 2 | 3 | 4 | 5 | 6; className: string }) => (
  <div
    className={cn(
      "absolute inset-0 bg-gradient-to-br from-purple-500 to-purple-900 border-[3px] border-purple-400/80 rounded-[1.5rem] shadow-[inset_0_0_40px_rgba(0,0,0,0.9),0_0_20px_rgba(168,85,247,0.4)] flex items-center justify-center backface-hidden",
      className
    )}
  >
    <div className="grid grid-cols-3 grid-rows-3 gap-2 p-3 w-full h-full">
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

export function DiceStage({
  isPending,
  showResult,
  resultNum,
  diceDirection,
  diceTarget,
  multiplier,
  winChance,
  onDirectionChange,
  onTargetChange
}: {
  isPending: boolean;
  showResult: boolean;
  resultNum: number | null;
  diceDirection: DiceDirection;
  diceTarget: number;
  multiplier: number;
  winChance: number;
  onDirectionChange: (direction: DiceDirection) => void;
  onTargetChange: (target: number) => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(147,51,234,0.05)_0%,transparent_60%)] pointer-events-none" />

      <div className="relative mb-24 flex flex-col items-center z-10 scale-90 md:scale-100">
        <div className="absolute -bottom-8 w-48 h-12 bg-purple-500/30 blur-[40px] rounded-[100%] pointer-events-none" />
        <div className="w-40 h-40 relative" style={{ perspective: "1500px" }}>
          <div
            className={cn(
              "w-full h-full relative transition-[transform] duration-[2000ms]",
              isPending
                ? "animate-[dice-roll-3d_1.5s_cubic-bezier(0.2,0.8,0.2,1)_forwards]"
                : "animate-[spin_40s_linear_infinite]"
            )}
            style={{
              transformStyle: "preserve-3d",
              transform:
                !isPending && showResult
                  ? `rotateX(${Math.random() * 360}deg) rotateY(${Math.random() * 360}deg)`
                  : "rotateX(-20deg) rotateY(30deg)"
            }}
          >
            <DiceFace type={1} className="[transform:rotateY(0deg)_translateZ(5rem)]" />
            <DiceFace type={6} className="[transform:rotateY(180deg)_translateZ(5rem)]" />
            <DiceFace type={3} className="[transform:rotateY(90deg)_translateZ(5rem)]" />
            <DiceFace type={4} className="[transform:rotateY(-90deg)_translateZ(5rem)]" />
            <DiceFace type={2} className="[transform:rotateX(90deg)_translateZ(5rem)]" />
            <DiceFace type={5} className="[transform:rotateX(-90deg)_translateZ(5rem)]" />
          </div>
        </div>

        {showResult && resultNum !== null && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 mt-10">
            <div className="px-6 py-2 bg-purple-600/90 backdrop-blur-xl border border-purple-400 rounded-full text-white font-mono font-black text-3xl shadow-[0_0_40px_rgba(168,85,247,0.8)] animate-in zoom-in spin-in-12 duration-500">
              {resultNum}
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-12 w-full max-w-3xl px-6 z-20">
        <div className="bg-[#050505]/95 backdrop-blur-3xl rounded-[3rem] border border-white/10 p-8 shadow-[0_40px_80px_rgba(0,0,0,0.8),inset_0_2px_15px_rgba(255,255,255,0.05)] flex flex-col gap-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-purple-900/10 to-transparent pointer-events-none" />

          <div className="flex justify-between items-center relative z-10 px-4">
            <div className="flex bg-[#0a0a0a] p-1.5 rounded-2xl border border-white/10 relative h-12 w-64 shadow-inner">
              <div
                className={cn(
                  "absolute inset-y-1.5 w-[calc(50%-6px)] rounded-xl transition-all duration-300 shadow-md",
                  diceDirection === "under"
                    ? "bg-purple-600 left-1.5"
                    : "bg-emerald-600 left-[calc(50%+4px)]"
                )}
              />
              <button
                onClick={() => onDirectionChange("under")}
                className={cn(
                  "flex-1 rounded-xl font-bold uppercase tracking-widest text-[10px] relative z-10 transition-colors",
                  diceDirection === "under" ? "text-white" : "text-white/40"
                )}
              >
                Roll Under
              </button>
              <button
                onClick={() => onDirectionChange("over")}
                className={cn(
                  "flex-1 rounded-xl font-bold uppercase tracking-widest text-[10px] relative z-10 transition-colors",
                  diceDirection === "over" ? "text-white" : "text-white/40"
                )}
              >
                Roll Over
              </button>
            </div>

            <div className="text-right flex flex-col items-end">
              <span className="text-[10px] text-white/30 uppercase font-black tracking-widest block mb-1">
                Target Range
              </span>
              <div className="flex items-center gap-2 bg-[#0a0a0a] px-4 py-1.5 rounded-xl border border-white/5 font-mono">
                <span className="text-gray-500">0</span>
                <span className="text-purple-400 font-bold">
                  {diceDirection === "under" ? `< ${diceTarget}` : `> ${diceTarget}`}
                </span>
                <span className="text-gray-500">100</span>
              </div>
            </div>
          </div>

          <div className="relative h-28 flex items-center group mt-4 mb-2 mx-4 z-20">
            <div className="absolute inset-x-0 h-6 bg-[#030303] rounded-full border-[3px] border-white/5 overflow-hidden shadow-[inset_0_4px_10px_rgba(0,0,0,1)]">
              <div
                className={cn(
                  "absolute inset-y-0 transition-all ease-out",
                  diceDirection === "under"
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-300 shadow-[0_0_20px_emerald]"
                    : "bg-gradient-to-r from-red-600 to-red-400 shadow-[0_0_20px_red]"
                )}
                style={{ left: "0%", width: `${diceTarget}%` }}
              />
              <div
                className={cn(
                  "absolute inset-y-0 transition-all ease-out",
                  diceDirection === "under"
                    ? "bg-gradient-to-r from-red-400 to-red-600 shadow-[0_0_20px_red]"
                    : "bg-gradient-to-r from-emerald-300 to-emerald-500 shadow-[0_0_20px_emerald]"
                )}
                style={{ left: `${diceTarget}%`, width: `${100 - diceTarget}%` }}
              />
            </div>

            <input
              type="range"
              min="2"
              max="98"
              value={diceTarget}
              onChange={(e) => onTargetChange(parseInt(e.target.value))}
              disabled={isPending}
              className="absolute inset-x-0 w-full h-[60px] opacity-0 cursor-ew-resize z-30"
            />

            <div
              className="absolute z-10 w-24 h-24 -ml-12 flex flex-col items-center justify-center transition-all ease-out pointer-events-none"
              style={{ left: `${diceTarget}%` }}
            >
              <div className="absolute bottom-[80%] bg-[#0f0f0f]/95 backdrop-blur-md rounded-2xl py-3 px-4 shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_2px_10px_rgba(255,255,255,0.1)] border border-purple-500/40 flex flex-col items-center min-w-[130px] scale-100 group-hover:scale-[1.15] transition-transform mb-4">
                <span className="text-[10px] text-white/40 uppercase font-black tracking-widest mb-1 shadow-sm">
                  Target
                </span>
                <span className="font-mono text-4xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                  {diceTarget}
                </span>

                <div className="flex gap-4 mt-2 pt-2 border-t border-white/10 w-full justify-between px-1">
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] text-white/30 tracking-widest uppercase font-bold">
                      Mult
                    </span>
                    <span className="text-[11px] font-mono text-purple-400 font-black">
                      {multiplier.toFixed(2)}x
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] text-white/30 tracking-widest uppercase font-bold">
                      Win
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400 font-black">
                      {winChance.toFixed(2)}%
                    </span>
                  </div>
                </div>

                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[10px] border-transparent border-t-[#0f0f0f] filter drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)]" />
              </div>

              <div
                className={cn(
                  "w-10 h-10 rounded-full border-[6px] shadow-[0_0_30px_rgba(0,0,0,0.8)] outline outline-2 outline-black/30 bg-white group-hover:bg-purple-100 transition-colors flex items-center justify-center",
                  diceDirection === "under" ? "border-purple-500" : "border-emerald-500"
                )}
              >
                <div className="flex gap-0.5">
                  <div className="w-[2px] h-3 bg-black/20 rounded-full" />
                  <div className="w-[2px] h-3 bg-black/20 rounded-full" />
                  <div className="w-[2px] h-3 bg-black/20 rounded-full" />
                </div>
              </div>
            </div>

            <div className="absolute -bottom-6 inset-x-4 flex justify-between text-[9px] font-black text-white/20 px-1 font-mono tracking-widest">
              {[0, 25, 50, 75, 100].map((val) => (
                <div key={val} className="flex flex-col items-center opacity-70">
                  <div className="w-0.5 h-1.5 bg-white/20 mb-1 rounded-full" />
                  {val}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CoinTossStage({
  isPending,
  showResult,
  resultNum,
  coinSide
}: {
  isPending: boolean;
  showResult: boolean;
  resultNum: number | null;
  coinSide: CoinSide;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10 overflow-hidden">
      <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-amber-500/5 to-transparent pointer-events-none" />
      <div
        className={cn(
          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] opacity-20 pointer-events-none transition-colors duration-1000",
          isPending ? "bg-amber-500" : coinSide === "HEADS" ? "bg-amber-600" : "bg-indigo-600"
        )}
      />

      <div className="relative w-56 h-56 md:w-72 md:h-72" style={{ perspective: "1200px" }}>
        <div
          className={cn(
            "w-full h-full relative transition-[transform] ease-out",
            isPending ? "animate-[spin-coin-fast_0.5s_linear_infinite]" : "duration-700"
          )}
          style={{
            transformStyle: "preserve-3d",
            transform:
              !isPending && showResult
                ? `rotateX(15deg) rotateY(${resultNum === 1 ? 0 : 180}deg)`
                : isPending
                  ? "none"
                  : `rotateX(15deg) rotateY(${coinSide === "TAILS" ? 180 : 0}deg)`
          }}
        >
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute inset-0 rounded-full border-[6px]"
              style={{
                transform: `translateZ(-${i}px)`,
                borderColor: i % 2 === 0 ? "#8B6508" : "#DAA520",
                filter: "brightness(0.8)"
              }}
            />
          ))}

          <div
            className="absolute inset-0 rounded-full bg-[conic-gradient(from_45deg,#FFD700,#B8860B,#FFD700,#F0E68C,#FFD700)] shadow-[inset_0_0_30px_rgba(139,69,19,0.8),inset_0_2px_15px_rgba(255,255,255,0.7)] flex flex-col items-center justify-center border-2 border-yellow-200 overflow-hidden backface-hidden"
            style={{ transform: "translateZ(1px)" }}
          >
            <div className="absolute inset-4 rounded-full border border-[#B8860B]/40 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] bg-[radial-gradient(circle_at_center,#DAA520,#8B6508)] flex flex-col items-center justify-center">
              <div className="absolute inset-0 bg-[url('/textures/noise.svg')] opacity-20 mix-blend-overlay" />
              <SparklesIcon className="w-24 h-24 text-white p-4 drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)]" />
              <span className="text-3xl font-black text-white/90 tracking-[0.2em] [text-shadow:0_2px_4px_rgba(0,0,0,0.8)] mt-[-10px]">
                HEADS
              </span>
            </div>
          </div>

          <div
            className="absolute inset-0 rounded-full bg-[conic-gradient(from_45deg,#C0C0C0,#708090,#C0C0C0,#E6E6FA,#C0C0C0)] shadow-[inset_0_0_30px_rgba(47,79,79,0.8),inset_0_2px_15px_rgba(255,255,255,0.7)] flex flex-col items-center justify-center border-2 border-white/80 overflow-hidden backface-hidden"
            style={{ transform: "rotateY(180deg) translateZ(30px)" }}
          >
            <div className="absolute inset-4 rounded-full border border-gray-500/40 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] bg-[radial-gradient(circle_at_center,#778899,#2F4F4F)] flex flex-col items-center justify-center">
              <div className="absolute inset-0 bg-[url('/textures/noise.svg')] opacity-20 mix-blend-overlay" />
              <ShieldCheckIcon className="w-24 h-24 text-white p-4 drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)]" />
              <span className="text-3xl font-black text-white/90 tracking-[0.2em] [text-shadow:0_2px_4px_rgba(0,0,0,0.8)] mt-[-10px]">
                TAILS
              </span>
            </div>
          </div>
        </div>
      </div>

      {!isPending && !showResult && (
        <div className="absolute bottom-16 flex flex-col items-center animate-in slide-in-from-bottom-4 fade-in duration-500">
          <span className="text-[10px] text-white/30 tracking-[0.4em] uppercase mb-4">
            Awaiting Toss Selection
          </span>
          <div className="bg-black/60 backdrop-blur-xl rounded-[2rem] border border-white/10 px-8 py-4 flex items-center justify-center gap-4 w-72 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <div
              className={cn(
                "w-3 h-3 rounded-full animate-pulse",
                coinSide === "HEADS"
                  ? "bg-amber-400 shadow-[0_0_10px_amber]"
                  : "bg-indigo-400 shadow-[0_0_10px_indigo]"
              )}
            />
            <span
              className={cn(
                "font-mono text-xl font-black uppercase tracking-widest",
                coinSide === "HEADS" ? "text-amber-400" : "text-indigo-400"
              )}
            >
              {coinSide} SELECTED
            </span>
          </div>
        </div>
      )}

      {isPending && (
        <div className="absolute bottom-16 flex flex-col items-center animate-pulse">
          <span className="text-sm text-white font-black tracking-[0.3em] uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">
            Waiting for VRF Oracle...
          </span>
        </div>
      )}
    </div>
  );
}
