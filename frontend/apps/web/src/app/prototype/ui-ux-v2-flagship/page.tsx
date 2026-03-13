import * as React from "react";
import type { Metadata } from "next";

import { ArbiGameFiBrand } from "../../../components/ArbiGameFiBrand";

export const metadata: Metadata = {
  title: "UI UX Prototype v2 Flagship Screens",
  robots: {
    index: false,
    follow: false,
  },
};

const ROOM_PILLS = ["Dice", "Coin Toss", "Roulette", "Keno"];
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const ROULETTE_WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const ROULETTE_TABLE_ROWS = [
  { column: 3, numbers: Array.from({ length: 12 }, (_value, index) => index * 3 + 3) },
  { column: 2, numbers: Array.from({ length: 12 }, (_value, index) => index * 3 + 2) },
  { column: 1, numbers: Array.from({ length: 12 }, (_value, index) => index * 3 + 1) },
];

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
          <ArbiGameFiBrand compact subtitle="Wallet-native game rooms" />
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white">Rooms</div>
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white">Liquidity</div>
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white">Live Bets</div>
            <div className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950">Open Rooms</div>
          </div>
        </div>

        <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1fr)_596px]">
          <div className="space-y-7">
            <Badge tone="accent">Wallet-native game rooms</Badge>
            <div className="space-y-5">
              <h1 className="max-w-4xl text-[64px] font-black leading-[0.94] tracking-[-0.07em] text-white">
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

            <div className="space-y-4">
              <div className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,16,35,0.96),rgba(7,12,25,0.98))] px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Room entry sequence</div>
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-200">
                    3 moves
                  </div>
                </div>

                <div className="mt-4 grid items-stretch gap-3 xl:grid-cols-[minmax(0,1fr)_52px_minmax(0,1fr)_52px_minmax(0,1fr)]">
                  {[
                    ["01", "Choose room", "Start with a room whose pace and board language already feel familiar."],
                    ["02", "Build ticket", "Keep stake, rounds, and the table call inside one short readable ticket."],
                    ["03", "Follow result", "Stay close to the outcome without dropping into protocol-heavy clutter."],
                  ].map(([step, title, body], index, list) => (
                    <React.Fragment key={step}>
                      <div className="rounded-[1.15rem] border border-white/10 bg-black/20 px-4 py-4">
                        <div className="text-[11px] font-black tracking-[0.18em] text-cyan-200">{step}</div>
                        <div className="mt-3 text-sm font-semibold text-white">{title}</div>
                        <div className="mt-2 text-sm leading-6 text-slate-400">{body}</div>
                      </div>
                      {index < list.length - 1 ? (
                        <div className="hidden items-center justify-center xl:flex">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-lg font-black text-cyan-200">
                            →
                          </div>
                        </div>
                      ) : null}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-[164px_repeat(3,minmax(0,1fr))]">
                <div className="rounded-[1.35rem] border border-fuchsia-400/20 bg-[radial-gradient(circle_at_top,rgba(255,96,142,0.18),transparent_24%),linear-gradient(180deg,rgba(32,10,40,0.98),rgba(9,15,31,0.98))] px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-100">Live signal</div>
                  <div className="mt-3 text-5xl font-black tracking-[-0.06em] text-white">4</div>
                  <div className="mt-1 text-sm leading-6 text-slate-300">Rooms live now.</div>
                </div>

                {[
                  ["Always on", "Rooms stay open with short wallet-native entry."],
                  ["Reserve-aware", "Trust context is near the room without taking over play."],
                  ["Readable settlement", "Results and follow-up actions live one route away."],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-[1.35rem] border border-white/10 bg-black/20 px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</div>
                    <div className="mt-3 text-sm leading-6 text-slate-300">{body}</div>
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
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Roulette room</div>
                  <div className="mt-2 text-[42px] font-black leading-[0.92] tracking-[-0.05em] text-white">European flagship table</div>
                </div>
                <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                  Open room
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                <span>Board-first room design</span>
                <span className="h-1 w-1 rounded-full bg-slate-600" />
                <span>Compact ticket rail</span>
                <span className="h-1 w-1 rounded-full bg-slate-600" />
                <span>Quiet trust context</span>
              </div>

              <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,122,161,0.14),transparent_18%),linear-gradient(180deg,rgba(8,10,24,0.92),rgba(5,8,18,0.98))] p-4">
                <div className="mb-4 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <span>Flagship room preview</span>
                  <span>0 + 3x12 table</span>
                </div>
                <RoulettePreviewTable compact selected={17} />
                <div className="mt-4 grid grid-cols-[minmax(0,1fr)_192px] gap-3">
                  <div className="rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Why this room works</div>
                    <div className="mt-2 text-sm leading-6 text-slate-300">
                      The table stays dominant, the ticket stays short, and trust detail waits below the fold instead of competing with play.
                    </div>
                  </div>
                  <div className="rounded-[1rem] border border-fuchsia-300/20 bg-fuchsia-300/10 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fuchsia-100">Room pulse</div>
                    <div className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">Straight 17</div>
                    <div className="mt-1 text-xs leading-5 text-fuchsia-50/80">Typed bet language replaces raw protocol fields.</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {["Board-first", "Tight slip", "Quiet trust"].map((title) => (
                  <div
                    key={title}
                    className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200"
                  >
                    {title}
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950">Enter roulette room</div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white">See ticket flow</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,31,0.92),rgba(6,10,24,0.98))] p-6">
            <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
              <div className="space-y-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Tonight&apos;s rooms</div>
                <div className="text-4xl font-black tracking-[-0.05em] text-white">Choose the room that matches your pace.</div>
                <div className="text-sm leading-7 text-slate-400">
                  Not every room should feel the same. Keep the table language familiar, the ticket short, and the trust layer one step away.
                </div>

                <div className="space-y-2">
                  {["Room-first gameplay", "Short ticket flow", "Trust close by"].map((item) => (
                    <div
                      key={item}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-200"
                    >
                      {item}
                    </div>
                  ))}
                </div>

                <div className="rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950">Browse all rooms</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 rounded-[1.5rem] border border-fuchsia-400/20 bg-[radial-gradient(circle_at_top,rgba(63,121,255,0.16),transparent_26%),linear-gradient(180deg,rgba(12,18,37,0.96),rgba(8,11,24,0.98))] p-5">
                  <div className="flex items-center justify-between">
                    <Badge tone="accent">Precision room</Badge>
                    <div className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-200">
                      Fast entry
                    </div>
                  </div>
                  <div className="mt-4 text-3xl font-black tracking-[-0.05em] text-white">Dice</div>
                  <div className="mt-2 max-w-[32rem] text-sm leading-6 text-slate-300">
                    Call the cap, scan the payout lane, and size the ticket in seconds. This room is built for the fastest clean read.
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    {["Cap lane", "Fast presets", "Compact result flow"].map((item) => (
                      <div key={item} className="rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-200">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                {[
                  ["Coin Toss", "Fast room", "Fast two-sided action with almost no setup friction."],
                  ["Keno", "Board room", "Pick the board, let the room carry the rest of the flow."],
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
          </div>

          <div className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(135deg,rgba(9,20,39,0.96),rgba(42,11,43,0.94))] p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Why players trust the room system</div>
            <div className="mt-2 text-4xl font-black tracking-[-0.05em] text-white">Designed to stay readable under action.</div>
            <div className="mt-3 max-w-[30rem] text-sm leading-7 text-slate-300">
              ArbiGameFi keeps the room surface playful without hiding what happens before signing, during settlement, or after the result lands.
            </div>

            <div className="mt-5 space-y-3">
              {[
                ["01", "Wallet-native flow", "Tickets start from the wallet and stay explicit through signing."],
                ["02", "Readable settlement", "Results, claims, and follow-up actions live in their own routes."],
                ["03", "Visible liquidity context", "Capital surfaces stay readable without forcing raw protocol language into play routes."],
              ].map(([index, title, body]) => (
                <div key={title} className="grid grid-cols-[44px_minmax(0,1fr)] gap-4 rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xs font-black tracking-[0.14em] text-white">
                    {index}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{title}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-300">{body}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[1.35rem] border border-white/10 bg-white/[0.06] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Final CTA</div>
              <div className="mt-2 text-3xl font-black tracking-[-0.05em] text-white">Ready to step into a room?</div>
              <div className="mt-2 text-sm leading-6 text-slate-300">
                Start with the directory, choose the room that fits your style, and keep the trust layer available when you need it.
              </div>
              <div className="mt-5 flex items-center gap-3">
                <div className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950">Open Rooms</div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white">See trust routes</div>
              </div>
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

function RoulettePreviewTable({
  selected = 17,
  compact = false,
}: {
  selected?: number;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className={compact ? "overflow-x-auto pb-1" : "overflow-x-auto pb-2"}>
        <div className={compact ? "min-w-[760px]" : "min-w-[980px]"}>
          <div
            className={
              compact
                ? "grid grid-cols-[52px_repeat(12,minmax(0,1fr))_52px] gap-1.5"
                : "grid grid-cols-[76px_repeat(12,minmax(0,1fr))_72px] gap-2"
            }
          >
            <div
              className={[
                "row-span-3 flex items-center justify-center border border-emerald-300/20 bg-[linear-gradient(180deg,rgba(12,63,53,0.98),rgba(7,33,28,0.98))] font-black text-white",
                compact ? "rounded-[1rem] text-xl" : "rounded-[1.4rem] text-3xl",
              ].join(" ")}
            >
              0
            </div>
            {ROULETTE_TABLE_ROWS.map((row) => (
              <React.Fragment key={row.column}>
                {row.numbers.map((value) => (
                  <RouletteCell key={value} value={value} selected={value === selected} />
                ))}
                <div
                  className={[
                    "flex items-center justify-center border border-white/10 bg-white/[0.05] font-black text-white",
                    compact ? "rounded-[1rem] text-sm" : "rounded-[1.2rem] text-base",
                  ].join(" ")}
                >
                  2:1
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className={compact ? "grid grid-cols-3 gap-1.5" : "grid grid-cols-3 gap-2"}>
        {["1 to 12", "13 to 24", "25 to 36"].map((title) => (
          <div
            key={title}
            className={[
              "rounded-[1.1rem] border border-white/10 bg-[#081126] text-center font-semibold text-white",
              compact ? "px-3 py-2 text-[11px]" : "px-4 py-3 text-sm",
            ].join(" ")}
          >
            {title}
          </div>
        ))}
      </div>

      <div className={compact ? "grid grid-cols-6 gap-1.5" : "grid grid-cols-6 gap-2"}>
        {["1 to 18", "Even", "Red", "Black", "Odd", "19 to 36"].map((title) => (
          <div
            key={title}
            className={[
              "rounded-[1.1rem] border border-white/10 text-center font-semibold text-white",
              title === "Red"
                ? "bg-[linear-gradient(180deg,rgba(111,18,49,0.95),rgba(73,12,31,0.98))]"
                : title === "Black"
                  ? "bg-[linear-gradient(180deg,rgba(9,16,34,0.95),rgba(5,10,23,0.98))]"
                  : "bg-[#081126]",
              compact ? "px-2 py-2 text-[11px]" : "px-4 py-3 text-sm",
            ].join(" ")}
          >
            {title}
          </div>
        ))}
      </div>
    </div>
  );
}

function RouletteWheelBand({ selected = 17 }: { selected?: number }) {
  const selectedIndex = Math.max(0, ROULETTE_WHEEL_ORDER.indexOf(selected));
  const visible = Array.from({ length: 11 }, (_value, offset) => {
    const index = (selectedIndex - 5 + offset + ROULETTE_WHEEL_ORDER.length) % ROULETTE_WHEEL_ORDER.length;
    return {
      offset: offset - 5,
      value: ROULETTE_WHEEL_ORDER[index] ?? 0,
    };
  });

  return (
    <div className="flex items-start gap-1">
      {visible.map(({ offset, value }) => {
        const isSelected = value === selected;
        const isRed = RED_NUMBERS.has(value);
        const background =
          value === 0
            ? "linear-gradient(180deg,rgba(26,132,98,0.96),rgba(10,54,43,0.98))"
            : isRed
              ? "linear-gradient(180deg,rgba(160,33,74,0.98),rgba(95,16,41,0.98))"
              : "linear-gradient(180deg,rgba(15,20,42,0.98),rgba(8,11,25,0.98))";

        return (
          <div
            key={`${value}-${offset}`}
            className={[
              "flex h-11 w-8 items-center justify-center rounded-[0.95rem] border text-[11px] font-black text-white shadow-[0_10px_24px_rgba(5,10,20,0.28)]",
              isSelected ? "border-amber-300/70 ring-2 ring-amber-300/35" : "border-white/10",
            ].join(" ")}
            style={{
              background,
              transform: `translateY(${Math.abs(offset) * 5}px)`,
            }}
          >
            {value}
          </div>
        );
      })}
    </div>
  );
}

function RouletteV2Artboard() {
  return (
    <div className="min-h-[980px] bg-[radial-gradient(circle_at_top,rgba(255,90,125,0.16),transparent_20%),linear-gradient(180deg,#050816_0%,#03060f_100%)] px-8 py-8">
      <div className="rounded-[1.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,29,0.98),rgba(8,11,22,0.98))] px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <ArbiGameFiBrand compact subtitle="Wallet-native game rooms" />
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white">All Games</div>
            <div className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-950">Connect wallet</div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
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

      <div className="mt-4 flex items-center justify-between rounded-[1.2rem] border border-white/10 bg-white/[0.04] px-4 py-2.5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Roulette</div>
          <div className="mt-0.5 text-base font-black text-white">European flagship table</div>
        </div>
        <div className="flex gap-2">
          <Badge>Quiet room</Badge>
          <Badge tone="accent">Settlement readable</Badge>
        </div>
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[248px_minmax(0,1fr)]">
        <div className="rounded-[1.7rem] border border-white/8 bg-[linear-gradient(180deg,rgba(10,14,28,0.96),rgba(6,10,21,0.98))] p-3.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Ticket rail</div>
              <div className="mt-1 text-[15px] font-black text-white">Build the ticket</div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-200">
              Wallet-native
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-full bg-white px-3 py-2 text-center text-[11px] font-semibold text-slate-950">Manual</div>
            <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-[11px] font-semibold text-slate-400">Auto</div>
          </div>

          <div className="mt-3 rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Stake amount</div>
            <div className="mt-2 flex items-center gap-3 rounded-[0.95rem] border border-white/10 bg-[#0b1426] px-3.5 py-2.5">
              <div className="text-[22px] font-black text-white">0.10</div>
              <div className="ml-auto rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-white">USDC</div>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {["0.10", "0.50", "1.00", "5.00"].map((chip) => (
                <div key={chip} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1.5 text-center text-[10px] font-semibold text-white">
                  {chip}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Rounds</div>
                <div className="mt-1 text-[11px] font-semibold text-white">How many spins to cover</div>
              </div>
              <div className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold text-white">1</div>
            </div>
            <div className="mt-2.5 h-2 rounded-full bg-white/10">
              <div className="h-2 w-[12%] rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400" />
            </div>
          </div>

          <div className="mt-3 rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Ticket</div>
              <div className="rounded-full border border-white/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                Review
              </div>
            </div>
            <div className="mt-2.5 space-y-2 text-[11px] text-slate-300">
              <div className="flex items-center justify-between"><span>Bet</span><span className="font-semibold text-white">Straight 17</span></div>
              <div className="flex items-center justify-between"><span>Stake</span><span className="font-semibold text-white">0.10 USDC</span></div>
              <div className="flex items-center justify-between"><span>Wallet</span><span className="font-semibold text-white">Disconnected</span></div>
            </div>
            <div className="mt-2 text-[10px] leading-5 text-slate-500">Quote and receipt open when the ticket is ready.</div>
          </div>

          <div className="mt-3 rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950">Connect wallet</div>
        </div>

        <div className="rounded-[1.8rem] border border-fuchsia-400/20 bg-[radial-gradient(circle_at_top,rgba(255,90,125,0.18),transparent_24%),linear-gradient(180deg,rgba(42,13,42,0.98),rgba(7,12,24,0.98))] p-5">
          <div className="rounded-[1.35rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,196,125,0.16),transparent_28%),linear-gradient(180deg,rgba(15,14,34,0.9),rgba(9,11,25,0.94))] px-4 py-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_284px]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge>European roulette</Badge>
                    <Badge tone="accent">Straight 17</Badge>
                  </div>
                  <div className="mt-3 flex items-end gap-3">
                    <div className="flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-amber-300/35 bg-[radial-gradient(circle_at_top,rgba(255,214,116,0.28),transparent_34%),linear-gradient(180deg,rgba(114,30,62,0.95),rgba(40,14,30,0.98))] text-[42px] font-black tracking-[-0.06em] text-white shadow-[0_20px_40px_rgba(255,90,125,0.18)]">
                      17
                    </div>
                    <div className="pb-1">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">Live selection</div>
                      <div className="mt-2 max-w-[21rem] text-sm leading-6 text-slate-300">
                        Board-first room with a quieter ticket rail and a stronger live-wheel cue above the table.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white">Clear</div>
              </div>

              <div className="rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Live wheel</div>
                  <div className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100">
                    Now
                  </div>
                </div>
                <div className="mt-3">
                  <RouletteWheelBand selected={17} />
                </div>
                <div className="mt-3 flex items-center justify-between rounded-[0.95rem] border border-white/10 bg-white/[0.03] px-3 py-2">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Last call</div>
                    <div className="mt-1 text-sm font-semibold text-white">Straight 17</div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-200">
                    Board-first
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="max-w-[42rem] text-sm text-slate-300">
              Pick the board first. Standard dozens, 2:1 columns, and outside calls stay locked to the table instead of floating away from it.
            </div>
            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200">
              Board-first
            </div>
          </div>

          <div className="mt-4">
            <RoulettePreviewTable selected={17} />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              ["Zero rail", "0 sits apart from the main number field."],
              ["3 x 12 board", "Rows read like a standard European table."],
              ["Outside calls", "Dozens and parity stay visually attached to the board."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</div>
                <div className="mt-2 text-xs leading-5 text-slate-300">{body}</div>
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
