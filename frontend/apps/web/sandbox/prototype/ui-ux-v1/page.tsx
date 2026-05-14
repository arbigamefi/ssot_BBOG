import type { Metadata } from "next";

import { ArbiGameFiLockup, ArbiGameFiMark } from "../../../components/ArbiGameFiBrand";

export const metadata: Metadata = {
  title: "UI UX Prototype v1",
  robots: {
    index: false,
    follow: false
  }
};

const ROOM_CARDS = [
  {
    name: "Dice",
    tag: "Precision room",
    cue: "Cap-driven play",
    body: "Dial the threshold, size the slip, and keep the roll on one focused surface.",
    accent: "from-cyan-400/25 to-blue-500/10"
  },
  {
    name: "Coin Toss",
    tag: "Fast room",
    cue: "Binary play",
    body: "One quick decision, one clean slip, one readable on-chain result.",
    accent: "from-amber-400/20 to-orange-500/10"
  },
  {
    name: "Roulette",
    tag: "Flagship table",
    cue: "European 0-36",
    body: "A premium table room with a compact slip and a stronger board-first layout.",
    accent: "from-fuchsia-500/25 to-rose-500/10"
  },
  {
    name: "Keno",
    tag: "Board room",
    cue: "Multi-pick board",
    body: "Pick the grid first, then move to the side slip for stake and rounds.",
    accent: "from-violet-500/25 to-indigo-500/10"
  }
];

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const ROULETTE_ROWS = Array.from({ length: 12 }, (_, row) => [
  3 * row + 1,
  3 * row + 2,
  3 * row + 3
]);

function PrototypeBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200">
      {children}
    </span>
  );
}

function BoardFrame({
  title,
  subtitle,
  width,
  children
}: {
  title: string;
  subtitle: string;
  width: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
            {title}
          </div>
          <div className="mt-1 text-sm text-slate-400">{subtitle}</div>
        </div>
        <div className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
          {width}px artboard
        </div>
      </div>

      <div
        className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#050816] shadow-[0_32px_90px_rgba(3,8,24,0.5)]"
        style={{ width }}
      >
        {children}
      </div>
    </section>
  );
}

function RoomCard({
  name,
  tag,
  cue,
  body,
  accent
}: {
  name: string;
  tag: string;
  cue: string;
  body: string;
  accent: string;
}) {
  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-[#081126] p-3">
      <div
        className={`rounded-[1.2rem] border border-white/10 bg-gradient-to-br ${accent} from-0% p-4`}
      >
        <div className="flex items-center justify-between gap-3">
          <PrototypeBadge>Room live</PrototypeBadge>
          <PrototypeBadge>{tag}</PrototypeBadge>
        </div>
        <div className="mt-6">
          <div className="text-2xl font-black text-white">{name}</div>
          <div className="mt-2 text-sm leading-6 text-slate-200">{body}</div>
        </div>
      </div>

      <div className="space-y-4 px-2 pb-2 pt-4">
        <div className="flex flex-wrap gap-2">
          <PrototypeBadge>{cue}</PrototypeBadge>
          <PrototypeBadge>Wallet-native</PrototypeBadge>
        </div>
        <div className="flex items-center justify-between border-t border-white/8 pt-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Room entry
            </div>
            <div className="mt-1 text-sm font-semibold text-white">Enter the table</div>
          </div>
          <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950">
            Enter room
          </div>
        </div>
      </div>
    </div>
  );
}

function RouletteCell({ value, selected = false }: { value: number; selected?: boolean }) {
  const isRed = RED_NUMBERS.has(value);
  const base = isRed
    ? "bg-[linear-gradient(180deg,rgba(111,18,49,0.95),rgba(73,12,31,0.98))]"
    : "bg-[linear-gradient(180deg,rgba(9,16,34,0.95),rgba(5,10,23,0.98))]";

  return (
    <div
      className={[
        "flex h-12 items-center justify-center rounded-2xl border text-sm font-black text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]",
        selected ? "border-cyan-300/60 ring-2 ring-cyan-300/40" : "border-white/10",
        base
      ].join(" ")}
    >
      {value}
    </div>
  );
}

