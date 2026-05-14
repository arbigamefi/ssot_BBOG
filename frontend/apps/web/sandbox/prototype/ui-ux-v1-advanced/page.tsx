import type { Metadata } from "next";

import { ArbiGameFiMark } from "../../../components/ArbiGameFiBrand";

export const metadata: Metadata = {
  title: "UI UX Prototype v1 Advanced Trust Routes",
  robots: {
    index: false,
    follow: false
  }
};

function PrototypeBadge({
  children,
  tone = "default"
}: {
  children: React.ReactNode;
  tone?: "default" | "accent";
}) {
  const toneClass =
    tone === "accent"
      ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-100"
      : "border-white/12 bg-white/[0.04] text-slate-200";

  return (
    <span
      className={[
        "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
        toneClass
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

function TrustShell({
  section,
  heading,
  body,
  right,
  children
}: {
  section: string;
  heading: string;
  body: string;
  right: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[920px] bg-[radial-gradient(circle_at_top_left,rgba(20,115,255,0.08),transparent_24%),linear-gradient(180deg,#050816_0%,#03060f_100%)] px-8 py-8">
      <div className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,29,0.98),rgba(8,11,22,0.98))] px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ArbiGameFiMark className="h-11 w-11 rounded-[1rem]" />
            <div>
              <div className="text-sm font-black tracking-[0.08em] text-white">ArbiGameFi</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Advanced trust
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PrototypeBadge>Trust</PrototypeBadge>
            <PrototypeBadge tone="accent">{section}</PrototypeBadge>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(11,18,38,0.98),rgba(7,12,24,0.98))] p-6">
          <PrototypeBadge tone="accent">{section}</PrototypeBadge>
          <h1 className="mt-5 text-5xl font-black tracking-[-0.06em] text-white">{heading}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">{body}</p>
          <div className="mt-6">{right}</div>
        </div>

        <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Route intent
          </div>
          <div className="mt-4 space-y-3">
            {[
              [
                "Keep power readable",
                "Governed or advanced actions remain visible without looking like admin tools."
              ],
              [
                "Proof remains compact",
                "Release and observability data stay present in a clear but secondary zone."
              ],
              ["One action per card", "Each advanced action gets its own panel and outcome copy."]
            ].map(([title, desc]) => (
              <div
                key={title}
                className="rounded-[1.2rem] border border-white/8 bg-[#071024] px-4 py-4"
              >
                <div className="text-sm font-semibold text-white">{title}</div>
                <div className="mt-1 text-sm leading-6 text-slate-400">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5">{children}</div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  note,
  tone = "default"
}: {
  label: string;
  value: string;
  note: string;
  tone?: "default" | "accent";
}) {
  const toneClass =
    tone === "accent"
      ? "border-cyan-300/25 bg-[linear-gradient(180deg,rgba(12,26,49,0.95),rgba(6,16,34,0.98))]"
      : "border-white/10 bg-white/[0.04]";

  return (
    <div className={["rounded-[1.2rem] border px-4 py-4", toneClass].join(" ")}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-3xl font-black text-white">{value}</div>
      <div className="mt-2 text-sm leading-6 text-slate-400">{note}</div>
    </div>
  );
}

function ClaimsArtboard() {
  return (
    <TrustShell
      section="Claims"
      heading="Separate XP, holdback, and protocol fees into clean governed actions."
      body="Claims should never feel like a raw bank control panel. The first fold reads bucket meaning, then breaks write actions into self-contained cards with explicit authorization language."
      right={
        <div className="grid grid-cols-3 gap-4">
          <MetricTile
            label="XP accrued"
            value="18,422"
            note="Currently claimable XP balance for the connected wallet."
            tone="accent"
          />
          <MetricTile
            label="Holdback releasable"
            value="2,115"
            note="Amount that can be synced out of holdback right now."
          />
          <MetricTile
            label="Protocol fees"
            value="$42.1k"
            note="Governed claim path, not a general user action."
          />
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              XP bucket view
            </div>
            <div className="mt-4 grid grid-cols-4 gap-4">
              <MetricTile
                label="Accrued"
                value="18,422 XP"
                note="Ready for claim flow."
                tone="accent"
              />
              <MetricTile
                label="Locked"
                value="9,840 XP"
                note="Still waiting on route-defined release."
              />
              <MetricTile label="Holdback" value="3,120 XP" note="Kept aside pending sync." />
              <MetricTile
                label="Releasable"
                value="2,115 XP"
                note="Available for holdback sync right now."
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              [
                "Claim XP",
                "User action",
                "Claims wallet-earned XP with standard stepper and receipt."
              ],
              [
                "Sync holdback",
                "Recovery action",
                "Moves releasable holdback out of the bucket while keeping copy plain."
              ],
              [
                "Claim protocol fees",
                "Governed action",
                "Explicitly marked as authorization-sensitive and potentially unavailable."
              ]
            ].map(([title, tag, desc], index) => (
              <div
                key={title}
                className={[
                  "rounded-[1.5rem] border p-4",
                  index === 0
                    ? "border-cyan-300/25 bg-[linear-gradient(180deg,rgba(11,27,50,0.96),rgba(6,15,33,0.98))]"
                    : "border-white/10 bg-[linear-gradient(180deg,rgba(8,17,36,0.98),rgba(7,12,24,0.98))]"
                ].join(" ")}
              >
                <PrototypeBadge tone={index === 0 ? "accent" : "default"}>{tag}</PrototypeBadge>
                <div className="mt-4 text-xl font-black text-white">{title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-400">{desc}</div>
                <div className="mt-4 rounded-[1rem] border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Amount
                  </div>
                  <div className="mt-2 text-3xl font-black text-white">
                    {index === 0 ? "10,000" : index === 1 ? "2,115" : "5,000"}
                  </div>
                  <div className="mt-1 text-sm text-slate-400">{index === 2 ? "USDC" : "XP"}</div>
                </div>
                <div className="mt-4 rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950">
                  {index === 0
                    ? "Review XP claim"
                    : index === 1
                      ? "Review holdback sync"
                      : "Review governed claim"}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Copy rules
            </div>
            <div className="mt-4 space-y-3">
              {[
                [
                  "No raw bucket jargon",
                  "Use XP meaning and action result before technical names."
                ],
                [
                  "Governed means explicit",
                  "Fee claims must signal authorization limits before interaction."
                ],
                ["Zero is intentional", "Empty buckets still render as valid, not blank states."]
              ].map(([title, desc]) => (
                <div
                  key={title}
                  className="rounded-[1.1rem] border border-white/8 bg-[#071024] px-4 py-4"
                >
                  <div className="text-sm font-semibold text-white">{title}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-400">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </TrustShell>
  );
}

function ReferralArtboard() {
  return (
    <TrustShell
      section="Referral"
      heading="Keep referral binding simple, transparent, and non-blocking."
      body="Referral should read like a lightweight wallet utility, not a campaign dashboard. Current binding, copy-safe addressing, and one clear bind action are enough."
      right={
        <div className="grid grid-cols-3 gap-4">
          <MetricTile
            label="Binding status"
            value="Bound"
            note="Current wallet already has one active referrer."
            tone="accent"
          />
          <MetricTile
            label="Current referrer"
            value="0x7a...2f"
            note="Short display with copy-safe formatting."
          />
          <MetricTile
            label="Gameplay impact"
            value="Passive"
            note="Referral never blocks a user from entering rooms."
          />
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid grid-cols-[1.15fr_1fr] gap-5">
          <div className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,17,36,0.98),rgba(7,12,24,0.98))] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Current binding
            </div>
            <div className="mt-4 rounded-[1.3rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="text-sm font-semibold text-white">Referrer of this wallet</div>
              <div className="mt-3 flex items-center justify-between rounded-[1rem] border border-white/10 bg-black/20 px-4 py-4">
                <div>
                  <div className="text-2xl font-black text-white">0x7aF3...912f</div>
                  <div className="mt-1 text-sm text-slate-400">
                    Bound on first room entry. Immutable after confirmation.
                  </div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white">
                  Copy
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-[1.3rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="text-sm font-semibold text-white">How this route behaves</div>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Binding affects room access?</span>
                  <span className="font-semibold text-white">No</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Can user still play without binding?</span>
                  <span className="font-semibold text-white">Yes</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Does UI hide unbound state?</span>
                  <span className="font-semibold text-white">No</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-cyan-300/25 bg-[linear-gradient(180deg,rgba(11,27,50,0.96),rgba(6,15,33,0.98))] p-5">
            <PrototypeBadge tone="accent">Bind referrer</PrototypeBadge>
            <div className="mt-4 text-xl font-black text-white">Bind a referral address</div>
            <div className="mt-2 text-sm leading-6 text-slate-300">
              Single write flow with short address formatting, validation, and a copy-safe review
              state.
            </div>
            <div className="mt-4 rounded-[1rem] border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Address
              </div>
              <div className="mt-2 text-base text-white">0x0E25...4d19</div>
            </div>
            <div className="mt-4 rounded-[1rem] border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-sm font-semibold text-white">Preflight</div>
              <div className="mt-2 text-sm leading-6 text-slate-400">
                Checks connection, chain, read-only mode, and whether the wallet is already bound.
              </div>
            </div>
            <div className="mt-4 rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950">
              Review bind request
            </div>
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Design rules
          </div>
          <div className="mt-4 space-y-3">
            {[
              [
                "No affiliate dashboard styling",
                "Do not inflate this route into a growth console."
              ],
              [
                "Addresses stay human",
                "Always shorten and pair with copy action, never dump raw text."
              ],
              ["Binding state is explicit", "If immutable, the route should say that plainly."]
            ].map(([title, desc]) => (
              <div
                key={title}
                className="rounded-[1.1rem] border border-white/8 bg-[#071024] px-4 py-4"
              >
                <div className="text-sm font-semibold text-white">{title}</div>
                <div className="mt-1 text-sm leading-6 text-slate-400">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </TrustShell>
  );
}

function OpsArtboard() {
  return (
    <TrustShell
      section="Ops"
      heading="Expose release proof and indexer health without building an admin console."
      body="Ops remains read-only. It should reassure advanced users and collaborators that the release is healthy, current, and verifiable, without dragging standard players into a diagnostics mindset."
      right={
        <div className="grid grid-cols-3 gap-4">
          <MetricTile
            label="Indexer lag"
            value="2 blocks"
            note="Fast enough to read the room state as current."
            tone="accent"
          />
          <MetricTile
            label="Confirmations"
            value="18"
            note="Latest safe head used for status framing."
          />
          <MetricTile label="VRF backlog" value="0" note="No visible randomness queue pressure." />
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Release proof
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <MetricTile
                label="Release digest"
                value="0x8c7...22f"
                note="Canonical digest for the currently embedded release."
                tone="accent"
              />
              <MetricTile
                label="Chain / mode"
                value="84532"
                note="Base Sepolia canonical release."
              />
            </div>
            <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-[#071024] px-4 py-4">
              <div className="text-sm font-semibold text-white">Core addresses</div>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Hub</span>
                  <span className="font-semibold text-white">0x9E...14</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>VRF Hub</span>
                  <span className="font-semibold text-white">0x17...c3</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Referral Registry</span>
                  <span className="font-semibold text-white">0xF2...91</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,17,36,0.98),rgba(7,12,24,0.98))] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Operational readout
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <MetricTile
                label="Latest indexed block"
                value="18,442,118"
                note="Primary event read position."
                tone="accent"
              />
              <MetricTile
                label="Safe head"
                value="18,442,120"
                note="Confirmed head for UI trust framing."
              />
              <MetricTile
                label="Hub native balance"
                value="0.61 ETH"
                note="Visible only when surfaced by the runtime."
              />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Guardrails
            </div>
            <div className="mt-4 space-y-3">
              {[
                ["Read-only only", "No privileged buttons or mutation tools belong here."],
                [
                  "Explain status terms",
                  "Lag and confirmations need human phrasing beside raw numbers."
                ],
                [
                  "Link out to proof",
                  "Explorer and release pack links live here, not in player-first routes."
                ]
              ].map(([title, desc]) => (
                <div
                  key={title}
                  className="rounded-[1.1rem] border border-white/8 bg-[#071024] px-4 py-4"
                >
                  <div className="text-sm font-semibold text-white">{title}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-400">{desc}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm font-semibold text-white">
              Open release pack
            </div>
          </div>
        </div>
      </div>
    </TrustShell>
  );
}

function MobileTrustArtboard() {
  return (
    <div className="min-h-[1080px] bg-[linear-gradient(180deg,#050816_0%,#03060f_100%)] px-5 py-6 text-white">
      <div className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,29,0.98),rgba(8,11,22,0.98))] p-4">
        <div className="flex items-center justify-between">
          <ArbiGameFiMark className="h-11 w-11 rounded-[1rem]" />
          <PrototypeBadge tone="accent">Mobile trust</PrototypeBadge>
        </div>

        <div className="mt-4 rounded-[1.3rem] border border-white/10 bg-white/[0.04] px-4 py-4">
          <div className="text-xl font-black text-white">
            Claim XP without losing the proof trail.
          </div>
          <div className="mt-2 text-sm leading-6 text-slate-400">
            The mobile trust flow compresses interpretation, action, and receipt into one calm
            vertical stack.
          </div>
        </div>

        <div className="mt-4 rounded-[1.4rem] border border-cyan-300/25 bg-[linear-gradient(180deg,rgba(11,27,50,0.96),rgba(6,15,33,0.98))] p-4">
          <div className="flex items-center justify-between">
            <PrototypeBadge tone="accent">Claims</PrototypeBadge>
            <PrototypeBadge>Ready</PrototypeBadge>
          </div>
          <div className="mt-4 text-3xl font-black text-white">18,422 XP</div>
          <div className="mt-2 text-sm text-slate-300">Accrued and currently claimable.</div>
          <div className="mt-4 rounded-[1rem] border border-white/10 bg-black/20 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Amount
            </div>
            <div className="mt-2 text-2xl font-black text-white">10,000 XP</div>
          </div>
          <div className="mt-4 rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950">
            Review claim
          </div>
        </div>

        <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Receipt and proof
          </div>
          <div className="mt-4 space-y-3">
            {[
              ["Chain", "Base Sepolia"],
              ["Release digest", "0x8c7...22f"],
              ["Tx status", "Pending signature"],
              ["Journal binding", "Will be written after receipt"]
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-[0.95rem] border border-white/10 bg-black/20 px-4 py-3 text-sm"
              >
                <span className="text-slate-400">{label}</span>
                <span className="font-semibold text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Referral state
          </div>
          <div className="mt-3 text-sm leading-6 text-slate-300">
            Referral stays passive on mobile. Current binding is visible, but gameplay and wallet
            flows remain primary.
          </div>
          <div className="mt-3 rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white">
            Referrer: 0x7aF3...912f
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PrototypeAdvancedTrustPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#040611_0%,#060a18_100%)] text-white">
      <div className="mx-auto max-w-[1760px] space-y-10 px-8 py-10">
        <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,38,0.92),rgba(6,10,24,0.95))] p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-3">
              <PrototypeBadge tone="accent">Figma export board</PrototypeBadge>
              <h1 className="text-4xl font-black tracking-[-0.05em] text-white">
                ArbiGameFi UI/UX Prototype v1.2
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-300">
                Advanced trust route boards for governed actions, referral clarity, release proof,
                and mobile trust-state handling.
              </p>
            </div>
            <div className="grid gap-2 text-sm text-slate-400">
              <div>Includes Claims, Referral, Ops, and Mobile trust flow.</div>
              <div>Built to keep advanced actions powerful but still product-readable.</div>
            </div>
          </div>
        </div>

        <BoardFrame
          title="Screen 09"
          subtitle="Claims desktop. XP, holdback, and fee paths separated into clear governed cards."
          width={1440}
        >
          <ClaimsArtboard />
        </BoardFrame>

        <BoardFrame
          title="Screen 10"
          subtitle="Referral desktop. Binding is lightweight, transparent, and never framed as a growth dashboard."
          width={1440}
        >
          <ReferralArtboard />
        </BoardFrame>

        <BoardFrame
          title="Screen 11"
          subtitle="Ops desktop. Release proof and indexer health stay readable without turning into an admin console."
          width={1440}
        >
          <OpsArtboard />
        </BoardFrame>

        <BoardFrame
          title="Screen 12"
          subtitle="Mobile trust flow. Claims and proof remain legible in a single vertical stack."
          width={390}
        >
          <MobileTrustArtboard />
        </BoardFrame>
      </div>
    </main>
  );
}
