import React from "react";

const featuredRooms = [
  {
    title: "Precision Dice",
    tag: "Fast play",
    promise: "Call the cap and size the ticket in seconds.",
    cue: "Instant under / over flow",
  },
  {
    title: "Coin Toss",
    tag: "Binary",
    promise: "Fast two-sided action with a clean slip flow.",
    cue: "Heads or tails, one tight ticket",
  },
  {
    title: "Keno",
    tag: "Board pick",
    promise: "Pick the board, then let the room handle the rest.",
    cue: "Multi-pick board play",
  },
];

const trustPillars = [
  {
    title: "Wallet-native flow",
    description: "Tickets start from your wallet and stay explicit through the signing path.",
  },
  {
    title: "Readable settlement",
    description: "Follow outcomes, receipts, and post-bet actions without dropping into operator mode.",
  },
  {
    title: "Visible room truth",
    description: "Keep the trust layer close when you need it, without letting it take over the first fold.",
  },
];

const liveProof = [
  { label: "Recent activity", value: "Roulette settled 18 seconds ago" },
  { label: "Room count", value: "4 release-backed rooms live" },
  { label: "Sync state", value: "Settlement path healthy" },
];

const roulettePreviewRows = [
  ["3", "6", "9", "12", "15", "18", "21", "24", "27", "30", "33", "36"],
  ["2", "5", "8", "11", "14", "17", "20", "23", "26", "29", "32", "35"],
  ["1", "4", "7", "10", "13", "16", "19", "22", "25", "28", "31", "34"],
];

const redNumbers = new Set(["1", "3", "5", "7", "9", "12", "14", "16", "18", "19", "21", "23", "25", "27", "30", "32", "34", "36"]);

