import { ShellHeader, ShellHeaderBrand, ShellHeaderNav, ShellHeaderActions } from "@ssot/ui";
import Link from "next/link";
import { UserCircleIcon, WalletIcon } from "@heroicons/react/24/outline";

const categories = ["All Rooms", "Table", "Originals", "Fast Entry"];

const roomCards = [
  {
    title: "Precision Dice",
    tag: "Original",
    promise: "Call the cap and size the ticket in seconds.",
    cue: "Fast under / over room",
    href: "/prototype/ui-ux-v2-dice",
  },
  {
    title: "Coin Toss",
    tag: "Binary",
    promise: "Fast two-sided action with a clean slip flow.",
    cue: "Heads or tails, one short ticket",
    href: "/prototype/ui-ux-v2-cointoss",
  },
  {
    title: "Keno",
    tag: "Board pick",
    promise: "Pick the board, then let the room handle the rest.",
    cue: "Multi-pick board play",
    href: "/prototype/ui-ux-v2-keno",
  },
];

export default function DirectoryPrototype() {
  return (
    <div className="min-h-screen bg-[#050505] font-sans text-white selection:bg-purple-500/30">
      <ShellHeader variant="solid">
        <div className="flex items-center gap-12">
          <ShellHeaderBrand name="ArbiGameFi" />
          <ShellHeaderNav>
            <Link href="/prototype/ui-ux-v2-directory" className="border-b-2 border-white pb-1 text-white transition-colors hover:text-white">
              Games
            </Link>
            <Link href="/prototype/ui-ux-v2-liquidity" className="transition-colors hover:text-white">
              Liquidity
            </Link>
            <Link href="/prototype/ui-ux-v2-referral" className="transition-colors hover:text-white">
              Affiliates
            </Link>
            <Link href="/prototype/ui-ux-v2-account" className="transition-colors hover:text-white">
              Account
            </Link>
          </ShellHeaderNav>
        </div>
        <ShellHeaderActions>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-mono text-white/60 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            Arbitrum
          </div>
          <button className="hidden items-center justify-center rounded-full p-2 transition-colors hover:bg-white/10 sm:flex">
            <UserCircleIcon className="h-5 w-5 text-white/70" />
          </button>
          <button className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white transition-transform active:scale-95 hover:bg-white/20">
            <WalletIcon className="h-4 w-4" />
            <span>0x12...34af</span>
          </button>
        </ShellHeaderActions>
      </ShellHeader>

      <main className="mx-auto max-w-[1440px] px-6 py-12 md:py-16">
        <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">Room directory</div>
            <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">Choose a room and get straight to the table.</h1>
            <p className="mt-4 text-lg text-white/50">
              Room-first selection. Pick the pace, read the ticket style, and enter without digging through protocol mechanics.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 rounded-xl border border-white/5 bg-[#0a0a0a] p-1">
            {categories.map((category, index) => (
              <button
                key={category}
                className={[
                  "rounded-lg px-4 py-2 text-sm font-bold transition-all",
                  index === 0 ? "bg-white/10 text-white shadow" : "text-white/40 hover:bg-white/5 hover:text-white",
                ].join(" ")}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <section className="mb-10 grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <Link href="/prototype/ui-ux-v2-roulette" className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
            <div className="absolute right-0 top-0 h-72 w-72 bg-fuchsia-500/16 blur-[90px] transition-colors group-hover:bg-fuchsia-500/24" />
            <div className="relative flex h-full flex-col justify-between gap-10">
              <div className="flex items-start justify-between gap-4">
                <div className="rounded-full border border-fuchsia-500/20 bg-fuchsia-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-fuchsia-300">
                  Featured room
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
                  Table
                </div>
              </div>

              <div className="max-w-xl">
                <h2 className="text-4xl font-bold tracking-tight">European Roulette</h2>
                <p className="mt-4 max-w-md text-white/55">
                  Standard European table layout with a compact ticket rail and a clearer room-first entry flow.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 rounded-[1.5rem] border border-white/8 bg-black/25 p-4">
                {["Table-first entry", "Straight and outside bets", "Readable settlement path"].map((item) => (
                  <div key={item} className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm font-medium text-white/75">
                    {item}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-white/45">Flagship room for first-time table players and repeat ticket flow.</div>
                <span className="text-sm font-medium text-blue-400 transition-transform group-hover:translate-x-1">Enter Room →</span>
              </div>
            </div>
          </Link>

          <div className="grid grid-cols-1 gap-6">
            {roomCards.map((room) => (
              <Link
                key={room.title}
                href={room.href}
                className="group flex min-h-[180px] flex-col rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-6 transition-colors hover:bg-white/[0.05]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
                    {room.tag}
                  </div>
                  <div className="text-xs font-medium text-blue-400 transition-transform group-hover:translate-x-1">Enter →</div>
                </div>
                <h3 className="mt-4 text-xl font-bold">{room.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/55">{room.promise}</p>
                <div className="mt-auto pt-5 text-sm text-white/40">{room.cue}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {[
            {
              title: "Read by pace",
              body: "Table rooms, binary rooms, and board rooms should feel distinct at first glance.",
            },
            {
              title: "Enter in one glance",
              body: "Pick the room from the card itself instead of reading a second layer of explanation.",
            },
            {
              title: "Keep trust one click away",
              body: "Liquidity and settlement stay close, but the directory still acts like a lobby first.",
            },
          ].map((panel) => (
            <div key={panel.title} className="rounded-[1.5rem] border border-white/8 bg-black/25 px-5 py-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Lobby proof</div>
              <h3 className="mt-3 text-lg font-semibold">{panel.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/50">{panel.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
