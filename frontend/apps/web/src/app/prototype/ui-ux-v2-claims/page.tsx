import { ShellHeader, ShellHeaderBrand, ShellHeaderNav, ShellHeaderActions } from "@ssot/ui";
import { GlassCard, AuditTabs, AuditTableHeader, AuditTableRow, AuditTableCell } from "@ssot/ui";
import Link from "next/link";
import { UserCircleIcon, WalletIcon, SparklesIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

export default function ClaimsPrototype() {
  return (
    <div className="min-h-screen bg-[#050505] font-sans text-white selection:bg-amber-500/30">
      <ShellHeader variant="solid">
        <div className="flex items-center gap-12">
          <ShellHeaderBrand name="ArbiGameFi" />
          <ShellHeaderNav>
            <Link href="/prototype/ui-ux-v2-directory" className="hover:text-white transition-colors">
              Games
            </Link>
            <Link href="/prototype/ui-ux-v2-bets" className="hover:text-white transition-colors">
              Bets
            </Link>
            <Link href="/prototype/ui-ux-v2-liquidity" className="hover:text-white transition-colors">
              Liquidity
            </Link>
            <Link href="/prototype/ui-ux-v2-claims" className="text-white hover:text-white transition-colors border-b-2 border-white pb-1">
              Claims
            </Link>
            <Link href="/prototype/ui-ux-v2-referral" className="hover:text-white transition-colors">
              Affiliates
            </Link>
            <Link href="/prototype/ui-ux-v2-account" className="hover:text-white transition-colors">
              Account
            </Link>
            <Link href="/prototype/ui-ux-v2-ops" className="hover:text-white transition-colors">
              Ops
            </Link>
          </ShellHeaderNav>
        </div>
        <ShellHeaderActions>
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-mono text-white/60">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Arbitrum
          </div>
          <button className="hidden sm:flex items-center justify-center rounded-full p-2 transition-colors hover:bg-white/10">
            <UserCircleIcon className="h-5 w-5 text-white/70" />
          </button>
          <button className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white transition-transform active:scale-95 hover:bg-white/20">
            <WalletIcon className="h-4 w-4" />
            <span>0x12...34af</span>
          </button>
        </ShellHeaderActions>
      </ShellHeader>

      <main className="mx-auto max-w-[1440px] px-6 py-12 md:py-16">
        <div className="mb-12 max-w-3xl">
          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">Claims & Rewards</h1>
          <p className="text-lg leading-relaxed text-white/50">
            A dedicated route for XP accrual, protocol fee claims, and holdback sync actions.
            This page should feel like a reward terminal, not a generic admin screen.
          </p>
        </div>

        <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-[#0a0a0a] p-6">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Claimable XP</span>
            <span className="font-mono text-3xl font-bold text-amber-300">18,420.00 XP</span>
            <span className="text-sm text-amber-400">Ready to claim now</span>
          </div>
          <div className="relative flex flex-col gap-2 overflow-hidden rounded-2xl border border-white/5 bg-[#0a0a0a] p-6">
            <div className="absolute right-4 top-4 opacity-10">
              <ShieldCheckIcon className="h-10 w-10" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Synced Holdback</span>
            <span className="font-mono text-3xl font-bold">240.50 XP</span>
            <span className="text-sm text-white/40">Pending holdback buffer to sweep into user balance</span>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-[#0a0a0a] p-6">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Protocol Fees</span>
            <span className="font-mono text-3xl font-bold text-green-400">512.20 USDC</span>
            <span className="text-sm text-white/40">Governance-side claim surface</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <GlassCard glowColor="bg-amber-500/20" glowPosition="top-left" padding="xl">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Primary terminal</div>
                <h2 className="mt-2 text-2xl font-bold">Claim XP</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/50">
                  The main player action on this page. The route should make it obvious what can
                  be claimed, what still sits in holdback, and what requires governance authority.
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-300">
                <SparklesIcon className="h-5 w-5" />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
              <div className="space-y-5">
                <div className="rounded-2xl border border-white/8 bg-[#050505] p-5">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>Claim amount</span>
                    <span>Available: 18,420.00 XP</span>
                  </div>
                  <div className="relative mt-3">
                    <input
                      type="text"
                      defaultValue="1200.00"
                      className="w-full rounded-xl border border-white/10 bg-[#0b0b0b] px-4 py-4 font-mono text-2xl text-white focus:border-amber-400/50 focus:outline-none"
                    />
                    <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                      <button className="rounded bg-white/5 px-2 py-1 text-[10px] font-bold text-white/60 transition-colors hover:bg-white/10">
                        MAX
                      </button>
                      <span className="text-sm font-bold text-white/50">XP</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-500/10 bg-amber-500/5 p-5">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Settlement path</span>
                    <span className="font-mono font-bold text-white">Preflight → Wallet → Receipt</span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-white/40">
                    <div>Claims move accrued XP from Bank liabilities into the connected wallet.</div>
                    <div>Holdback sync stays separate and should remain clearly secondary.</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-white/8 bg-black/30 p-5">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Ticket summary</div>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-white/50">Claim route</span>
                      <span className="font-semibold text-white">XP accrued</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/50">Expected transfer</span>
                      <span className="font-mono font-bold text-amber-300">1,200.00 XP</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/50">Wallet state</span>
                      <span className="font-semibold text-white">Connected</span>
                    </div>
                  </div>
                </div>

                <button className="mt-auto w-full rounded-xl bg-amber-500 py-4 font-bold text-black shadow-[0_0_24px_rgba(245,158,11,0.25)] transition-all active:scale-[0.98] hover:bg-amber-400">
                  Claim XP Now
                </button>

                <p className="text-center text-[10px] text-white/30">
                  This route should clearly separate player claims from governance-only sweeps.
                </p>
              </div>
            </div>
          </GlassCard>

          <div className="flex flex-col gap-6">
            <GlassCard padding="lg" className="border-blue-500/15">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Secondary action</div>
                  <h3 className="mt-2 text-xl font-bold">Sync Holdback</h3>
                  <p className="mt-2 text-sm leading-6 text-white/50">
                    A compact operational action that should feel smaller than the main claim CTA.
                  </p>
                </div>
                <div className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-300">
                  240.50 XP
                </div>
              </div>

              <button className="mt-6 w-full rounded-xl border border-blue-500/20 bg-blue-500/10 py-3 font-bold text-blue-300 transition-colors hover:bg-blue-500/15">
                Sync Holdback
              </button>
            </GlassCard>

            <GlassCard padding="lg" className="border-green-500/15">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Governance route</div>
                  <h3 className="mt-2 text-xl font-bold">Claim Protocol Fees</h3>
                  <p className="mt-2 text-sm leading-6 text-white/50">
                    Governance-facing fee sweep. The visual language should indicate stronger authority and less player relevance.
                  </p>
                </div>
                <div className="rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-bold text-green-300">
                  512.20 USDC
                </div>
              </div>

              <button className="mt-6 w-full rounded-xl border border-green-500/20 bg-green-500/10 py-3 font-bold text-green-300 transition-colors hover:bg-green-500/15">
                Sweep Fees
              </button>
            </GlassCard>
          </div>
        </div>

        <div className="mt-12">
          <div className="mb-6 flex items-end justify-between">
            <h3 className="text-xl font-bold tracking-tight">Claim journal</h3>
            <span className="text-xs uppercase tracking-widest text-white/35">Recent reward actions</span>
          </div>

          <AuditTabs activeColorClass="border-amber-400 text-amber-400">
            <AuditTableHeader>
              <div className="grid grid-cols-[1.2fr_1.4fr_1fr_1fr_90px] text-[10px] font-bold uppercase tracking-wider text-white/40">
                <div>Time / Hash</div>
                <div>Action</div>
                <div>Amount</div>
                <div>Status</div>
                <div className="text-right">Chain</div>
              </div>
            </AuditTableHeader>

            {[
              { time: "2 mins ago", hash: "0x21fd...9ab2", action: "Claim XP accrued", amount: "1,200 XP", status: "Confirmed" },
              { time: "39 mins ago", hash: "0x98ac...1310", action: "Sync holdback", amount: "240.50 XP", status: "Confirmed" },
              { time: "4 hours ago", hash: "0x11cf...72d1", action: "Claim protocol fees", amount: "320.00 USDC", status: "Confirmed" },
            ].map((row) => (
              <AuditTableRow key={row.hash}>
                <div className="grid grid-cols-[1.2fr_1.4fr_1fr_1fr_90px] items-center">
                  <AuditTableCell>
                    <div className="flex flex-col gap-1">
                      <span className="text-white">{row.time}</span>
                      <span className="text-xs font-mono text-white/30">{row.hash}</span>
                    </div>
                  </AuditTableCell>
                  <AuditTableCell>{row.action}</AuditTableCell>
                  <AuditTableCell>
                    <span className="font-mono text-white/70">{row.amount}</span>
                  </AuditTableCell>
                  <AuditTableCell>
                    <span className="rounded-md border border-green-500/20 bg-green-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-green-400">
                      {row.status}
                    </span>
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
