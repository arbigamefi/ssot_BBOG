import type { Metadata } from "next";

import { ArbiGameFiLockup, ArbiGameFiMark } from "../../../components/ArbiGameFiBrand";

export const metadata: Metadata = {
  title: "UI UX Prototype v2 Flagship Screens",
  robots: {
    index: false,
    follow: false,
  },
};

const ROOM_PILLS = ["Dice", "Coin Toss", "Roulette", "Keno"];
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const ROULETTE_ROWS = Array.from({ length: 12 }, (_, row) => [3 * row + 1, 3 * row + 2, 3 * row + 3]);

function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "accent" | "light";
}) {
  const toneClass =
    tone === "accent"
      ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
      : tone === "light"
        ? "border-white/12 bg-white text-slate-950"
        : "border-white/12 bg-white/[0.04] text-slate-200";

  return (
    <span
      className={[
        "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
        toneClass,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function BoardFrame({
  title,
  subtitle,
  width,
  children,
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
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">{title}</div>
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

function HomeV2Artboard() {
  return (
    <div className="min-h-[940px] bg-[radial-gradient(circle_at_16%_18%,rgba(30,159,255,0.18),transparent_20%),radial-gradient(circle_at_84%_18%,rgba(255,82,124,0.18),transparent_22%),linear-gradient(180deg,#040611_0%,#060916_46%,#050815_100%)]">
      <div className="mx-auto max-w-[1320px] px-10 py-7">
        <div className="flex items-center justify-between gap-6">
          <ArbiGameFiLockup className="h-11" />
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white">Rooms</div>
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white">Liquidity</div>
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white">Live Bets</div>
            <div className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950">Open Rooms</div>
          </div>
        </div>

        <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1.04fr)_420px]">
          <div className="space-y-7">
            <Badge tone="accent">Wallet-native game rooms</Badge>
            <div className="space-y-5">
              <h1 className="max-w-4xl text-[84px] font-black leading-[0.9] tracking-[-0.07em] text-white">
                Play on-chain without losing the room feel.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-300">
                ArbiGameFi brings premium game-room flow and readable settlement into the same surface. Choose
                a room, build a ticket, and follow the outcome without dropping into protocol clutter.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-slate-950">Open Rooms</div>
              <div className="rounded-full border border-white/12 bg-white/[0.04] px-7 py-3.5 text-sm font-semibold text-white">How It Works</div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Badge>Wallet-native actions</Badge>
              <Badge>Readable settlement path</Badge>
              <Badge>Auditable room activity</Badge>
            </div>

            <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] px-5 py-4">
              <div className="grid grid-cols-4 gap-4">
                {[
                  ["Live rooms", "4"],
                  ["Wallet-first tickets", "Always on"],
                  ["Settlement", "Visible"],
                  ["Liquidity", "Reserve-aware"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[1rem] border border-white/8 bg-[#071024] px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
                    <div className="mt-2 text-2xl font-black text-white">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(11,17,38,0.96),rgba(11,9,26,0.98))] p-5 shadow-[0_24px_70px_rgba(12,18,38,0.4)]">
            <div className="flex items-center justify-between">
              <Badge>Featured room</Badge>
              <Badge tone="accent">Flagship</Badge>
            </div>

            <div className="mt-5 overflow-hidden rounded-[1.6rem] border border-fuchsia-400/20 bg-[radial-gradient(circle_at_top,rgba(255,90,125,0.22),transparent_24%),linear-gradient(180deg,rgba(45,13,40,0.98),rgba(10,14,28,0.98))] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Roulette room</div>
                  <div className="mt-2 text-4xl font-black text-white">European flagship table</div>
                </div>
                <div className="flex h-16 w-16 items-center justify-center rounded-[1.2rem] border border-white/10 bg-white/[0.05] text-3xl">
                  17
                </div>
              </div>

              <div className="mt-4 text-sm leading-6 text-slate-300">
                Standard board on the right, compact ticket on the left, and a calmer trust layer below the fold.
              </div>

              <div className="mt-6 rounded-[1.3rem] border border-white/10 bg-black/20 p-4">
                <div className="grid grid-cols-[58px_repeat(3,minmax(0,1fr))] gap-2">
                  <div className="row-span-4 flex items-center justify-center rounded-[1rem] border border-emerald-300/20 bg-[linear-gradient(180deg,rgba(12,63,53,0.98),rgba(7,33,28,0.98))] text-2xl font-black text-white">
                    0
                  </div>
                  {[1, 2, 3, 16, 17, 18, 34, 35, 36].map((value) => (
                    <div
                      key={value}
                      className={[
                        "flex h-12 items-center justify-center rounded-xl border text-sm font-black text-white",
                        value === 17 ? "border-cyan-300/60 ring-2 ring-cyan-300/40" : "border-white/10",
                        RED_NUMBERS.has(value)
                          ? "bg-[linear-gradient(180deg,rgba(111,18,49,0.95),rgba(73,12,31,0.98))]"
                          : "bg-[linear-gradient(180deg,rgba(9,16,34,0.95),rgba(5,10,23,0.98))]",
                      ].join(" ")}
                    >
                      {value}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  ["Choose a room", "Pick the pace and game family first."],
                  ["Build the ticket", "Outcome, stake, rounds, one compact slip."],
                  ["Follow settlement", "Readable result and proof when it matters."],
                ].map(([title, body], index) => (
                  <div key={title} className="rounded-[1rem] border border-white/10 bg-black/20 px-4 py-4">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-black text-slate-950">
                      {index + 1}
                    </div>
                    <div className="mt-3 text-sm font-semibold text-white">{title}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-400">{body}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Featured rooms</div>
                <div className="mt-2 text-4xl font-black tracking-[-0.05em] text-white">Choose a room and get straight to the table.</div>
              </div>
              <div className="text-sm text-slate-400">Room-first gameplay, trust layer close by.</div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-4">
              {[
                ["Dice", "Precision room", "Call the cap and size the ticket in seconds."],
                ["Coin Toss", "Fast room", "Fast two-sided action with a clean slip flow."],
                ["Keno", "Board room", "Pick the board, then let the room handle the rest."],
              ].map(([title, tag, body]) => (
                <div key={title} className="rounded-[1.4rem] border border-white/10 bg-[#071024] p-4">
                  <Badge>{tag}</Badge>
                  <div className="mt-4 text-2xl font-black text-white">{title}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-400">{body}</div>
                  <div className="mt-5 rounded-full bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-950">Enter Room</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Why trust it</div>
              <div className="mt-4 space-y-3">
                {[
                  ["Wallet-native flow", "Tickets start from the wallet and stay explicit through signing."],
                  ["Readable settlement", "Results, claims, and follow-up actions sit in dedicated routes."],
                  ["Visible liquidity context", "Capital surfaces stay readable without raw protocol jargon."],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-[1.1rem] border border-white/8 bg-[#071024] px-4 py-4">
                    <div className="text-sm font-semibold text-white">{title}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-400">{body}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(135deg,rgba(10,24,42,0.95),rgba(41,10,38,0.94))] p-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Final CTA</div>
              <div className="mt-2 text-4xl font-black tracking-[-0.05em] text-white">Ready to step into a room?</div>
              <div className="mt-2 text-sm leading-6 text-slate-300">Start with the directory, choose the room that fits your style, and keep the trust layer available when you need it.</div>
              <div className="mt-5 rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950">Open Rooms</div>
            </div>
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
        base,
      ].join(" ")}
    >
      {value}
    </div>
  );
}

function RouletteV2Artboard() {
  return (
    <div className="min-h-[980px] bg-[radial-gradient(circle_at_top,rgba(255,90,125,0.16),transparent_20%),linear-gradient(180deg,#050816_0%,#03060f_100%)] px-8 py-8">
      <div className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,29,0.98),rgba(8,11,22,0.98))] px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <ArbiGameFiLockup className="h-10" />
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white">All Games</div>
            <div className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-950">Connect wallet</div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2">
        {ROOM_PILLS.map((item, index) => (
          <div
            key={item}
            className={[
              "rounded-full px-4 py-2 text-sm font-semibold",
              index === 2 ? "bg-white text-slate-950" : "border border-white/10 bg-white/[0.04] text-white",
            ].join(" ")}
          >
            {item}
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-5 py-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Roulette</div>
          <div className="mt-1 text-xl font-black text-white">European flagship table</div>
        </div>
        <div className="flex gap-2">
          <Badge>Quiet room</Badge>
          <Badge tone="accent">Settlement readable</Badge>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[338px_minmax(0,1fr)]">
        <div className="rounded-[2rem] border border-fuchsia-400/20 bg-[linear-gradient(180deg,rgba(34,12,42,0.98),rgba(10,15,29,0.98))] p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Manual</div>
              <div className="mt-1 text-xl font-black text-white">Build the ticket</div>
            </div>
            <Badge>Wallet-native</Badge>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-full bg-white px-4 py-2 text-center text-sm font-semibold text-slate-950">Manual</div>
            <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-center text-sm font-semibold text-slate-400">Auto</div>
          </div>

          <div className="mt-5 rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Stake amount</div>
            <div className="mt-3 flex items-center gap-3 rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="text-3xl font-black text-white">0.10</div>
              <div className="ml-auto rounded-full border border-white/10 px-3 py-1 text-sm font-semibold text-white">USDC</div>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {["0.10", "0.50", "1.00", "5.00"].map((chip) => (
                <div key={chip} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-center text-xs font-semibold text-white">
                  {chip}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Number of bets</div>
                <div className="mt-1 text-sm font-semibold text-white">Choose how many spins to cover</div>
              </div>
              <div className="rounded-full border border-white/10 px-3 py-1 text-sm font-semibold text-white">1</div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-white/10">
              <div className="h-2 w-[12%] rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400" />
            </div>
          </div>

          <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Ticket summary</div>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <div className="flex items-center justify-between"><span>Active bet</span><span className="font-semibold text-white">Straight 17</span></div>
              <div className="flex items-center justify-between"><span>Total stake</span><span className="font-semibold text-white">0.10 USDC</span></div>
              <div className="flex items-center justify-between"><span>Wallet</span><span className="font-semibold text-white">Disconnected</span></div>
            </div>
            <div className="mt-3 text-xs leading-6 text-slate-500">Quote, approvals, and receipt details stay behind the advanced disclosure until the ticket is ready.</div>
          </div>

          <div className="mt-5 rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950">Connect wallet</div>
        </div>

        <div className="rounded-[2rem] border border-fuchsia-400/20 bg-[radial-gradient(circle_at_top,rgba(255,90,125,0.18),transparent_24%),linear-gradient(180deg,rgba(42,13,42,0.98),rgba(7,12,24,0.98))] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge>European roulette</Badge>
                <Badge tone="accent">Straight 17</Badge>
              </div>
              <div className="mt-4 text-sm text-slate-300">Pick the board first. Dozens, columns, and outside calls stay visually attached to the table instead of turning into floating secondary cards.</div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white">Clear</div>
          </div>

          <div className="mt-6 grid grid-cols-[76px_repeat(3,minmax(0,1fr))] gap-2">
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
              ["3rd 12", "25-36"],
            ].map(([title, body]) => (
              <div key={title} className="rounded-[1.1rem] border border-white/10 bg-[#081126] px-4 py-3">
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
              ["19-36", "High half"],
            ].map(([title, body]) => (
              <div key={title} className="rounded-[1.1rem] border border-white/10 bg-[#081126] px-4 py-3">
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

export default function PrototypeFlagshipV2Page() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#040611_0%,#060a18_100%)] text-white">
      <div className="mx-auto max-w-[1760px] space-y-10 px-8 py-10">
        <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,38,0.92),rgba(6,10,24,0.95))] p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-3">
              <Badge tone="accent">Figma refinement board</Badge>
              <h1 className="text-4xl font-black tracking-[-0.05em] text-white">ArbiGameFi UI/UX Prototype v2</h1>
              <p className="max-w-3xl text-base leading-7 text-slate-300">
                High-fidelity refinement boards for the two flagship surfaces: landing conversion and roulette room gameplay.
              </p>
            </div>
            <div className="grid gap-2 text-sm text-slate-400">
              <div>Focuses on hierarchy, tone, and final visual density.</div>
              <div>Built from frozen screen specs and brand baseline.</div>
            </div>
          </div>
        </div>

        <BoardFrame
          title="Screen 13"
          subtitle="Home v2 desktop. Premium landing screen with a single composed hero and lighter proof density."
          width={1440}
        >
          <HomeV2Artboard />
        </BoardFrame>

        <BoardFrame
          title="Screen 14"
          subtitle="Roulette room v2 desktop. Flagship table room with top selector, compact slip, and stronger board-first hierarchy."
          width={1440}
        >
          <RouletteV2Artboard />
        </BoardFrame>
      </div>
    </main>
  );
}
