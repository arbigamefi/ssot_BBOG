import { GlassCard, AuditTabs, AuditTableHeader, AuditTableRow, AuditTableCell } from "@ssot/ui";
import Link from "next/link";
import { UserCircleIcon, WalletIcon, SparklesIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { PrototypeHeader } from "../components/PrototypeHeader";

export default function ClaimsPrototype() {
  return (
    <div className="min-h-screen bg-[#050505] font-sans text-white selection:bg-amber-500/30">
      <PrototypeHeader activeRoute="claims" />

      <main className="mx-auto max-w-[1440px] px-6 py-12 md:py-16">
        <div className="mb-12 max-w-3xl">
          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">Claims & Rewards</h1>
          <p className="text-lg leading-relaxed text-white/50">
            A dedicated route for XP accrual, protocol fee claims, and holdback sync actions.
            This page should feel like a reward terminal, not a generic admin screen.
          </p>
        </div>

        <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="flex flex-col justify-center rounded-[2rem] border-2 border-amber-500/20 bg-gradient-to-br from-[#1a1005] to-[#050505] p-8 shadow-[inset_0_0_40px_rgba(245,158,11,0.05),0_10px_40px_rgba(0,0,0,0.5)] group relative overflow-hidden transition-colors hover:border-amber-500/40">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-500/10 blur-[50px] transition-all group-hover:bg-amber-500/20" />
            <span className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-500/50">
               <div className="h-1.5 w-1.5 rounded-sm bg-amber-500/50" /> Claimable XP
            </span>
            <span className="mb-1 text-3xl font-mono font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-amber-200 drop-shadow-[0_0_15px_rgba(245,158,11,0.3)] md:text-4xl">18,420.00</span>
            <span className="text-xs font-bold text-amber-400">Ready to exact extract</span>
          </div>

          <div className="flex flex-col justify-center rounded-[2rem] border border-white/5 bg-[#0a0a0a] p-8 shadow-[inset_0_0_40px_rgba(255,255,255,0.02),0_10px_40px_rgba(0,0,0,0.5)] group relative overflow-hidden transition-colors hover:border-blue-500/30">
            <div className="absolute right-4 top-4 opacity-10 group-hover:text-blue-500 transition-colors">
              <ShieldCheckIcon className="h-12 w-12" />
            </div>
            <span className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">Synced Holdback</span>
            <span className="mb-1 text-3xl font-mono font-bold text-white transition-all group-hover:text-shadow-[0_0_20px_rgba(255,255,255,0.3)] md:text-4xl">240.50 XP</span>
            <span className="text-xs text-white/40">Pending holdback buffer sweep</span>
          </div>

          <div className="flex flex-col justify-center rounded-[2rem] border border-white/5 bg-[#0a0a0a] p-8 shadow-[inset_0_0_40px_rgba(255,255,255,0.02),0_10px_40px_rgba(0,0,0,0.5)] group relative overflow-hidden transition-colors hover:border-green-500/30">
            <span className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">Protocol Fees</span>
            <span className="mb-1 text-3xl font-mono font-bold text-green-400 transition-all group-hover:text-shadow-[0_0_20px_rgba(34,197,94,0.3)] md:text-4xl">512.20 USDC</span>
            <span className="text-xs text-white/40">Governance-side claim surface</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Core Interaction Terminal */}
          <div className="rounded-[2.5rem] border border-white/5 bg-gradient-to-br from-[#0a0a0a] to-[#040404] p-8 shadow-[inset_0_2px_40px_rgba(0,0,0,0.8),0_10px_40px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay pointer-events-none" />
            <div className="absolute -top-40 -left-40 h-[400px] w-[400px] rounded-full bg-amber-500/10 blur-[100px] pointer-events-none" />
            
            <div className="mb-10 flex items-start justify-between gap-4 relative z-10">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-amber-500/50 flex items-center gap-2">
                   <div className="h-2 w-2 rounded-sm bg-amber-500 animate-pulse" /> Primary Extraction Action
                </div>
                <h2 className="mt-2 text-3xl font-bold drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">Claim Accrued XP</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/50">
                  Execute smart contract interaction to extract earned Experience Points from protocol liabilities directly to your linked wallet.
                </p>
              </div>
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                <SparklesIcon className="h-8 w-8" />
              </div>
            </div>

            <div className="grid gap-10 md:grid-cols-[1fr_minmax(300px,0.8fr)] relative z-10 flex-1">
              {/* Terminal Form */}
              <div className="flex flex-col gap-6 w-full">
                
                {/* 3D Holographic Core Context */}
                <div className="w-full h-[180px] rounded-2xl border border-white/5 bg-[#050505] shadow-inner mb-2 relative flex items-center justify-center overflow-hidden perspective-[800px]">
                   <div className="absolute inset-0 bg-gradient-to-b from-transparent to-amber-900/10 opacity-50" />
                   {/* 3D Visual */}
                   <div className="relative w-32 h-32 flex items-center justify-center animate-[spin_15s_linear_infinite]" style={{ transformStyle: 'preserve-3d' }}>
                      <div className="absolute inset-0 border-[4px] border-amber-500/30 rounded-full" style={{ transform: 'rotateX(75deg)' }} />
                      <div className="absolute inset-0 border-[4px] border-amber-400/20 rounded-full" style={{ transform: 'rotateY(75deg)' }} />
                      <div className="absolute w-16 h-16 bg-amber-500 rounded-full blur-[10px] opacity-30 animate-pulse" />
                      <div className="w-12 h-12 bg-gradient-to-br from-amber-300 to-amber-600 rounded-lg shadow-[0_0_30px_rgba(245,158,11,0.8)]" style={{ transform: 'rotateX(45deg) rotateY(45deg)' }} />
                   </div>
                   {/* Overlay Text */}
                   <div className="absolute bottom-4 right-4 text-xs font-mono font-bold text-amber-500/70 tracking-widest text-shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                      CORE: STABLE
                   </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#000] p-6 shadow-inner group transition-colors focus-within:border-amber-500/40">
                  <div className="flex items-center justify-between text-[10px] uppercase font-bold text-white/40 mb-3">
                    <span>Extraction Amount</span>
                    <span className="text-amber-500/70">Max: 18,420.00 XP</span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      defaultValue="1,200.00"
                      className="w-full bg-transparent font-mono text-4xl text-white focus:outline-none tracking-tight group-focus-within:text-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                    />
                    <div className="absolute right-0 flex items-center gap-3">
                      <button className="rounded px-2 py-1 text-[10px] font-bold text-white/40 border border-white/10 transition-colors hover:bg-white/10 hover:text-white shadow">
                        MAX
                      </button>
                      <span className="text-xl font-bold text-amber-500/30">XP</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-6 mt-auto">
                  <div className="flex justify-between items-center text-xs mb-3">
                    <span className="text-amber-500/50 font-bold uppercase tracking-wider">Settlement Path</span>
                    <span className="font-mono font-bold text-amber-400 drop-shadow-[0_0_5px_rgba(245,158,11,0.4)]">Preflight → Wallet</span>
                  </div>
                  <div className="text-[11px] text-white/30 leading-relaxed font-mono">
                    <span className="text-emerald-500 mr-2">✓</span> Validating Merkle Proof...<br />
                    <span className="text-emerald-500 mr-2">✓</span> Confirming Bank Liability state.<br />
                    Claims instantly sweep un-minted XP from protocol reserves directly into your active externally owned account.
                  </div>
                </div>
              </div>

              {/* Tactical Readout Side */}
              <div className="flex flex-col gap-6">
                <div className="rounded-[2rem] border border-white/5 bg-[#050505] p-6 flex-1 shadow-inner flex flex-col justify-center relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 to-transparent pointer-events-none" />
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-6">Extraction Dossier</div>
                  <div className="space-y-4 text-sm font-mono">
                    <div className="flex items-center justify-between pb-4 border-b border-white/5">
                      <span className="text-white/40">Request Type</span>
                      <span className="font-bold text-white">XP Withdrawal</span>
                    </div>
                    <div className="flex items-center justify-between pb-4 border-b border-white/5">
                      <span className="text-white/40">Withdrawal Amount</span>
                      <span className="font-bold text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]">1,200.00 XP</span>
                    </div>
                    <div className="flex items-center justify-between pb-4 border-b border-white/5">
                      <span className="text-white/40">Network Gas</span>
                      <span className="text-white/60">~0.00045 ETH</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/40">Contract Verifier</span>
                      <span className="font-bold text-emerald-400">PASSED</span>
                    </div>
                  </div>
                </div>

                <button className="w-full rounded-[1.5rem] bg-amber-500 py-5 font-bold text-black shadow-[0_0_24px_rgba(245,158,11,0.3)] transition-all active:scale-[0.98] hover:bg-amber-400 hover:shadow-[0_0_35px_rgba(245,158,11,0.5)] flex justify-center items-center gap-2 text-lg">
                  Initiate Extraction <span className="animate-pulse">_</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-[2rem] border border-blue-500/20 bg-[#0a0a0a] p-8 shadow-[inset_0_0_30px_rgba(59,130,246,0.02),0_10px_30px_rgba(0,0,0,0.5)] hover:border-blue-500/40 transition-colors group">
              <div className="flex items-start justify-between gap-4 mb-8">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-blue-400/50 mb-2">Secondary System Action</div>
                  <h3 className="text-2xl font-bold drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">Sync Holdback</h3>
                  <p className="mt-2 text-xs leading-6 text-white/40 max-w-[250px]">
                    Resolve the delta buffer between in-flight game logic and actual realized player XP.
                  </p>
                </div>
                <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-mono font-bold text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                  240.50 XP
                </div>
              </div>

              <button className="w-full rounded-[1rem] border border-blue-500/30 bg-blue-500/10 py-4 font-bold text-blue-300 transition-all hover:bg-blue-500/20 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] shadow-[inset_0_2px_10px_rgba(255,255,255,0.1)]">
                Sync Network State
              </button>
            </div>

            <div className="rounded-[2rem] border border-green-500/20 bg-[#0a0a0a] p-8 shadow-[inset_0_0_30px_rgba(34,197,94,0.02),0_10px_30px_rgba(0,0,0,0.5)] hover:border-green-500/40 transition-colors group flex-1 flex flex-col justify-between">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-green-400/50 mb-2 mt-1 flex items-center gap-2 px-3 py-1 bg-green-500/10 rounded-full border border-green-500/20 max-w-max"> <ShieldCheckIcon className="w-3 h-3"/> Governance Only</div>
                  <h3 className="text-2xl font-bold drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">Sweep Protocol Fees</h3>
                  <p className="mt-2 text-xs leading-6 text-white/40 max-w-[250px]">
                    Root authority routine to capture global system margin and redirect to governance vaults.
                  </p>
                </div>
              </div>

              <div>
                 <div className="flex justify-between items-center mb-6">
                    <span className="text-sm text-white/30 font-bold uppercase tracking-widest">Available Margin</span>
                    <span className="font-mono text-xl text-green-400 font-bold drop-shadow-[0_0_10px_rgba(34,197,94,0.3)]">512.20 USDC</span>
                 </div>
                 <button className="w-full rounded-[1rem] border border-green-500/30 bg-green-500/10 py-4 font-bold text-green-400 transition-all hover:bg-green-500/20 hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] shadow-[inset_0_2px_10px_rgba(255,255,255,0.1)] opacity-50 cursor-not-allowed">
                   Extract Margin
                 </button>
                 <div className="text-center mt-3 text-[10px] uppercase font-bold text-white/20 tracking-widest">Requires Multisig Authority</div>
              </div>
            </div>
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
