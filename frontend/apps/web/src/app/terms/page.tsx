import Link from "next/link";

const HIGHLIGHTS = [
  "Wallet-native entry into live rooms",
  "On-chain settlement and external provider dependencies",
  "No guarantee of uninterrupted availability or legality in every jurisdiction",
] as const;

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="rounded-[2rem] border border-white/8 bg-white/[0.03] p-8 md:p-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">Legal</div>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">Terms of Service</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-white/55">
          These terms govern access to the ArbiGameFi frontend and the interfaces used to reach live rooms,
          bankroll pages, and referral surfaces.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {HIGHLIGHTS.map((item) => (
            <div key={item} className="rounded-[1.25rem] border border-white/8 bg-black/20 px-4 py-4 text-sm text-white/70">
              {item}
            </div>
          ))}
        </div>

        <div className="mt-10 space-y-6 text-sm leading-7 text-slate-300">
          <section>
            <h2 className="text-base font-semibold text-white">Use of the frontend</h2>
            <p className="mt-2">
              The ArbiGameFi frontend is an interface layer for wallet-native, on-chain game rooms. Access to the
              frontend does not remove the need for users to review transaction contents, quoted fees, or network
              conditions before signing.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-white">Wallets and execution</h2>
            <p className="mt-2">
              Users remain responsible for wallet custody, transaction review, gas fees, and compliance with local
              rules. ArbiGameFi does not take custody of wallets or private keys.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-white">Protocol and room risk</h2>
            <p className="mt-2">
              Live rooms depend on smart contracts, oracle flows, indexers, RPC infrastructure, and third-party
              wallet providers. Service availability and outcome visibility may be affected by any of these layers.
            </p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/privacy"
            className="rounded-xl border border-white/12 px-5 py-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.04] hover:text-white"
          >
            Privacy Policy
          </Link>
          <Link
            href="/disclaimer"
            className="rounded-xl border border-white/12 px-5 py-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.04] hover:text-white"
          >
            Risk Disclaimer
          </Link>
        </div>
      </div>
    </main>
  );
}
