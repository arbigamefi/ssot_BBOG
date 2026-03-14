import React from "react";

export default function HomeLandingPrototype() {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/30 overflow-x-hidden">
      {/* Background Glows */}
      <div className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed top-[20%] right-[-10%] w-[40vw] h-[40vw] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* 1. Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-md">
        <div className="max-w-[1280px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-12">
            <div className="text-xl font-bold tracking-tight">ArbiGameFi</div>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-white/60">
              <a href="#" className="hover:text-white transition-colors">Rooms</a>
              <a href="#" className="hover:text-white transition-colors">Liquidity</a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button className="hidden md:flex text-sm font-medium text-white/60 hover:text-white px-4 py-2 transition-colors">
              Connect Wallet
            </button>
            <button className="bg-white text-black px-5 py-2.5 rounded-full font-medium text-sm hover:bg-white/90 transition-colors">
              Start Playing
            </button>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-24 max-w-[1280px] mx-auto px-6">

        {/* 2. Hero Section */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 min-h-[70vh] items-center mb-24">
          <div className="lg:col-span-6 flex flex-col gap-8">
            <div className="flex flex-col gap-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 w-fit">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs font-semibold tracking-wide text-white/80 uppercase">Arbitrum Native</span>
              </div>
              <h1 className="text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
                Provably Fair.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                  Instant Settlement.
                </span>
              </h1>
              <p className="text-lg text-white/60 max-w-md leading-relaxed">
                Experience the next generation of on-chain gaming. Non-custodial, mathematically sound, and settled at the speed of Arbitrum.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full font-semibold transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]">
                Start Playing
              </button>
              <button className="px-8 py-4 rounded-full font-semibold text-white/80 hover:text-white hover:bg-white/5 transition-all border border-white/10">
                Explore Rooms
              </button>
            </div>

            <div className="flex items-center gap-6 text-sm font-medium text-white/40 pt-4">
              <div className="flex items-center gap-2">✓ Non-custodial</div>
              <div className="flex items-center gap-2">✓ On-chain settlement</div>
              <div className="flex items-center gap-2">✓ Provable math</div>
            </div>
          </div>

          <div className="lg:col-span-6 relative aspect-square lg:aspect-auto lg:h-[600px] flex items-center justify-center">
            {/* Abstract Visual Block */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-[2.5rem] border border-white/10 overflow-hidden group">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-[#0a0a0a] rounded-[2rem] border border-white/10 shadow-2xl flex flex-col items-center justify-center gap-6 p-8 transition-transform duration-500 group-hover:scale-105">
                <div className="w-24 h-24 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                <div className="text-center">
                  <div className="text-2xl font-bold">Roulette Pro</div>
                  <div className="text-blue-400 mt-2 font-mono">0x...8F2A • ACTIVE</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Proof Ribbon */}
        <section className="py-8 border-y border-white/10 flex flex-wrap lg:flex-nowrap items-center justify-between gap-8 mb-32">
          {[
            { label: "Live Rooms", value: "24" },
            { label: "24h Volume", value: "$1.2M+" },
            { label: "Custody", value: "0% User Funds" },
            { label: "Settlement", value: "Instant" }
          ].map((stat, i) => (
            <div key={i} className="flex flex-col gap-1 w-[45%] lg:w-auto">
              <div className="text-white/50 text-xs font-semibold uppercase tracking-wider">{stat.label}</div>
              <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
            </div>
          ))}
        </section>

        {/* 4. Featured Rooms */}
        <section className="mb-32">
          <div className="flex items-baseline justify-between mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Featured Rooms</h2>
            <a href="#" className="hidden sm:block text-blue-400 font-medium hover:text-blue-300 transition-colors">View All Directory →</a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Primary Large Card */}
            <div className="lg:col-span-2 group relative rounded-3xl overflow-hidden border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex flex-col justify-end p-8 min-h-[400px]">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 blur-[80px] -z-10 group-hover:bg-blue-500/30 transition-colors" />
              <div className="absolute top-6 left-6 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-xs font-semibold uppercase tracking-wider text-blue-400 border border-white/10">
                Classic Table
              </div>
              <div className="mt-auto max-w-md">
                <h3 className="text-3xl font-bold mb-2">European Roulette</h3>
                <p className="text-white/60 mb-6 line-clamp-2">The flagship table experience. Fully verifiable random numbers with traditional inside and outside betting structures.</p>
                <button className="bg-white text-black px-6 py-3 rounded-full font-medium text-sm hover:bg-white/90 transition-colors">
                  Enter Room
                </button>
              </div>
            </div>

            {/* Smaller Support Cards */}
            <div className="flex flex-col gap-6">
              {[
                { name: "Precision Dice", type: "Fast Play", desc: "Roll over or under with instant sub-second settlement." },
                { name: "Coin Toss", type: "Binary", desc: "Pure 50/50 action. Set your stake and flip." }
              ].map((room, i) => (
                <div key={i} className="group relative rounded-3xl border border-white/10 bg-white/5 hover:bg-white/[0.07] transition-colors p-6 flex flex-col flex-1 h-[190px]">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[40px] -z-10 group-hover:bg-purple-500/20 transition-colors" />
                  <div className="inline-block px-2 py-0.5 bg-white/5 rounded text-[10px] font-semibold uppercase tracking-wider text-white/50 mb-3 w-fit">{room.type}</div>
                  <h3 className="text-xl font-bold mb-1">{room.name}</h3>
                  <p className="text-white/50 text-sm mb-4 line-clamp-2">{room.desc}</p>
                  <div className="mt-auto text-blue-400 font-medium text-sm group-hover:translate-x-1 transition-transform">Play Now →</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. How It Works */}
        <section className="mb-32">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">How it Works</h2>
            <p className="text-white/50 max-w-xl mx-auto">Skip the deposits. Play directly from your wallet with zero counterparty risk.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-[28%] left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent -z-10" />
            {[
              { num: "01", title: "Choose a Room", desc: "Pick your game style. From classic tables to fast binary plays." },
              { num: "02", title: "Set Your Ticket", desc: "Place your chips entirely on-chain without trusting a house." },
              { num: "03", title: "Settle On-Chain", desc: "Instant transparent payouts straight to your wallet." }
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#0a0a0a] border border-white/10 flex items-center justify-center text-xl font-mono font-bold text-blue-400 mb-6 shadow-xl">
                  {step.num}
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed max-w-[250px]">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 6. Why Trust This */}
        <section className="mb-32">
          <div className="rounded-[2.5rem] bg-white/[0.02] border border-white/5 p-12 lg:p-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-4 flex flex-col justify-center">
                <h2 className="text-3xl font-bold tracking-tight mb-4">Built on Proof,<br />Not Promises.</h2>
                <p className="text-white/50">Our architecture removes the need to trust us. Verify everything on Arbitrum.</p>
              </div>
              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-8">
                {[
                  { icon: "🛡️", title: "Self Custody", desc: "Your keys, your chips. Never deposit into a centralized hot wallet again." },
                  { icon: "⚡", title: "Smart Settlement", desc: "Immutable smart contracts guarantee deterministic payout execution." },
                  { icon: "📜", title: "Room Truth", desc: "Every spin, flip, and roll is cryptographically verifiable." }
                ].map((pillar, i) => (
                  <div key={i} className="flex flex-col gap-4">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-xl border border-white/10">{pillar.icon}</div>
                    <h3 className="text-lg font-semibold">{pillar.title}</h3>
                    <p className="text-sm text-white/50 leading-relaxed">{pillar.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 7. Final CTA */}
        <section className="relative rounded-[2.5rem] overflow-hidden bg-blue-600/10 border border-blue-500/20 flex flex-col items-center justify-center py-24 px-6 text-center">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay" />
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">Ready to enter the rooms?</h2>
          <button className="bg-white text-black px-10 py-5 rounded-full font-bold text-lg hover:bg-white/90 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)]">
            Start Playing Now
          </button>
        </section>

      </main>
    </div>
  );
}
