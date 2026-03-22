"use client";

import React, { useState } from "react";
import { 
  CyberLayout, 
  CyberHeader, 
  CyberButton, 
  CyberInputGroup, 
  CyberSlider,
  StatBlock,
  GameCard,
  CyberTable,
  ReceiptTicket,
  WinLossOverlay,
  DiceMiniIcon,
  RouletteMiniIcon,
  CoinTossMiniIcon,
  KenoMiniIcon
} from "@ssot/ui";
import { CurrencyDollarIcon, ChartBarIcon } from "@heroicons/react/24/outline";

export default function UITestPage() {
  const [sliderVal, setSliderVal] = useState(50);
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayWin, setOverlayWin] = useState(false);

  const mockHeaderLinks = [
    { id: "1", label: "Games", href: "#" },
    { id: "2", label: "Liquidity", href: "#" }
  ];

  const triggerOverlay = (win: boolean) => {
    setOverlayWin(win);
    setShowOverlay(true);
    setTimeout(() => setShowOverlay(false), 3000);
  };

  const tableCols = [
    { key: "id", header: "ID", render: (r: any) => <span className="text-white/40 font-mono">{r.id}</span> },
    { key: "name", header: "Name", render: (r: any) => <span className="font-bold">{r.name}</span> },
    { key: "status", header: "Status", render: (r: any) => <span className="text-emerald-400 drop-shadow-[0_0_5px_#10b981]">{r.status}</span> },
  ];
  const tableData = [
    { id: "0x123", name: "Alice", status: "WIN" },
    { id: "0x456", name: "Bob", status: "WIN" },
  ];

  return (
    <CyberLayout 
      headerNode={<CyberHeader appName="UI Test Lab" navLinks={mockHeaderLinks} activeRouteId="1" />}
      className="flex flex-col gap-16 py-10"
    >
      <div className="text-center mb-10">
        <h1 className="text-5xl font-black mb-4">Component Verification Lab</h1>
        <p className="text-white/50 text-xl font-mono">@ssot/ui Visual Fidelity Test</p>
      </div>

      <section>
        <h2 className="text-2xl font-bold mb-6 border-b border-white/10 pb-2">1. Atoms: Buttons & Inputs</h2>
        <div className="flex flex-wrap gap-6 items-end mb-8">
          <CyberButton>Emerald Button</CyberButton>
          <CyberButton size="lg">Purple Large</CyberButton>
          <CyberButton variant="outline">Amber Outline</CyberButton>
          <CyberButton variant="danger">Danger Strike</CyberButton>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <CyberInputGroup 
            colorVariant="emerald" 
            label="Stake Amount" 
            balanceText="1,450 USDC" 
            icon={<CurrencyDollarIcon className="w-6 h-6" />}
            defaultValue="50.00"
          />
          <CyberInputGroup 
            colorVariant="purple" 
            label="Target Payout" 
            icon={<ChartBarIcon className="w-6 h-6" />}
            defaultValue="2.00x"
            maxButtonText="ALL IN"
          />
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6 border-b border-white/10 pb-2">2. Atoms: Sliders & Icons</h2>
        <div className="mb-12">
           <CyberSlider value={sliderVal} onValueChange={setSliderVal} />
        </div>
        <div className="flex gap-8 justify-center items-center bg-[#0a0a0a] p-10 rounded-[2rem] border border-white/5 shadow-inner">
           <DiceMiniIcon />
           <RouletteMiniIcon />
           <CoinTossMiniIcon />
           <KenoMiniIcon />
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6 border-b border-white/10 pb-2">3. Molecules: Stat Blocks & Game Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <StatBlock colorVariant="emerald" title="Total Liquidity" value="$1.4M" icon={<CurrencyDollarIcon className="w-6 h-6"/>} />
          <StatBlock colorVariant="blue" title="Active Players" value="2,401" subtitle="Last 24h" icon={<ChartBarIcon className="w-6 h-6"/>} />
          <StatBlock colorVariant="fuchsia" title="House Edge" value="1.00%" subtitle="Provably Fair" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <GameCard 
            colorVariant="purple" 
            title="Precision Dice" 
            promise="Target the odds. Set the edge." 
            icon={<DiceMiniIcon />} 
            tag="Originals" 
            liveStatus="Live" 
            href="#" 
            buttonText="Enter Stage" 
          />
          <GameCard 
            colorVariant="amber" 
            title="Coin Toss" 
            promise="Pure 50/50 resolution." 
            icon={<CoinTossMiniIcon />} 
            tag="Binary" 
            liveStatus="Live" 
            href="#" 
            buttonText="Flick Coin" 
          />
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6 border-b border-white/10 pb-2">4. Molecules: CyberTable & ReceiptTicket</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
           <div>
              <h3 className="text-white/50 text-sm font-bold mb-4 uppercase">Cyber Table</h3>
              <CyberTable columns={tableCols} data={tableData} gridCols="1fr 2fr 1fr" />
           </div>
           <div>
              <h3 className="text-white/50 text-sm font-bold mb-4 uppercase">Receipt Ticket</h3>
              <ReceiptTicket 
                 gameName="Precision Dice"
                 ticketId="#209384"
                 capitalAtRisk="50.00"
                 grossSettlement="+98.50"
                 isWin={true}
                 logicParams={[{ label: "Condition", value: "ROLL < 50" }]}
                 truthMatrix={[{ label: "Result", value: "45", isHighlight: true }]}
              />
           </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6 border-b border-white/10 pb-2">5. Organisms: Win/Loss Overlays</h2>
        <div className="flex gap-4">
           <CyberButton onClick={() => triggerOverlay(true)}>Trigger WIN Overlay</CyberButton>
           <CyberButton variant="danger" onClick={() => triggerOverlay(false)}>Trigger LOSS Overlay</CyberButton>
        </div>
      </section>

      <WinLossOverlay 
         isVisible={showOverlay} 
         isWin={overlayWin} 
         resultValue="45" 
         payoutText={overlayWin ? "+98.50" : undefined}
         wagerText={!overlayWin ? "-50.00" : undefined}
      />
    </CyberLayout>
  );
}