export default function HomeLandingPrototype() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050505] font-sans text-white selection:bg-blue-500/30">
      <div className="fixed left-[-10%] top-[-20%] h-[50vw] w-[50vw] rounded-full bg-blue-600/8 blur-[120px] pointer-events-none" />
      <div className="fixed right-[-10%] top-[20%] h-[40vw] w-[40vw] rounded-full bg-fuchsia-600/8 blur-[120px] pointer-events-none" />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/6 bg-[#050505]/80 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-6">
          <div className="flex items-center gap-12">
            <div className="text-xl font-bold tracking-tight">ArbiGameFi</div>
            <nav className="hidden items-center gap-6 text-sm font-medium text-white/60 md:flex">
              <a href="#" className="transition-colors hover:text-white">Rooms</a>
              <a href="#" className="transition-colors hover:text-white">Liquidity</a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button className="hidden px-4 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white md:flex">
              Connect Wallet
            </button>
            <button className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white/90">
              Open Rooms
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-6 pb-24 pt-32">
        <section className="mb-16 grid grid-cols-1 items-start gap-10 pt-4 lg:grid-cols-12 lg:gap-12">
          <div className="flex flex-col gap-7 lg:col-span-6 lg:pt-6">
            <div className="flex flex-col gap-6">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-xs font-semibold uppercase tracking-wide text-white/80">
                  Wallet-native game rooms
                </span>
              </div>
              <h1 className="text-5xl font-bold leading-[1.05] tracking-tight lg:text-7xl">
                Play on-chain
                <br />
                <span className="bg-gradient-to-r from-blue-400 to-fuchsia-500 bg-clip-text text-transparent">
                  without losing the room feel.
                </span>
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-white/60">
                Choose a room, place a ticket, and follow settlement through transparent rails built
                for readable trust.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button className="rounded-full bg-blue-600 px-8 py-4 font-semibold text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all hover:bg-blue-500">
                Open Rooms
              </button>
              <button className="rounded-full border border-white/10 px-8 py-4 font-semibold text-white/80 transition-all hover:bg-white/5 hover:text-white">
                How It Works
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-1 text-sm font-medium text-white/45">
              <div className="flex items-center gap-2">✓ Wallet-native actions</div>
              <div className="flex items-center gap-2">✓ Readable settlement path</div>
              <div className="flex items-center gap-2">✓ Auditable room activity</div>
            </div>

            <div className="grid max-w-2xl gap-4 lg:grid-cols-[1.35fr_0.65fr]">
              <div className="rounded-[1.6rem] border border-white/8 bg-white/[0.03] p-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">
                  Room entry
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    { label: "01", title: "Choose room" },
                    { label: "02", title: "Build ticket" },
                    { label: "03", title: "Follow result" },
                  ].map((step) => (
                    <div
                      key={step.label}
                      className="rounded-2xl border border-white/8 bg-black/25 px-3 py-4"
                    >
                      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-300">
                        {step.label}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-white/80">{step.title}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-white/8 bg-black/25 p-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">
                  Live proof
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.22em] text-white/35">
                      Recent room
                    </div>
                    <div className="mt-1 text-sm font-medium text-white/80">
                      Roulette settled 18 seconds ago
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.22em] text-white/35">
                      Live count
                    </div>
                    <div className="mt-1 text-sm font-medium text-white/80">4 live tables</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex aspect-square items-center justify-center lg:col-span-6 lg:h-[560px] lg:aspect-auto">
            <div className="absolute inset-0 rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-blue-500/12 via-fuchsia-500/8 to-white/4" />
            <div className="relative flex h-[88%] w-[88%] flex-col rounded-[2rem] border border-white/10 bg-[#090909] p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-blue-300">
                    Featured room
                  </span>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-300">
                    Live room
                  </span>
                </div>
                <span className="text-xs font-mono text-white/35">European roulette</span>
              </div>

              <div className="mt-6 flex items-start justify-between gap-4">
                <div className="max-w-[320px]">
                  <h2 className="text-3xl font-bold tracking-tight">European roulette</h2>
                  <p className="mt-3 text-sm leading-6 text-white/55">
                    Standard European table layout with a compact ticket rail and readable settlement.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
                    Room pulse
                  </div>
                  <div className="mt-2 text-xl font-bold text-white">Straight 17</div>
                  <div className="mt-1 text-xs text-white/45">Waiting for settlement</div>
                </div>
              </div>

              <div className="mt-6 grid flex-1 grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-[1.5rem] border border-white/8 bg-black/30 p-4">
                <div className="flex items-stretch">
                  <div className="flex min-h-[260px] w-full items-center justify-center rounded-[1.2rem] bg-emerald-500 text-3xl font-bold text-white shadow-[0_0_24px_rgba(16,185,129,0.28)]">
                    0
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {roulettePreviewRows.map((row, rowIndex) => (
                    <div key={rowIndex} className="grid grid-cols-12 gap-2">
                      {row.map((number) => (
                        <div
                          key={number}
                          className={[
                            "flex h-14 items-center justify-center rounded-xl border text-lg font-bold",
                            redNumbers.has(number)
                              ? "border-rose-400/20 bg-rose-500 text-white"
                              : "border-white/10 bg-[#161616] text-white",
                          ].join(" ")}
                        >
                          {number}
                        </div>
                      ))}
                    </div>
                  ))}
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {["1 to 12", "13 to 24", "25 to 36"].map((label) => (
                      <div key={label} className="flex h-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-white/80">
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">
                    Room entry
                  </div>
                  <div className="mt-2 text-sm text-white/70">
                    Enter the room, build the ticket, then follow the result through the same surface.
                  </div>
                </div>
                <button className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white/90">
                  Enter Room
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-24">
          <div className="mb-12 flex items-baseline justify-between gap-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">Featured Rooms</div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">Choose a room and get straight to the table.</h2>
              <p className="mt-3 max-w-2xl text-white/50">
                Each room is designed to make the game legible first, while keeping the trust layer close when you need it.
              </p>
            </div>
            <a href="#" className="hidden text-blue-400 font-medium transition-colors hover:text-blue-300 sm:block">
              View All Directory →
            </a>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_0.6fr]">
            <div className="group relative flex min-h-[400px] flex-col justify-between overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
              <div className="absolute right-0 top-0 h-72 w-72 bg-blue-500/18 blur-[90px] transition-colors group-hover:bg-blue-500/26" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-blue-300">
                  Flagship table
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
                  Enter room
                </div>
              </div>
              <div className="relative max-w-xl">
                <h3 className="text-4xl font-bold tracking-tight">European Roulette</h3>
                <p className="mt-3 max-w-md text-white/55">
                  Standard European table layout with a cleaner ticket review and a more readable settlement path.
                </p>
                <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/65">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Classic table</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Standard European board</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Compact ticket rail</span>
                </div>
              </div>
              <div className="relative flex items-center justify-between gap-4">
                <div className="text-sm text-white/50">
                  One room. One ticket. One readable settlement path.
                </div>
                <button className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90">
                  Enter Room
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {featuredRooms.map((room) => (
                <div key={room.title} className="group flex min-h-[180px] flex-col rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-6 transition-colors hover:bg-white/[0.05]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
                      {room.tag}
                    </div>
                    <div className="text-xs font-medium text-blue-400 transition-transform group-hover:translate-x-1">Enter →</div>
                  </div>
                  <h3 className="mt-4 text-xl font-bold">{room.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/55">{room.promise}</p>
                  <div className="mt-auto pt-5 text-sm text-white/40">{room.cue}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-28">
          <div className="mb-14 text-center">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">How it works</div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">Three moves from room entry to settlement.</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/50">
              Skip the deposit-heavy flow. Choose a room, build the ticket, and follow the result through a visible product path.
            </p>
          </div>

          <div className="relative grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="pointer-events-none absolute left-[10%] right-[10%] top-[28%] hidden h-px bg-gradient-to-r from-transparent via-white/10 to-transparent md:block" />
            {[
              {
                num: "01",
                title: "Pick a room",
                desc: "Start with the room that matches the pace and risk surface you want.",
              },
              {
                num: "02",
                title: "Build the ticket",
                desc: "Choose the outcome, set the stake, and review the live ticket before signing.",
              },
              {
                num: "03",
                title: "Follow settlement",
                desc: "Track status, result, and follow-up actions through visible product surfaces.",
              },
            ].map((step) => (
              <div key={step.num} className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-[#0a0a0a] text-xl font-mono font-bold text-blue-400 shadow-xl">
                  {step.num}
                </div>
                <h3 className="mb-3 text-xl font-semibold">{step.title}</h3>
                <p className="max-w-[250px] text-sm leading-relaxed text-white/50">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-28 rounded-[2.5rem] border border-white/6 bg-white/[0.02] p-12 lg:p-16">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            <div className="flex flex-col justify-center lg:col-span-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">Why trust it</div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">The trust layer stays close, not in your way.</h2>
              <p className="mt-4 text-white/50">
                The first fold should stay playable. The trust layer becomes visible exactly when the player wants to inspect the path.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 lg:col-span-8">
              {trustPillars.map((pillar) => (
                <div key={pillar.title} className="flex flex-col gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg">
                    ●
                  </div>
                  <h3 className="text-lg font-semibold">{pillar.title}</h3>
                  <p className="text-sm leading-relaxed text-white/50">{pillar.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-24 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] border border-white/8 bg-white/[0.03] p-8">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">Live proof</div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">See what is happening without dropping into operator mode.</h2>
            <p className="mt-3 max-w-2xl text-white/50">
              Use a light proof layer on the landing page, then move into Bets, Liquidity, or Account when you want the full record.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {liveProof.map((item) => (
              <div key={item.label} className="rounded-[1.4rem] border border-white/8 bg-black/25 px-5 py-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">{item.label}</div>
                <div className="mt-3 text-base font-medium text-white/80">{item.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[2.5rem] border border-blue-500/20 bg-blue-600/10 px-6 py-24 text-center">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-fuchsia-500/10" />
          <div className="relative mx-auto max-w-3xl">
            <h2 className="text-4xl font-bold tracking-tight md:text-5xl">Ready to step into a room?</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/55">
              Start with the directory, choose the room that fits your style, and keep the trust layer available when you need it.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <button className="rounded-full bg-white px-10 py-5 text-lg font-bold text-black shadow-[0_0_40px_rgba(255,255,255,0.2)] transition-all hover:bg-white/90">
                Open Rooms
              </button>
              <button className="rounded-full border border-white/12 px-8 py-4 font-semibold text-white/80 transition-all hover:bg-white/5 hover:text-white">
                View Liquidity
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