function HomeArtboard() {
  return (
    <div className="min-h-[880px] bg-[radial-gradient(circle_at_top_left,rgba(20,115,255,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(201,59,99,0.18),transparent_30%),linear-gradient(180deg,#050816_0%,#040714_100%)]">
      <div className="border-b border-white/8 px-10 py-5">
        <div className="flex items-center justify-between gap-4">
          <ArbiGameFiLockup className="h-10" />
          <div className="flex items-center gap-3">
            <PrototypeBadge>Rooms</PrototypeBadge>
            <PrototypeBadge>Liquidity</PrototypeBadge>
            <PrototypeBadge>Live bets</PrototypeBadge>
            <div className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-950">
              Start Playing
            </div>
          </div>
        </div>
      </div>

      <div className="px-10 py-10">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.02fr)_420px]">
          <div className="space-y-7">
            <PrototypeBadge>Wallet-native casino rooms</PrototypeBadge>
            <div className="space-y-5">
              <h1 className="max-w-4xl text-7xl font-black leading-[0.92] tracking-[-0.06em] text-white">
                Premium on-chain rooms with a real casino feel.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-300">
                ArbiGameFi turns wallet-native gaming into a cleaner room experience. Choose the
                table, build the slip, and follow settlement without dropping into protocol clutter.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950">
                Start Playing
              </div>
              <div className="rounded-full border border-white/12 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white">
                Explore Rooms
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <PrototypeBadge>Non-custodial</PrototypeBadge>
              <PrototypeBadge>On-chain settlement</PrototypeBadge>
              <PrototypeBadge>Provable room facts</PrototypeBadge>
            </div>

            <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="grid grid-cols-4 gap-3">
                {[
                  ["Live rooms", "4"],
                  ["Recent activity", "Live"],
                  ["Non-custodial", "Wallet-first"],
                  ["Routing", "Release-backed"]
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-[1.1rem] border border-white/8 bg-[#071024] px-4 py-4"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {label}
                    </div>
                    <div className="mt-2 text-2xl font-black text-white">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,38,0.98),rgba(12,11,30,0.98))] p-5">
            <div className="flex items-center gap-2">
              {["Dice", "Coin Toss", "Roulette", "Keno"].map((item, index) => (
                <div
                  key={item}
                  className={[
                    "rounded-full px-4 py-2 text-sm font-semibold",
                    index === 2
                      ? "bg-white text-slate-950"
                      : "border border-white/10 bg-white/[0.04] text-white"
                  ].join(" ")}
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(201,59,99,0.18),transparent_34%),linear-gradient(180deg,rgba(36,11,33,0.95),rgba(8,12,27,0.98))] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Featured room
                  </div>
                  <div className="mt-2 text-4xl font-black text-white">Roulette</div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    A premium European table with a compact slip, clearer ticket review, and a
                    stronger board-first layout.
                  </p>
                </div>
                <div className="flex h-16 w-16 items-center justify-center rounded-[1.2rem] border border-white/10 bg-white/[0.04] text-4xl">
                  🎯
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {[
                  ["Pick the board", "Choose a straight, dozen, column, or even-money call."],
                  ["Build the slip", "Keep stake, rounds, and ticket review in one compact panel."],
                  [
                    "Follow settlement",
                    "Stay with the room while activity and proof remain readable."
                  ]
                ].map(([title, body], index) => (
                  <div
                    key={title}
                    className="flex items-start gap-4 rounded-[1.2rem] border border-white/8 bg-black/20 px-4 py-3"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-sm font-black text-white">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{title}</div>
                      <div className="mt-1 text-sm leading-6 text-slate-400">{body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-[1.4fr_1fr] gap-6">
          <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Featured rooms
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              {ROOM_CARDS.slice(0, 3).map((room) => (
                <RoomCard key={room.name} {...room} />
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                How it works
              </div>
              <div className="mt-4 space-y-3">
                {["Choose a room", "Set your ticket", "Settle on-chain"].map((step, index) => (
                  <div
                    key={step}
                    className="flex items-center gap-4 rounded-[1.1rem] border border-white/8 bg-[#071024] px-4 py-4"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-black text-slate-950">
                      {index + 1}
                    </div>
                    <div className="text-base font-semibold text-white">{step}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(135deg,rgba(11,19,43,0.94),rgba(37,11,41,0.92))] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                Final CTA
              </div>
              <div className="mt-2 text-3xl font-black text-white">
                Start in the flagship rooms.
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-300">
                Lead with Roulette, Dice, and Coin Toss, then open deeper audit routes only when the
                user asks for them.
              </div>
              <div className="mt-5 rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950">
                Start Playing
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GamesDirectoryArtboard() {
  return (
    <div className="min-h-[860px] bg-[radial-gradient(circle_at_top_left,rgba(20,115,255,0.14),transparent_24%),linear-gradient(180deg,#040714_0%,#050917_100%)] px-10 py-10">
      <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,38,0.98),rgba(7,12,24,0.98))] p-6">
        <div className="flex items-center gap-2">
          {["Fast", "Precision", "Classic table", "Board play"].map((item, index) => (
            <div
              key={item}
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold",
                index === 2
                  ? "bg-white text-slate-950"
                  : "border border-white/10 bg-white/[0.04] text-white"
              ].join(" ")}
            >
              {item}
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <ArbiGameFiMark className="h-16 w-16" />
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                  Game directory
                </div>
                <div className="mt-2 text-6xl font-black tracking-[-0.06em] text-white">
                  Choose the room, then enter the table.
                </div>
              </div>
            </div>
            <p className="max-w-3xl text-lg leading-8 text-slate-300">
              The directory is built for fast room selection. Featured tables lead, categories help
              decision-making, and every card answers what kind of play it offers.
            </p>
            <div className="grid grid-cols-3 gap-4">
              {[
                ["Live rooms", "4"],
                ["Flagship", "Roulette"],
                ["Flow", "Room-first"]
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-[1.2rem] border border-white/10 bg-white/[0.04] px-4 py-4"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {label}
                  </div>
                  <div className="mt-2 text-2xl font-black text-white">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(135deg,rgba(57,14,33,0.95),rgba(7,12,24,0.98))] p-5">
            <div className="flex items-center justify-between">
              <PrototypeBadge>Featured table</PrototypeBadge>
              <PrototypeBadge>Recommended</PrototypeBadge>
            </div>
            <div className="mt-5 text-4xl font-black text-white">Roulette</div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              The hero room for the brand: a standard European table, a compact slip, and the
              cleanest flagship presentation.
            </p>
            <div className="mt-6 space-y-3">
              {["Classic table action", "Compact ticket review", "Lower-fold proof only"].map(
                (item) => (
                  <div
                    key={item}
                    className="rounded-[1rem] border border-white/8 bg-black/20 px-4 py-3 text-sm font-semibold text-white"
                  >
                    {item}
                  </div>
                )
              )}
            </div>
            <div className="mt-6 rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950">
              Enter roulette
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-4 gap-5">
        {ROOM_CARDS.map((room) => (
          <RoomCard key={room.name} {...room} />
        ))}
      </div>
    </div>
  );
}

function RouletteRoomArtboard() {
  return (
    <div className="min-h-[980px] bg-[radial-gradient(circle_at_top,rgba(201,59,99,0.16),transparent_22%),linear-gradient(180deg,#050816_0%,#03060f_100%)] px-8 py-8">
      <div className="flex items-center justify-between rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,29,0.98),rgba(8,11,22,0.98))] px-5 py-4">
        <ArbiGameFiBrandBlock />
        <div className="flex items-center gap-3">
          <PrototypeBadge>All Games</PrototypeBadge>
          <div className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-950">
            Connect wallet
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        {["Dice", "Coin Toss", "Roulette", "Keno"].map((item, index) => (
          <div
            key={item}
            className={[
              "rounded-full px-4 py-2 text-sm font-semibold",
              index === 2
                ? "bg-white text-slate-950"
                : "border border-white/10 bg-white/[0.04] text-white"
            ].join(" ")}
          >
            {item}
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-5 py-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Roulette
          </div>
          <div className="mt-1 text-xl font-black text-white">European flagship table</div>
        </div>
        <div className="flex gap-2">
          <PrototypeBadge>Quiet room</PrototypeBadge>
          <PrototypeBadge>Sync healthy</PrototypeBadge>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="rounded-[2rem] border border-fuchsia-400/20 bg-[linear-gradient(180deg,rgba(34,12,42,0.98),rgba(10,15,29,0.98))] p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Bet slip
              </div>
              <div className="mt-1 text-xl font-black text-white">Build the ticket</div>
            </div>
            <PrototypeBadge>Wallet-native</PrototypeBadge>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-full bg-white px-4 py-2 text-center text-sm font-semibold text-slate-950">
              Manual
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-center text-sm font-semibold text-slate-400">
              Auto
            </div>
          </div>

          <div className="mt-5 rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Stake amount
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="text-3xl font-black text-white">0.10</div>
              <div className="ml-auto rounded-full border border-white/10 px-3 py-1 text-sm font-semibold text-white">
                USDC
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              {["0.10", "0.50", "1.00", "5.00"].map((chip) => (
                <div
                  key={chip}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white"
                >
                  {chip}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Rounds
                </div>
                <div className="mt-1 text-sm font-semibold text-white">
                  Choose how many spins to cover
                </div>
              </div>
              <div className="rounded-full border border-white/10 px-3 py-1 text-sm font-semibold text-white">
                1
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-white/10">
              <div className="h-2 w-[12%] rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400" />
            </div>
          </div>

          <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Ticket summary
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <span>Active bet</span>
                <span className="font-semibold text-white">Straight 17</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total stake</span>
                <span className="font-semibold text-white">0.10 USDC</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Wallet</span>
                <span className="font-semibold text-white">Connected</span>
              </div>
            </div>
            <div className="mt-3 text-xs leading-6 text-slate-500">
              Review quote, fee, and approvals in the trace only when the ticket is ready.
            </div>
          </div>

          <div className="mt-5 rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950">
            Place ticket
          </div>
        </div>

        <div className="rounded-[2rem] border border-fuchsia-400/20 bg-[radial-gradient(circle_at_top,rgba(201,59,99,0.16),transparent_24%),linear-gradient(180deg,rgba(42,13,42,0.98),rgba(7,12,24,0.98))] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <PrototypeBadge>European roulette</PrototypeBadge>
                <PrototypeBadge>Straight 17</PrototypeBadge>
              </div>
              <div className="mt-4 text-sm text-slate-300">
                Pick the board first. Dozens, columns, and outside bets stay attached to the table
                instead of floating as separate cards.
              </div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white">
              Clear
            </div>
          </div>

          <div className="mt-6 grid grid-cols-[72px_repeat(3,minmax(0,1fr))] gap-2">
            <div className="row-span-12 flex items-center justify-center rounded-[1.4rem] border border-emerald-300/20 bg-[linear-gradient(180deg,rgba(12,63,53,0.98),rgba(7,33,28,0.98))] text-3xl font-black text-white">
              0
            </div>
            {ROULETTE_ROWS.flat().map((value) => (
              <RouletteCell key={value} value={value} selected={value === 17} />
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              ["1st 12", "1-12"],
              ["2nd 12", "13-24"],
              ["3rd 12", "25-36"]
            ].map(([title, body]) => (
              <div
                key={title}
                className="rounded-[1.1rem] border border-white/10 bg-[#081126] px-4 py-3"
              >
                <div className="text-sm font-semibold text-white">{title}</div>
                <div className="mt-1 text-xs text-slate-500">{body}</div>
              </div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              ["Column 1", "1,4,7..."],
              ["Column 2", "2,5,8..."],
              ["Column 3", "3,6,9..."],
              ["Red", "18 red numbers"],
              ["Black", "18 black numbers"],
              ["Odd", "All odd numbers"],
              ["Even", "All even numbers"],
              ["1-18", "Low half"],
              ["19-36", "High half"]
            ].map(([title, body]) => (
              <div
                key={title}
                className="rounded-[1.1rem] border border-white/10 bg-[#081126] px-4 py-3"
              >
                <div className="text-sm font-semibold text-white">{title}</div>
                <div className="mt-1 text-xs text-slate-500">{body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileRoomArtboard() {
  return (
    <div className="min-h-[1120px] bg-[linear-gradient(180deg,#050816_0%,#03060f_100%)] px-5 py-6">
      <div className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,29,0.98),rgba(8,11,22,0.98))] p-4">
        <div className="flex items-center justify-between">
          <ArbiGameFiMark className="h-11 w-11 rounded-[1rem]" />
          <PrototypeBadge>Roulette</PrototypeBadge>
        </div>
        <div className="mt-4 flex gap-2 overflow-hidden">
          {["Dice", "Coin Toss", "Roulette", "Keno"].map((item, index) => (
            <div
              key={item}
              className={[
                "rounded-full px-3 py-2 text-xs font-semibold",
                index === 2
                  ? "bg-white text-slate-950"
                  : "border border-white/10 bg-white/[0.04] text-white"
              ].join(" ")}
            >
              {item}
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-[1.3rem] border border-white/10 bg-white/[0.04] px-4 py-4">
          <div className="text-xl font-black text-white">European flagship table</div>
          <div className="mt-2 text-sm leading-6 text-slate-400">
            Board first on mobile. Slip immediately after.
          </div>
        </div>

        <div className="mt-4 rounded-[1.6rem] border border-fuchsia-400/20 bg-[radial-gradient(circle_at_top,rgba(201,59,99,0.16),transparent_24%),linear-gradient(180deg,rgba(42,13,42,0.98),rgba(7,12,24,0.98))] p-4">
          <div className="flex items-center justify-between">
            <PrototypeBadge>Straight 17</PrototypeBadge>
            <PrototypeBadge>Clear</PrototypeBadge>
          </div>
          <div className="mt-4 grid grid-cols-[52px_repeat(3,minmax(0,1fr))] gap-2">
            <div className="row-span-12 flex items-center justify-center rounded-[1rem] border border-emerald-300/20 bg-[linear-gradient(180deg,rgba(12,63,53,0.98),rgba(7,33,28,0.98))] text-2xl font-black text-white">
              0
            </div>
            {ROULETTE_ROWS.flat().map((value) => (
              <div
                key={value}
                className={[
                  "flex h-10 items-center justify-center rounded-xl border text-xs font-black text-white",
                  value === 17 ? "border-cyan-300/60 ring-2 ring-cyan-300/40" : "border-white/10",
                  RED_NUMBERS.has(value)
                    ? "bg-[linear-gradient(180deg,rgba(111,18,49,0.95),rgba(73,12,31,0.98))]"
                    : "bg-[linear-gradient(180deg,rgba(9,16,34,0.95),rgba(5,10,23,0.98))]"
                ].join(" ")}
              >
                {value}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(34,12,42,0.98),rgba(10,15,29,0.98))] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Bet slip
          </div>
          <div className="mt-3 rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Stake amount
            </div>
            <div className="mt-2 text-3xl font-black text-white">0.10 USDC</div>
          </div>
          <div className="mt-3 flex gap-2">
            {["0.10", "0.50", "1.00", "5.00"].map((chip) => (
              <div
                key={chip}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white"
              >
                {chip}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950">
            Place ticket
          </div>
        </div>
      </div>
    </div>
  );
}

function ArbiGameFiBrandBlock() {
  return (
    <div className="flex items-center gap-3">
      <ArbiGameFiMark className="h-11 w-11 rounded-[1rem]" />
      <div>
        <div className="text-sm font-black tracking-[0.08em] text-white">ArbiGameFi</div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Premium table rooms
        </div>
      </div>
    </div>
  );
}

export default function PrototypePage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#040611_0%,#060a18_100%)] text-white">
      <div className="mx-auto max-w-[1760px] space-y-10 px-8 py-10">
        <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,38,0.92),rgba(6,10,24,0.95))] p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-3">
              <PrototypeBadge>Figma export board</PrototypeBadge>
              <h1 className="text-4xl font-black tracking-[-0.05em] text-white">
                ArbiGameFi UI/UX Prototype v1
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-300">
                A dedicated prototype board for Figma capture. These are not production routes. They
                are screen boards for acquisition, room selection, and flagship gameplay.
              </p>
            </div>
            <div className="grid gap-2 text-sm text-slate-400">
              <div>Includes Home, Games Directory, Roulette Room, and Mobile Room system.</div>
              <div>Built from the frozen design brief, architecture pack, and screen specs.</div>
            </div>
          </div>
        </div>

        <BoardFrame
          title="Screen 01"
          subtitle="Home landing desktop. Built to sell the room concept before trust and proof details."
          width={1440}
        >
          <HomeArtboard />
        </BoardFrame>

        <BoardFrame
          title="Screen 02"
          subtitle="Games directory desktop. Built to help the user choose a room quickly."
          width={1440}
        >
          <GamesDirectoryArtboard />
        </BoardFrame>

        <BoardFrame
          title="Screen 03"
          subtitle="Roulette room desktop. Top selector stays on top; the board dominates; the slip stays compact."
          width={1440}
        >
          <RouletteRoomArtboard />
        </BoardFrame>

        <BoardFrame
          title="Screen 04"
          subtitle="Shared mobile room system. Gameplay surface before slip, with the same room family language."
          width={390}
        >
          <MobileRoomArtboard />
        </BoardFrame>
      </div>
    </main>
  );
}
