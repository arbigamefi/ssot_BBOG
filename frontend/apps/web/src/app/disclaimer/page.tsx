import Link from "next/link";

const WARNINGS = [
  "Game rooms depend on smart contracts, randomness providers, indexers, and RPC connectivity.",
  "LP surfaces show reserve context and liabilities, but users must still review the underlying numbers.",
  "Users are responsible for legal compliance in their own jurisdiction.",
] as const;

export default function DisclaimerPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="rounded-[2rem] border border-amber-400/20 bg-white/[0.03] p-8 md:p-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-300/70">Risk Notice</div>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">Risk Disclaimer</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-white/55">
          ArbiGameFi presents live room interfaces for on-chain gaming and bankroll participation. Interacting with
          these systems involves financial, legal, and technical risks.
        </p>

        <div className="mt-8 grid gap-4">
          {WARNINGS.map((item) => (
            <div key={item} className="rounded-[1.25rem] border border-white/8 bg-black/20 px-4 py-4 text-sm text-white/70">
              {item}
            </div>
          ))}
        </div>

        <div className="mt-10 space-y-6 text-sm leading-7 text-slate-300">
          <section>
            <h2 className="text-base font-semibold text-white">Protocol risk</h2>
            <p className="mt-2">
              Smart contract bugs, oracle disruptions, delayed finality, indexer lag, and wallet client failures can
              impact the user experience or temporarily affect room visibility.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-white">Market and liquidity risk</h2>
            <p className="mt-2">
              Bankroll participation is subject to reserve usage, liability accounting, and protocol-specific exit
              rules. Availability of deposits, withdrawals, and redemptions may change with room activity.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-white">Jurisdiction and compliance</h2>
            <p className="mt-2">
              Users must determine for themselves whether use of the frontend, room participation, or LP activity is
              lawful in their jurisdiction.
            </p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/terms"
            className="rounded-xl border border-white/12 px-5 py-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.04] hover:text-white"
          >
            Terms of Service
          </Link>
          <Link
            href="/privacy"
            className="rounded-xl border border-white/12 px-5 py-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.04] hover:text-white"
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </main>
  );
}
