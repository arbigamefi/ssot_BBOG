import React, { ReactNode } from "react";
import { PrototypeHeader } from "./PrototypeHeader";
import { cn } from "@ssot/ui";

type ThemeColor = "purple" | "amber" | "emerald" | "fuchsia";

interface PrototypeGameLayoutProps {
  gameName: ReactNode;
  themeColor: ThemeColor;
  houseEdge: string;
  maxPayout: string;
  leftPaneContent: ReactNode;
  rightPaneContent: ReactNode;
  auditLedgerContent: ReactNode;
  isInteractive?: boolean;
}

export function PrototypeGameLayout({
  gameName,
  themeColor,
  houseEdge,
  maxPayout,
  leftPaneContent,
  rightPaneContent,
  auditLedgerContent,
  isInteractive = false
}: PrototypeGameLayoutProps) {
  const getThemeClasses = () => {
    switch (themeColor) {
      case "amber":
        return {
          selection: "selection:bg-amber-500/30",
          glowTop: "bg-amber-900/10",
          glowBot: "bg-yellow-900/10",
          edgeColor: "text-amber-400",
          leftPaneGrad: "from-amber-900/5",
          rightPaneGlow: "from-amber-500/10 via-yellow-600/5"
        };
      case "emerald":
        return {
          selection: "selection:bg-emerald-500/30",
          glowTop: "bg-emerald-900/10",
          glowBot: "bg-teal-900/10",
          edgeColor: "text-emerald-400",
          leftPaneGrad: "from-emerald-900/10",
          rightPaneGlow: "from-emerald-500/10 via-teal-600/5"
        };
      case "fuchsia":
        return {
          selection: "selection:bg-fuchsia-500/30",
          glowTop: "bg-fuchsia-900/10",
          glowBot: "bg-purple-900/10",
          edgeColor: "text-fuchsia-400",
          leftPaneGrad: "from-fuchsia-900/10",
          rightPaneGlow: "from-fuchsia-500/10 via-purple-600/5"
        };
      case "purple":
      default:
        return {
          selection: "selection:bg-purple-500/30",
          glowTop: "bg-purple-900/20",
          glowBot: "bg-blue-900/10",
          edgeColor: "text-purple-400",
          leftPaneGrad: "from-white/[0.05]",
          rightPaneGlow: "from-purple-500/10 via-fuchsia-600/5"
        };
    }
  };

  const t = getThemeClasses();

  let activeRoute: any = "none";
  if (typeof gameName === "string") {
    if (gameName.toLowerCase().includes("dice")) activeRoute = "dice";
    if (gameName.toLowerCase().includes("roulette")) activeRoute = "roulette";
    if (gameName.toLowerCase().includes("coin")) activeRoute = "cointoss";
    if (gameName.toLowerCase().includes("keno")) activeRoute = "keno";
  }

  return (
    <div
      className={cn(
        "min-h-screen bg-[#030303] text-white font-sans overflow-x-hidden",
        t.selection
      )}
    >
      <PrototypeHeader variant="game" activeRoute={activeRoute} />

      {/* Extreme Deep Ambient Glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100%] h-[100%] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none z-0 mix-blend-overlay" />
      <div
        className={cn(
          "fixed top-[-20%] right-[-10%] w-[800px] h-[800px] blur-[200px] rounded-full pointer-events-none z-0",
          t.glowTop
        )}
      />
      <div
        className={cn(
          "fixed bottom-[-20%] left-[-10%] w-[600px] h-[600px] blur-[150px] rounded-full pointer-events-none z-0",
          t.glowBot
        )}
      />

      <main className="relative z-10 max-w-[1600px] mx-auto px-4 md:px-8 py-6 flex flex-col gap-6">
        {/* ROOM TITLE & LIVE STATS HUD */}
        <div className="flex justify-between items-end mb-2">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)] animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-green-400">
                Live SSOT Module
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">{gameName}</h1>
          </div>

          <div className="hidden md:flex gap-6 text-right">
            <div className="flex flex-col">
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                House Edge
              </span>
              <span className={cn("text-lg font-mono", t.edgeColor)}>{houseEdge}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                Max Payout
              </span>
              <span className="text-lg font-mono text-white">{maxPayout}</span>
            </div>
          </div>
        </div>

        {/* 2. THE IMMERSIVE GAMING TERMINAL (Split-Pane) */}
        <div className="flex flex-col lg:flex-row w-full lg:min-h-[700px] rounded-[2.5rem] border border-white/10 bg-black/40 backdrop-blur-3xl shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden">
          {/* LEFT PANE: BETTING CONTROL DECK */}
          <div
            className={cn(
              "w-full lg:w-[420px] xl:w-[450px] flex-shrink-0 bg-gradient-to-b to-transparent border-r border-white/10 p-6 md:p-8 flex flex-col relative z-20 overflow-y-auto hide-scrollbar",
              t.leftPaneGrad
            )}
          >
            {leftPaneContent}
          </div>

          {/* RIGHT PANE: THE MAIN STAGE */}
          <div
            className={cn(
              "flex-1 relative flex flex-col items-center justify-center p-4 md:p-8 bg-[#030303] overflow-hidden group",
              isInteractive ? "" : "pointer-events-none"
            )}
          >
            {/* Massive Stage Lighting */}
            <div
              className={cn(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-b to-transparent blur-[100px] rounded-full pointer-events-none transition-all duration-1000 group-hover:scale-[1.05]",
                t.rightPaneGlow
              )}
            />

            {rightPaneContent}

            {/* Bottom Subtle Grid */}
            <div className="absolute bottom-0 inset-x-0 h-40 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:linear-gradient(to_top,black,transparent)] pointer-events-none" />
          </div>
        </div>

        {/* 3. AUDIT LEDGER */}
        <div className="mt-8 rounded-[2rem] border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
          {auditLedgerContent}
        </div>
      </main>
    </div>
  );
}
