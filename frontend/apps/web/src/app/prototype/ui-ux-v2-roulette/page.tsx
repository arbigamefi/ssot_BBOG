import { ShellHeader, ShellHeaderBrand, RouletteBoard } from "@ssot/ui";
import Link from "next/link";
import { UserCircleIcon, WalletIcon } from "@heroicons/react/24/outline";

const gamePills = ["Dice", "Coin Toss", "Roulette", "Keno"];
const roomTabs = ["All Bets", "My Bets", "Players", "Analytics", "Game Details"];
const streamFilters = ["All", "Open", "Settled", "Refunded"];
const recentResults = [
  { n: 14, tone: "red" },
  { n: 2, tone: "black" },
  { n: 0, tone: "green" },
  { n: 35, tone: "black" },
  { n: 3, tone: "red" },
];

export default function RouletteRoomPrototype() {
  return (
    <div className="min-h-screen bg-[#050505] font-sans text-white selection:bg-green-500/30">
      <ShellHeader variant="solid">
        <div className="flex items-center gap-6">
          <ShellHeaderBrand name="ArbiGameFi" />
          <div className="hidden h-6 border-l border-white/10 pl-6 sm:block">
            <Link
              href="/prototype/ui-ux-v2-directory"
              className="flex items-center gap-2 text-sm font-bold text-white/40 transition-colors hover:text-white"
            >
              <span>←</span>
              <span>All Games</span>
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="hidden items-center justify-center rounded-full p-2 transition-colors hover:bg-white/10 sm:flex">
            <UserCircleIcon className="h-5 w-5 text-white/70" />
          </button>
          <button className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white transition-transform active:scale-95 hover:bg-white/20">
            <WalletIcon className="h-4 w-4" />
            <span>0x12...34af</span>
          </button>
        </div>
      </ShellHeader>

      <main className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <div className="flex flex-wrap gap-2 overflow-x-auto rounded-2xl border border-white/8 bg-white/[0.03] p-2">
          {gamePills.map((pill) => (
            <button
              key={pill}
              className={[
                "rounded-xl px-4 py-2 text-sm font-bold transition-colors",
                pill === "Roulette"
                  ? "bg-white text-black"
                  : "border border-white/10 bg-white/5 text-white/60 hover:text-white",
              ].join(" ")}
            >
              {pill}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">European roulette</div>
            <div className="mt-2 text-lg font-semibold text-white">Flagship table room with a standard European board and compact ticket rail.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300">
              Live room
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
              Standard European table
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row">
          <div className="flex w-full flex-shrink-0 flex-col gap-4 lg:w-[304px]">
            <div className="rounded-[1.7rem] border border-white/10 bg-[#0b0b0b] p-4 shadow-[0_0_24px_rgba(34,197,94,0.08)]">
              <div className="flex rounded-xl border border-white/8 bg-black/30 p-1">
                <button className="flex-1 rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-black">Manual</button>
                <button className="flex-1 rounded-lg px-3 py-1.5 text-sm font-bold text-white/40">Auto</button>
              </div>

              <div className="mt-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Bet amount</div>
                <div className="mt-2 rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-xl font-mono font-bold">10.00</div>
                    <div className="text-sm font-bold text-white/50">USDC</div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {["1/2", "2x", "Max"].map((chip) => (
                      <button key={chip} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/65 hover:text-white">
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">
                  <span>Number of bets</span>
                  <span>1 ticket</span>
                </div>
                <div className="mt-2 rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5">
                  <div className="h-2 rounded-full bg-white/10">
                    <div className="h-2 w-[22%] rounded-full bg-green-400" />
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Ticket summary</div>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-white/50">Active bet</span>
                    <span className="font-semibold text-white">Straight 17</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/50">Potential payout</span>
                    <span className="font-mono font-bold text-green-400">360.00 USDC</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/50">RNG fee</span>
                    <span className="font-mono text-white/75">0.012 ETH</span>
                  </div>
                </div>

                <div className="mt-4 border-t border-white/8 pt-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">
                    Recent results
                  </div>
                  <div className="mt-3 flex gap-2">
                    {recentResults.map((result, index) => (
                      <div
                        key={`${result.n}-${index}`}
                        className={[
                          "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold",
                          result.tone === "red"
                            ? "border-red-600/50 bg-red-500"
                            : result.tone === "black"
                              ? "border-zinc-900/50 bg-zinc-800"
                              : "border-green-600/50 bg-green-500",
                        ].join(" ")}
                      >
                        {result.n}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button className="mt-4 w-full rounded-xl bg-green-500 py-3.5 font-bold text-black transition-colors hover:bg-green-400">
                Connect to play
              </button>

              <p className="mt-2 text-center text-[10px] text-white/30">
                One ticket. One table. One readable settlement path.
              </p>
            </div>
          </div>

          <div className="relative flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#0a0a0a] p-4">
            <div className="absolute left-1/2 top-1/2 h-[420px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-500/6 blur-[120px] pointer-events-none" />

            <div className="relative mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Active bet strip</div>
                <div className="mt-1 text-sm font-semibold text-white">Straight 17 selected on the standard European board.</div>
              </div>
              <button className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/65 hover:text-white">
                Clear selection
              </button>
            </div>

            <div className="relative flex-1 overflow-x-auto pb-4 custom-scrollbar">
              <RouletteBoard />
            </div>
          </div>
        </div>

        <section className="rounded-[1.8rem] border border-white/8 bg-white/[0.03] p-4">
          <div className="flex flex-wrap gap-2 border-b border-white/8 pb-3">
            {roomTabs.map((tab, index) => (
              <button
                key={tab}
                className={[
                  "rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] transition-colors",
                  index === 0 ? "bg-white text-black" : "text-white/45 hover:bg-white/5 hover:text-white",
                ].join(" ")}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {streamFilters.map((filter, index) => (
              <button
                key={filter}
                className={[
                  "rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] transition-colors",
                  index === 0
                    ? "border-green-500/20 bg-green-500/10 text-green-300"
                    : "border-white/10 bg-white/5 text-white/45 hover:text-white",
                ].join(" ")}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_0.55fr]">
            <div className="rounded-2xl border border-white/8 bg-black/25">
              <div className="grid grid-cols-[1fr_1fr_1fr_1fr_56px] border-b border-white/8 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">
                <div>Time / Hash</div>
                <div>Game</div>
                <div>Bet info</div>
                <div>Result</div>
                <div className="text-right">Tx</div>
              </div>

              {[
                { time: "14:02:11", hash: "0xebd9...2a1f", info: "Straight 17", stake: "10.00 USDC", result: "Waiting..." },
                { time: "14:01:45", hash: "0x11ad...82fe", info: "Red", stake: "50.00 USDC", result: "+100.00" },
              ].map((row, index) => (
                <div
                  key={row.hash}
                  className={[
                    "grid grid-cols-[1fr_1fr_1fr_1fr_56px] items-center px-4 py-4 text-sm",
                    index === 0 ? "border-b border-white/8" : "",
                  ].join(" ")}
                >
                  <div>
                    <div className="font-mono text-white">{row.time}</div>
                    <div className="text-xs font-mono text-white/30">{row.hash}</div>
                  </div>
                  <div>European Roulette</div>
                  <div>
                    <div className="text-white">{row.info}</div>
                    <div className="text-xs text-white/40">{row.stake}</div>
                  </div>
                  <div className={row.result.startsWith("+") ? "font-bold text-green-400" : "text-white/65"}>{row.result}</div>
                  <div className="text-right text-white/35">→</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="rounded-2xl border border-white/8 bg-black/25 p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Players</div>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between"><span className="text-white/55">Active table players</span><span className="font-semibold">18</span></div>
                  <div className="flex items-center justify-between"><span className="text-white/55">Largest live ticket</span><span className="font-mono">120.00 USDC</span></div>
                  <div className="flex items-center justify-between"><span className="text-white/55">Most used bet</span><span className="font-semibold">Red</span></div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/25 p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Analytics</div>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between"><span className="text-white/55">24h room volume</span><span className="font-mono">$1.2M</span></div>
                  <div className="flex items-center justify-between"><span className="text-white/55">Average ticket</span><span className="font-mono">18.20 USDC</span></div>
                  <div className="flex items-center justify-between"><span className="text-white/55">Settlement status</span><span className="font-semibold text-green-300">Healthy</span></div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/25 p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Game details</div>
                <p className="mt-4 text-sm leading-6 text-white/50">
                  Standard European roulette board. One zero lane, inside and outside bets, and a compact ticket review path.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
