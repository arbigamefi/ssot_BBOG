import { ShellHeader, ShellHeaderBrand, ShellHeaderNav, ShellHeaderActions } from "@ssot/ui";
import Link from "next/link";
import { UserCircleIcon, WalletIcon } from "@heroicons/react/24/outline";
import { GameCard } from "@ssot/ui";

export default function DirectoryPrototype() {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-purple-500/30">
      
      {/* Global Product Header */}
      <ShellHeader variant="solid">
        <div className="flex items-center gap-12">
          <ShellHeaderBrand name="ArbiGameFi" />
          <ShellHeaderNav>
            <Link href="/prototype/ui-ux-v2-directory" className="text-white hover:text-white transition-colors border-b-2 border-white pb-1">Games</Link>
            <Link href="/prototype/ui-ux-v2-liquidity" className="hover:text-white transition-colors">Liquidity</Link>
            <Link href="/prototype/ui-ux-v2-referral" className="hover:text-white transition-colors">Affiliates</Link>
            <Link href="/prototype/ui-ux-v2-account" className="hover:text-white transition-colors">Account</Link>
          </ShellHeaderNav>
        </div>
        <ShellHeaderActions>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-white/60">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Arbitrum
          </div>
          <button className="hidden sm:flex items-center justify-center p-2 rounded-full hover:bg-white/10 transition-colors">
            <UserCircleIcon className="w-5 h-5 text-white/70" />
          </button>
          <button className="flex items-center gap-2 bg-white/10 border border-white/10 text-white px-4 py-2 rounded-full font-bold text-sm hover:bg-white/20 transition-transform active:scale-95">
            <WalletIcon className="w-4 h-4" />
            <span>0x12...34af</span>
          </button>
        </ShellHeaderActions>
      </ShellHeader>

      <main className="max-w-[1440px] mx-auto px-6 py-12 md:py-16">
        
        {/* Page Title & Controls */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Room Directory</h1>
            <p className="text-white/50 text-lg">Choose a room. Set your stake. Cryptographic settlement.</p>
          </div>
          
          <div className="flex gap-2 p-1 bg-[#0a0a0a] border border-white/5 rounded-xl">
            {["All Games", "Table", "Originals", "Recent"].map((cat, i) => (
              <button 
                key={cat}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  i === 0 
                  ? "bg-white/10 text-white shadow" 
                  : "text-white/40 hover:text-white hover:bg-white/5"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <Link href="/prototype/ui-ux-v2-roulette">
            <GameCard 
              slug="roulette"
              label="European Roulette"
              icon={<span>🎡</span>}
              badge="Table"
              description="Play the classic European Roulette wheel. One zero, higher edge."
              summary="Classic table action"
              facts={["Players: 234", "24h Vol: $1.2M", "Table"]}
              rtp="97.3%"
              className="h-full"
            />
          </Link>

          <Link href="/prototype/ui-ux-v2-dice">
            <GameCard 
              slug="dice"
              label="Precision Dice"
              icon={<span>🎲</span>}
              badge="Original"
              description="Adjustable win probability from 1% to 98% with instant settlement."
              summary="Provably fair rolls"
              facts={["Players: 1,420", "24h Vol: $4.5M", "Original"]}
              rtp="99.0%"
              className="h-full border-white/20 shadow-[0_0_30px_rgba(168,85,247,0.15)]"
            />
          </Link>

          <Link href="/prototype/ui-ux-v2-cointoss">
             <GameCard 
              slug="coin-toss"
              label="Coin Toss"
              icon={<span>🪙</span>}
              badge="Original"
              description="Pick a side. Double or nothing. Clean and fast."
              summary="Quick resolution flips"
              facts={["Players: 892", "24h Vol: $800k", "Original"]}
              rtp="99.0%"
              className="h-full"
            />
          </Link>
          
          <Link href="/prototype/ui-ux-v2-keno">
            <GameCard 
              slug="keno"
              label="Keno Draft"
              icon={<span>🎱</span>}
              badge="Original"
              description="Pick up to 10 numbers from a 40-number grid and multiply your stake."
              summary="Grid lottery style"
              facts={["Players: 45", "24h Vol: $120k", "Original"]}
              rtp="99.0%"
              className="h-full"
            />
          </Link>

          <div className="opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-not-allowed">
            <GameCard 
              slug="baccarat"
              label="Baccarat"
              icon={<span>🃏</span>}
              badge="Table"
              description="Coming very soon."
              summary="Punto Banco ruleset"
              facts={["Coming Soon"]}
              className="h-full"
            />
          </div>
        </div>

      </main>
    </div>
  );
}
