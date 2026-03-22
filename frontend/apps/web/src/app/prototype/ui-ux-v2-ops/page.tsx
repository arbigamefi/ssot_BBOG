import { GlassCard, AuditTabs, AuditTableHeader, AuditTableRow, AuditTableCell } from "@ssot/ui";
import Link from "next/link";
import { UserCircleIcon, WalletIcon, ServerStackIcon, ShieldCheckIcon, CubeTransparentIcon } from "@heroicons/react/24/outline";
import { PrototypeHeader } from "../components/PrototypeHeader";

export default function OpsPrototype() {
  return (
    <div className="min-h-screen bg-[#050505] font-sans text-white selection:bg-cyan-500/30">
      <PrototypeHeader activeRoute="ops" />

      <main className="mx-auto max-w-[1440px] px-6 py-12 md:py-16">
        <div className="mb-12 max-w-3xl">
          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">Ops & Release Proof</h1>
          <p className="text-lg leading-relaxed text-white/50">
            A trust-facing control surface for indexer health, release identity, and room-operational proof.
            This route should feel institutional and precise, not like a player dashboard.
          </p>
        </div>

        <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="rounded-2xl border border-white/5 bg-[#0a0a0a] p-6">
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Release digest</div>
            <div className="mt-3 font-mono text-xl font-bold text-cyan-300">0x6b3a...9f21</div>
            <div className="mt-2 text-sm text-white/40">Canonical bundle in use</div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-[#0a0a0a] p-6">
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Indexer lag</div>
            <div className="mt-3 text-3xl font-mono font-bold text-green-400">2 blocks</div>
            <div className="mt-2 text-sm text-white/40">Healthy within confirmation window</div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-[#0a0a0a] p-6">
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Safe head</div>
            <div className="mt-3 text-3xl font-mono font-bold">18,230,411</div>
            <div className="mt-2 text-sm text-white/40">Worker-confirmed event horizon</div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-[#0a0a0a] p-6">
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Worker state</div>
            <div className="mt-3 text-3xl font-bold text-cyan-300">Running</div>
            <div className="mt-2 text-sm text-white/40">Polling every 5 seconds</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <GlassCard glowColor="bg-cyan-500/20" glowPosition="top-left" padding="xl">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Release proof</div>
                <h2 className="mt-2 text-2xl font-bold">Canonical release bundle</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/50">
                  This panel should give operators and LPs a clean answer to one question:
                  what exact release, chain, and contract surface is this frontend currently presenting?
                </p>
              </div>
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-cyan-300">
                <CubeTransparentIcon className="h-5 w-5" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["Chain", "Base Sepolia"],
                ["Release digest", "0x6b3a2f...9f21"],
                ["Hub", "0x8494...3c21"],
                ["VRF Hub", "0x31ab...dd02"],
                ["Bank", "0x10fe...92a0"],
                ["Frontend manifest", "release-latest.json"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/8 bg-[#050505] p-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">{label}</div>
                  <div className="mt-3 font-mono text-sm text-white">{value}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-white/8 bg-black/25 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Operator actions</div>
                  <div className="mt-2 text-sm leading-6 text-white/50">
                    Keep emergency controls separated from player surfaces. This block should stay compact and explicit.
                  </div>
                </div>
                <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                  Healthy
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-cyan-400">
                  Refresh status
                </button>
                <button className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10">
                  Sync indexer
                </button>
                <button className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10">
                  Open release pack
                </button>
              </div>
            </div>
          </GlassCard>

          <div className="flex flex-col gap-6">
            <GlassCard padding="lg">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Indexer health</div>
                  <h3 className="mt-2 text-xl font-bold">Worker pulse</h3>
                </div>
                <div className="rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-bold text-green-400">
                  98%
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {[
                  ["Confirmations", "12 blocks"],
                  ["Rewind window", "128 blocks"],
                  ["Batch size", "200 events"],
                  ["Poll interval", "5 seconds"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-white/50">{label}</span>
                    <span className="font-mono text-white">{value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-emerald-300" style={{ width: "82%" }} />
              </div>
            </GlassCard>

            <GlassCard padding="lg">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Operational focus</div>
                  <h3 className="mt-2 text-xl font-bold">Risk surface</h3>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/60">
                  <ServerStackIcon className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {[
                  ["Room routes", "Healthy", "Player entry routes rendering correctly"],
                  ["Indexer queue", "Catching up", "Lag remains within confirmation safety"],
                  ["Release identity", "Locked", "Digest matches embedded release bundle"],
                ].map(([title, status, copy]) => (
                  <div key={title} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">{title}</div>
                      <div className="text-xs font-bold uppercase tracking-widest text-cyan-300">{status}</div>
                    </div>
                    <div className="mt-2 text-sm leading-6 text-white/50">{copy}</div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>

        <div className="mt-12">
          <div className="mb-6 flex items-end justify-between">
            <h3 className="text-xl font-bold tracking-tight">Worker event trail</h3>
            <span className="text-xs uppercase tracking-widest text-white/35">Recent operational receipts</span>
          </div>

          <AuditTabs activeColorClass="border-cyan-400 text-cyan-400">
            <AuditTableHeader>
              <div className="grid grid-cols-[1.2fr_1.2fr_1fr_1fr_90px] text-[10px] font-bold uppercase tracking-wider text-white/40">
                <div>Time / Block</div>
                <div>Event</div>
                <div>Status</div>
                <div>Context</div>
                <div className="text-right">Chain</div>
              </div>
            </AuditTableHeader>

            {[
              { time: "1 min ago", block: "18,230,411", event: "Indexer sweep", status: "Completed", ctx: "200 events" },
              { time: "6 mins ago", block: "18,230,322", event: "Release refresh", status: "Completed", ctx: "Digest match" },
              { time: "19 mins ago", block: "18,230,118", event: "Safe head advance", status: "Completed", ctx: "Lag 2 blocks" },
            ].map((row) => (
              <AuditTableRow key={`${row.time}-${row.event}`}>
                <div className="grid grid-cols-[1.2fr_1.2fr_1fr_1fr_90px] items-center">
                  <AuditTableCell>
                    <div className="flex flex-col gap-1">
                      <span className="text-white">{row.time}</span>
                      <span className="text-xs font-mono text-white/30">Block {row.block}</span>
                    </div>
                  </AuditTableCell>
                  <AuditTableCell>{row.event}</AuditTableCell>
                  <AuditTableCell>
                    <span className="rounded-md border border-green-500/20 bg-green-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-green-400">
                      {row.status}
                    </span>
                  </AuditTableCell>
                  <AuditTableCell>
                    <span className="font-mono text-sm text-white/60">{row.ctx}</span>
                  </AuditTableCell>
                  <AuditTableCell className="justify-end text-white/30">↗</AuditTableCell>
                </div>
              </AuditTableRow>
            ))}
          </AuditTabs>
        </div>
      </main>
    </div>
  );
}
