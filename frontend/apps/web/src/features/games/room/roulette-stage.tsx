import * as React from "react";
import { cn } from "@ssot/ui";

import { EUROPEAN_WHEEL_ORDER, RED_NUMBER_SET } from "./model";

export function RouletteStage({
  isPending,
  showResult,
  resultNum,
  spots,
  onChange
}: {
  isPending: boolean;
  showResult: boolean;
  resultNum: number | null;
  spots: readonly string[];
  onChange: (spots: string[]) => void;
}) {
  const toggleSpot = React.useCallback(
    (spot: string) => {
      onChange(spots.includes(spot) ? spots.filter((s) => s !== spot) : [...spots, spot]);
    },
    [onChange, spots]
  );

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-between p-4 pb-6 z-10 overflow-hidden">
      <div className="relative z-10 flex-1 w-full flex items-center justify-center min-h-[220px]">
        <div className="absolute top-0 inset-x-0 h-32 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.05),transparent_70%)] pointer-events-none" />

        <div className="w-[280px] h-[280px] md:w-[340px] md:h-[340px] lg:w-[380px] lg:h-[380px] rounded-full border-[10px] md:border-[16px] border-[#2C1810] shadow-[0_20px_50px_rgba(0,0,0,1),inset_0_0_20px_black] ring-2 ring-[#B8860B] flex items-center justify-center p-1 md:p-2 relative bg-[#111] transform-gpu transition-all hover:scale-[1.02]">
          <div
            className={cn(
              "w-full h-full rounded-full relative flex items-center justify-center transition-all duration-[3000ms] overflow-hidden border border-[#B8860B]/40",
              isPending
                ? "animate-[spin_4s_cubic-bezier(0.1,0.7,0.1,1)_forwards] blur-[0.5px]"
                : "rotate-0"
            )}
            style={{
              background: `conic-gradient(from -4.86deg, ${EUROPEAN_WHEEL_ORDER.map((num, i) => {
                const color =
                  num === 0 ? "#059669" : RED_NUMBER_SET.has(num) ? "#b91c1c" : "#1a1a1a";
                const deg = 360 / 37;
                return `${color} ${i * deg}deg ${(i + 1) * deg}deg`;
              }).join(", ")})`
            }}
          >
            <div className="absolute inset-0 rounded-full flex items-center justify-center">
              {EUROPEAN_WHEEL_ORDER.map((num, i) => (
                <div
                  key={num}
                  className="absolute inset-0 flex flex-col items-center justify-start pointer-events-none"
                  style={{ transform: `rotate(${i * (360 / 37)}deg)` }}
                >
                  <div className="w-[20px] h-[40px] md:h-[50px] lg:h-[55px] flex items-center justify-center text-[10px] md:text-[14px] lg:text-[16px] font-black font-mono text-white mt-0.5 md:mt-2 [text-shadow:0_1px_2px_black]">
                    {num}
                  </div>
                </div>
              ))}
            </div>

            <div className="absolute inset-0 rounded-full flex items-center justify-center pointer-events-none">
              {EUROPEAN_WHEEL_ORDER.map((num, i) => (
                <div
                  key={`fret-${num}`}
                  className="absolute inset-0 flex flex-col items-center justify-start pointer-events-none"
                  style={{ transform: `rotate(${i * (360 / 37) + 360 / 37 / 2}deg)` }}
                >
                  <div className="w-[2px] h-[60px] md:h-[80px] bg-gradient-to-b from-[#FDE047] via-[#B8860B] to-transparent shadow-[1px_0_2px_rgba(0,0,0,0.5)]" />
                </div>
              ))}
            </div>

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] md:w-[240px] md:h-[240px] rounded-full bg-[radial-gradient(circle_at_30%_30%,#FDE047,#B8860B_70%,#4527A0)] shadow-[0_0_50px_rgba(0,0,0,1),inset_0_0_30px_black] border-[5px] border-[#222] flex items-center justify-center z-10">
              <div className="w-22 h-22 md:w-28 md:h-28 rounded-full bg-[radial-gradient(circle_at_center,#111,#000)] shadow-[inset_0_0_15px_black] flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-400 via-gray-200 to-gray-800 shadow-2xl border border-white/20" />
              </div>
              {[0, 45, 90, 135].map((deg) => (
                <div
                  key={deg}
                  className="absolute w-full h-[12px] bg-[#FDE047]/25 mix-blend-overlay blur-[0.5px]"
                  style={{ transform: `rotate(${deg}deg)` }}
                />
              ))}
            </div>

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] md:w-[260px] md:h-[260px] lg:w-[290px] lg:h-[290px] rounded-full border border-[#B8860B]/20 bg-black/60 shadow-[inset_0_0_30px_black] z-0" />
          </div>

          <div
            className={cn(
              "absolute inset-0 rounded-full z-20 pointer-events-none transition-transform",
              isPending ? "animate-[spin_2s_linear_infinite_reverse]" : "duration-1000 ease-out"
            )}
            style={
              !isPending && showResult && resultNum !== null
                ? {
                    transform: `rotate(${EUROPEAN_WHEEL_ORDER.indexOf(resultNum) * (360 / 37)}deg)`
                  }
                : {}
            }
          >
            <div
              className={cn(
                "absolute left-1/2 -translate-x-1/2 w-4 h-4 md:w-5 md:h-5 bg-white rounded-full transition-all",
                isPending
                  ? "top-[12px] md:top-[16px] shadow-[0_0_15px_white,-10px_0px_10px_black] scale-125 blur-[1.5px] duration-[2000ms]"
                  : "top-[40px] md:top-[50px] lg:top-[55px] shadow-[0_0_10px_white,-5px_5px_12px_black] scale-100 duration-1000"
              )}
            />
          </div>
        </div>
      </div>

      <div className="relative z-20 w-fit max-w-full overflow-x-auto overflow-y-hidden custom-scrollbar pointer-events-auto transform-gpu origin-bottom scale-[0.85] sm:scale-95 xl:scale-100 pb-2 px-1">
        <div className="bg-[#0B1A12] border-[4px] border-[#222] rounded-[1.2rem] md:rounded-[1.5rem] p-2 md:p-3 sm:p-4 shadow-[0_30px_60px_rgba(0,0,0,1),inset_0_0_40px_rgba(0,0,0,0.9)] min-w-[500px] md:min-w-fit relative overflow-hidden flex flex-col gap-1.5">
          <div className="absolute inset-0 bg-[url('/textures/noise.svg')] opacity-25 pointer-events-none mix-blend-overlay" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

          <div className="flex">
            <button
              onClick={() => toggleSpot("0")}
              className={cn(
                "w-10 sm:w-12 md:w-14 rounded-l-lg md:rounded-l-xl border flex items-center justify-center font-mono font-black text-lg md:text-xl transition-all relative overflow-hidden group",
                spots.includes("0")
                  ? "bg-emerald-400 border-emerald-300 text-black shadow-[0_0_40px_rgba(52,211,153,0.8),inset_0_2px_10px_white] z-10 scale-[1.05]"
                  : "bg-[#093d25] border-[#105e3a] text-emerald-100 hover:bg-[#0c4e30]"
              )}
            >
              <div className="relative z-10">0</div>
              {spots.includes("0") && (
                <div className="absolute inset-0 bg-gradient-to-tr from-white/40 to-transparent animate-pulse" />
              )}
            </button>

            <div className="flex flex-col gap-1.5 ml-1.5">
              {[3, 2, 1].map((rN) => (
                <div key={rN} className="flex gap-1.5">
                  {Array.from({ length: 12 }).map((_, cI) => {
                    const num = cI * 3 + rN;
                    const isSelected = spots.includes(num.toString());
                    return (
                      <button
                        key={num}
                        onClick={() => toggleSpot(num.toString())}
                        className={cn(
                          "w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 flex items-center justify-center font-mono font-black text-xs md:text-sm border transition-all relative rounded shadow-lg group overflow-hidden",
                          isSelected
                            ? "bg-white text-black scale-110 z-10 border-white shadow-[0_0_30px_white,inset_0_2px_5px_rgba(0,0,0,0.2)]"
                            : RED_NUMBER_SET.has(num)
                              ? "bg-[#7f1d1d] hover:bg-[#991b1b] text-red-100 border-[#991b1b] shadow-[inset_0_2px_0_rgba(255,255,255,0.1)]"
                              : "bg-[#1f2937] hover:bg-[#374151] text-gray-200 border-[#374151] shadow-[inset_0_2px_0_rgba(255,255,255,0.1)]"
                        )}
                      >
                        <span className="relative z-10">{num}</span>
                        {isSelected && (
                          <div className="absolute inset-0 bg-gradient-to-tr from-black/5 to-transparent shadow-inner" />
                        )}
                      </button>
                    );
                  })}
                  <button className="w-10 sm:w-12 md:w-14 border border-white/10 bg-white/5 text-[9px] md:text-[10px] font-black text-white/30 hover:text-white transition-all uppercase tracking-tighter hover:bg-white/10 rounded-r-md">
                    2:1
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-1.5 pl-12 sm:pl-14 md:pl-[64px] mt-1">
            {["1st 12", "2nd 12", "3rd 12"].map((dozen) => (
              <button
                key={dozen}
                onClick={() => toggleSpot(dozen)}
                className={cn(
                  "flex-1 py-1.5 md:py-2 border font-black text-[9px] md:text-[11px] uppercase transition-all rounded-md relative overflow-hidden",
                  spots.includes(dozen)
                    ? "bg-emerald-500 border-white text-white shadow-[0_0_20px_rgba(16,185,129,0.5)] z-10 scale-[1.02]"
                    : "bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10"
                )}
              >
                {dozen}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 pl-12 sm:pl-14 md:pl-[64px]">
            {["1-18", "EVEN", "RED", "BLACK", "ODD", "19-36"].map((outsideBet) => (
              <button
                key={outsideBet}
                onClick={() => toggleSpot(outsideBet)}
                className={cn(
                  "flex-1 py-1.5 md:py-2 border font-black text-[8px] md:text-[10px] uppercase transition-all rounded-md flex items-center justify-center relative shadow-inner overflow-hidden",
                  spots.includes(outsideBet)
                    ? "bg-emerald-500 border-white text-white shadow-[0_0_20px_rgba(16,185,129,0.5)] z-10 scale-[1.02]"
                    : "bg-white/5 border-white/10 text-white/30 hover:text-white hover:bg-white/10"
                )}
              >
                {outsideBet === "RED" ? (
                  <div className="w-3 h-3 md:w-4 md:h-4 bg-red-600 rounded-sm shadow-[0_0_15px_rgba(220,38,38,0.5),inset_0_2px_5px_white/30]" />
                ) : outsideBet === "BLACK" ? (
                  <div className="w-3 h-3 md:w-4 md:h-4 bg-zinc-900 rounded-sm shadow-[0_0_15px_rgba(0,0,0,0.5),inset_0_2px_5px_white/10]" />
                ) : (
                  outsideBet
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
