import type { Metadata } from "next";

import { ArbiGameFiMark } from "../../../components/ArbiGameFiBrand";

export const metadata: Metadata = {
  title: "UI UX Prototype v1 Trust Routes",
  robots: {
    index: false,
    follow: false,
  },
};

function PrototypeBadge({
  children,
  tone = "default",
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

function TrustShell({
  section,
  heading,
  body,
  right,
  children,
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
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Trust routes</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PrototypeBadge>Rooms</PrototypeBadge>
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
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Reading guide</div>
          <div className="mt-4 space-y-3">
            {[
              ["Plain language first", "Metrics explain meaning before numeric detail."],
              ["Action second", "Forms stay below interpretation and readiness."],
              ["Proof lower fold", "Explorer and protocol details stay available, not dominant."],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-[1.2rem] border border-white/8 bg-[#071024] px-4 py-4">
                <div className="text-sm font-semibold text-white">{title}</div>
                <div className="mt-1 text-sm leading-6 text-slate-400">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  note,
  tone = "default",
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
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-black text-white">{value}</div>
      <div className="mt-2 text-sm leading-6 text-slate-400">{note}</div>
    </div>
  );
}

function LiquidityArtboard() {
  return (
    <TrustShell
      section="Liquidity"
      heading="Read LP health before you move capital."
      body="Liquidity is framed as an LP dashboard, not a generic vault form. The first fold tells the user what backs redemptions, what is reserved, and what exits are currently safe."
      right={
        <div className="grid grid-cols-3 gap-4">
          <MetricTile label="NAV" value="$4.82M" note="LP backing after protocol and XP liabilities." tone="accent" />
          <MetricTile label="Reserved" value="$1.11M" note="Locked against open room exposure." />
          <MetricTile label="Exit room" value="$2.74M" note="Currently available for withdraw / redeem." />
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2">
              {["USDC Bank", "WETH Bank", "ARB Bank"].map((item, index) => (
                <div
                  key={item}
                  className={[
                    "rounded-full px-4 py-2 text-sm font-semibold",
                    index === 0 ? "bg-white text-slate-950" : "border border-white/10 bg-white/[0.04] text-white",
                  ].join(" ")}
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <MetricTile label="Min liquidity floor" value="$970k" note="Protected floor that blocks optional outflow when breached." />
              <MetricTile label="Protocol fees payable" value="$184k" note="Not part of LP backing. Paid before NAV can be interpreted." />
              <MetricTile label="XP liabilities" value="$126k" note="Outstanding XP bucket exposure kept outside LP backing." />
              <MetricTile label="Free balance" value="$3.71M" note="Bank cash after reserved risk but before optional withdrawal limits." />
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,17,36,0.98),rgba(7,12,24,0.98))] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">My position</div>
            <div className="mt-4 grid grid-cols-[1.15fr_1fr] gap-4">
              <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.04] p-4">
                <div className="text-sm font-semibold text-white">Balances and ownership</div>
                <div className="mt-4 space-y-3">
                  {[
                    ["Wallet balance", "28,450.11 USDC"],
                    ["Bank shares", "21,440.03 shares"],
                    ["Assets equivalent", "21,712.44 USDC"],
                    ["Allowance to bank", "Unlimited"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between border-b border-white/8 pb-3 text-sm text-slate-300 last:border-b-0 last:pb-0">
                      <span>{label}</span>
                      <span className="font-semibold text-white">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.3rem] border border-cyan-300/25 bg-[linear-gradient(180deg,rgba(11,27,50,0.96),rgba(6,15,33,0.98))] p-4">
                <div className="text-sm font-semibold text-white">Move capital</div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {["Deposit", "Withdraw", "Redeem"].map((item, index) => (
                    <div
                      key={item}
                      className={[
                        "rounded-full px-4 py-2 text-center text-sm font-semibold",
                        index === 0 ? "bg-white text-slate-950" : "border border-white/10 bg-white/[0.04] text-white",
                      ].join(" ")}
                    >
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-[1rem] border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Amount</div>
                  <div className="mt-2 text-3xl font-black text-white">10,000</div>
                  <div className="mt-1 text-sm text-slate-400">USDC</div>
                </div>
                <div className="mt-3 flex gap-2">
                  {["25%", "50%", "Max"].map((chip) => (
                    <div key={chip} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white">
                      {chip}
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-[1rem] border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-sm font-semibold text-white">Interpretation</div>
                  <div className="mt-2 text-sm leading-6 text-slate-400">
                    Deposits are open. Optional outflow remains healthy because reserve and floor checks still leave room for exit.
                  </div>
                </div>
                <div className="mt-4 rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950">Review deposit</div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">LP guide</div>
            <div className="mt-4 space-y-3">
              {[
                ["NAV backs LPs", "Treat NAV as the real backing number, not free balance or TVL shorthand."],
                ["Reserved is active exposure", "It explains why cash can exist but still be unavailable for optional outflow."],
                ["XP and PF sit outside backing", "Both liabilities are visible so LPs do not overread bank health."],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-[1.1rem] border border-white/8 bg-[#071024] px-4 py-4">
                  <div className="text-sm font-semibold text-white">{title}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-400">{desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Proof layer</div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between"><span>Release digest</span><span className="font-semibold text-white">0x8c7...22f</span></div>
              <div className="flex items-center justify-between"><span>Chain</span><span className="font-semibold text-white">Base Sepolia</span></div>
              <div className="flex items-center justify-between"><span>Bank</span><span className="font-semibold text-white">0x4D...b7</span></div>
            </div>
            <div className="mt-4 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm font-semibold text-white">
              Open explorer links
            </div>
          </div>
        </div>
      </div>
    </TrustShell>
  );
}

function BetsArtboard() {
  return (
    <TrustShell
      section="Bets"
      heading="Audit history without dropping out of product language."
      body="The bets route is a readable event ledger. Filters stay fast, actions stay contextual, and protocol detail only expands when the user needs lifecycle proof."
      right={
        <div className="grid grid-cols-3 gap-4">
          <MetricTile label="Indexed bets" value="18,422" note="Event-backed list coverage across supported rooms." tone="accent" />
          <MetricTile label="Pending" value="44" note="Eligible for follow-up or refund checks." />
          <MetricTile label="Settled today" value="1,126" note="Recent settlement pace across all rooms." />
        </div>
      }
    >
      <div className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,17,36,0.98),rgba(7,12,24,0.98))] p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {["All bets", "Open", "Settled", "Refunded", "Roulette", "USDC"].map((item, index) => (
              <div
                key={item}
                className={[
                  "rounded-full px-4 py-2 text-sm font-semibold",
                  index === 0 ? "bg-white text-slate-950" : "border border-white/10 bg-white/[0.04] text-white",
                ].join(" ")}
              >
                {item}
              </div>
            ))}
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white">
            Export ledger
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[1.4rem] border border-white/10">
          <div className="grid grid-cols-[180px_1fr_140px_120px_140px_140px] border-b border-white/10 bg-white/[0.05] px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <div>Bet</div>
            <div>Room / params</div>
            <div>Stake</div>
            <div>Status</div>
            <div>Lifecycle</div>
            <div>Action</div>
          </div>
          {[
            ["#18212", "Roulette · Straight 17", "10.00 USDC", "Pending", "VRF requested · 31s ago", "View"],
            ["#18211", "Dice · Under 62", "5.00 USDC", "Settled", "Won · tx linked", "View"],
            ["#18210", "Coin Toss · Heads", "2.00 USDC", "Refundable", "Past refund timeout", "Refund"],
            ["#18209", "Keno · 5 picks", "12.00 USDC", "Settled", "Lost · finalized", "View"],
          ].map(([bet, room, stake, status, life, action], index) => (
            <div
              key={bet}
              className={[
                "grid grid-cols-[180px_1fr_140px_120px_140px_140px] items-center px-5 py-4 text-sm",
                index % 2 === 0 ? "bg-[#061022]" : "bg-[#081126]",
              ].join(" ")}
            >
              <div className="font-semibold text-white">{bet}</div>
              <div>
                <div className="font-semibold text-white">{room}</div>
                <div className="mt-1 text-xs text-slate-500">Event-derived room line with decode-ready label.</div>
              </div>
              <div className="font-semibold text-white">{stake}</div>
              <div>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white">
                  {status}
                </span>
              </div>
              <div className="text-slate-400">{life}</div>
              <div>
                <span className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-950">{action}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </TrustShell>
  );
}

function BetDetailArtboard() {
  return (
    <TrustShell
      section="Bet detail"
      heading="Tell the lifecycle clearly before the raw event trail."
      body="Bet detail should read like an audit page with one obvious story: what was placed, what happened next, and what the user can do now."
      right={
        <div className="grid grid-cols-3 gap-4">
          <MetricTile label="Room" value="Roulette" note="Standard European table room." tone="accent" />
          <MetricTile label="Status" value="Pending" note="VRF requested and still within timeout." />
          <MetricTile label="Action" value="Watch" note="Refund remains disabled until timeout passes." />
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="grid grid-cols-2 gap-4">
              <MetricTile label="Bet ID" value="#18212" note="Bound to tx journal for local self-audit." tone="accent" />
              <MetricTile label="Stake / fee" value="10.00 + 0.14" note="Stake and VRF fee remain visually distinct." />
            </div>
            <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-[#071024] px-4 py-4">
              <div className="text-sm font-semibold text-white">Decoded room call</div>
              <div className="mt-2 text-base text-slate-300">Straight 17 on European roulette table, 1 round, USDC asset.</div>
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,17,36,0.98),rgba(7,12,24,0.98))] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Lifecycle timeline</div>
            <div className="mt-4 space-y-3">
              {[
                ["Placed", "User signed placeBet. Ticket recorded in local journal and emitted on-chain."],
                ["Held", "Hub snapshotted routing and room facts for this bet."],
                ["VRF requested", "Randomness request opened. Waiting on coordinator delivery."],
                ["Refund window", "Still inside timeout. Refund action not yet available."],
              ].map(([title, desc], index) => (
                <div key={title} className="flex items-start gap-4 rounded-[1.1rem] border border-white/8 bg-[#071024] px-4 py-4">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-black text-slate-950">
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{title}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-400">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Actions</div>
            <div className="mt-4 space-y-3">
              <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.04] px-4 py-4">
                <div className="text-sm font-semibold text-white">Refund</div>
                <div className="mt-1 text-sm leading-6 text-slate-400">Disabled until the bet crosses refund timeout.</div>
              </div>
              <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.04] px-4 py-4">
                <div className="text-sm font-semibold text-white">Bind bet ID</div>
                <div className="mt-1 text-sm leading-6 text-slate-400">Available only when tx is known but event binding is still missing.</div>
              </div>
              <div className="rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950">Open tx trace</div>
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Proof layer</div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between"><span>Tx hash</span><span className="font-semibold text-white">0x17...8c</span></div>
              <div className="flex items-center justify-between"><span>Release digest</span><span className="font-semibold text-white">0x8c7...22f</span></div>
              <div className="flex items-center justify-between"><span>Chain ID</span><span className="font-semibold text-white">84532</span></div>
            </div>
          </div>
        </div>
      </div>
    </TrustShell>
  );
}

function AccountArtboard() {
  return (
    <TrustShell
      section="Account"
      heading="Make self-audit feel calm, not back-office."
      body="Account centers on balances, allowances, refund credit, and journal identity. It is a personal audit surface, not a protocol debugging console."
      right={
        <div className="grid grid-cols-3 gap-4">
          <MetricTile label="Wallet assets" value="3" note="Tracked assets with readable wallet and bank views." tone="accent" />
          <MetricTile label="Refund credit" value="0.23 ETH" note="Claimable VRF refund shown near identity context." />
          <MetricTile label="Journal rows" value="82" note="Local self-audit trail for actions and receipts." />
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Balances and allowances</div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              {[
                { asset: "USDC", balance: "28,450.11", allowance: "Unlimited" },
                { asset: "WETH", balance: "4.22", allowance: "2.00 approved" },
                { asset: "ARB", balance: "12,400", allowance: "Not approved" },
              ].map(({ asset, balance, allowance }) => (
                <div key={asset} className="rounded-[1.2rem] border border-white/10 bg-[#071024] p-4">
                  <div className="text-sm font-semibold text-white">{asset}</div>
                  <div className="mt-3 text-3xl font-black text-white">{balance}</div>
                  <div className="mt-2 text-sm text-slate-400">Wallet balance</div>
                  <div className="mt-4 rounded-[0.9rem] border border-white/10 bg-black/20 px-3 py-3 text-sm text-slate-300">
                    Allowance: <span className="font-semibold text-white">{allowance}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,17,36,0.98),rgba(7,12,24,0.98))] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Transaction journal</div>
            <div className="mt-4 overflow-hidden rounded-[1.2rem] border border-white/10">
              <div className="grid grid-cols-[180px_1fr_140px_140px] border-b border-white/10 bg-white/[0.05] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <div>Time</div>
                <div>Action</div>
                <div>Chain</div>
                <div>Digest</div>
              </div>
              {[
                { time: "12:41", action: "Roulette bet placed · Straight 17", chain: "84532", digest: "0x8c7...22f" },
                { time: "12:03", action: "USDC deposit reviewed", chain: "84532", digest: "0x8c7...22f" },
                { time: "11:22", action: "Refund credit claimed", chain: "84532", digest: "0x8c7...22f" },
              ].map(({ time, action, chain, digest }, index) => (
                <div
                  key={time + action}
                  className={[
                    "grid grid-cols-[180px_1fr_140px_140px] px-4 py-4 text-sm",
                    index % 2 === 0 ? "bg-[#061022]" : "bg-[#081126]",
                  ].join(" ")}
                >
                  <div className="font-semibold text-white">{time}</div>
                  <div className="text-slate-300">{action}</div>
                  <div className="text-white">{chain}</div>
                  <div className="text-white">{digest}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[1.8rem] border border-cyan-300/25 bg-[linear-gradient(180deg,rgba(11,27,50,0.96),rgba(6,15,33,0.98))] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Refund credit</div>
            <div className="mt-3 text-4xl font-black text-white">0.23 ETH</div>
            <div className="mt-2 text-sm leading-6 text-slate-300">Claimable VRF refund credit remains readable and attached to wallet identity.</div>
            <div className="mt-5 rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950">Claim refund credit</div>
          </div>

          <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Identity</div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between"><span>Chain</span><span className="font-semibold text-white">Base Sepolia</span></div>
              <div className="flex items-center justify-between"><span>Mode</span><span className="font-semibold text-white">Canonical release</span></div>
              <div className="flex items-center justify-between"><span>Hub</span><span className="font-semibold text-white">0x9E...14</span></div>
              <div className="flex items-center justify-between"><span>VRF hub</span><span className="font-semibold text-white">0x17...c3</span></div>
            </div>
          </div>
        </div>
      </div>
    </TrustShell>
  );
}

export default function PrototypeTrustPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#040611_0%,#060a18_100%)] text-white">
      <div className="mx-auto max-w-[1760px] space-y-10 px-8 py-10">
        <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,38,0.92),rgba(6,10,24,0.95))] p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-3">
              <PrototypeBadge tone="accent">Figma export board</PrototypeBadge>
              <h1 className="text-4xl font-black tracking-[-0.05em] text-white">ArbiGameFi UI/UX Prototype v1.1</h1>
              <p className="max-w-3xl text-base leading-7 text-slate-300">
                Trust and audit route boards for Figma capture. These screens translate release pack, LP onboarding, and route review work into calmer product surfaces.
              </p>
            </div>
            <div className="grid gap-2 text-sm text-slate-400">
              <div>Includes Liquidity, Bets, Bet Detail, and Account.</div>
              <div>Built to separate interpretation, action, and proof density.</div>
            </div>
          </div>
        </div>

        <BoardFrame
          title="Screen 05"
          subtitle="Liquidity desktop. LP-first framing with explanation above action and proof."
          width={1440}
        >
          <LiquidityArtboard />
        </BoardFrame>

        <BoardFrame
          title="Screen 06"
          subtitle="Bets desktop. Event-backed history treated as a readable ledger, not a raw ops table."
          width={1440}
        >
          <BetsArtboard />
        </BoardFrame>

        <BoardFrame
          title="Screen 07"
          subtitle="Bet detail desktop. Lifecycle story first, raw proof second."
          width={1440}
        >
          <BetDetailArtboard />
        </BoardFrame>

        <BoardFrame
          title="Screen 08"
          subtitle="Account desktop. Personal self-audit surface for balances, allowances, refund credit, and journal identity."
          width={1440}
        >
          <AccountArtboard />
        </BoardFrame>
      </div>
    </main>
  );
}
