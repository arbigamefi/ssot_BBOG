import Link from "next/link";

const ITEMS = [
  "Wallet addresses may be displayed when you interact with public room activity.",
  "Analytics and performance instrumentation may be used to improve the frontend.",
  "On-chain transactions remain public and independently verifiable.",
] as const;

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="rounded-[2rem] border border-white/8 bg-white/[0.03] p-8 md:p-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">Legal</div>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">Privacy Policy</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-white/55">
          ArbiGameFi is built around public-chain execution. This policy explains the limited data the frontend may
          process in addition to the public wallet and transaction data already visible on-chain.
        </p>

        <div className="mt-8 space-y-3">
          {ITEMS.map((item) => (
            <div key={item} className="rounded-[1.25rem] border border-white/8 bg-black/20 px-4 py-4 text-sm text-white/70">
              {item}
            </div>
          ))}
        </div>

        <div className="mt-10 space-y-6 text-sm leading-7 text-slate-300">
          <section>
            <h2 className="text-base font-semibold text-white">Public blockchain data</h2>
            <p className="mt-2">
              Wallet addresses, transaction hashes, bet states, and settlement outcomes may be rendered in public room
              feeds because they are already public on-chain.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-white">Frontend analytics</h2>
            <p className="mt-2">
              The frontend may collect product analytics, performance metrics, and engagement signals to improve room
              layouts, onboarding, and operational visibility.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-white">Third-party services</h2>
            <p className="mt-2">
              Wallet connectors, RPC providers, indexers, and oracle integrations may process request metadata as part
              of normal operation. Their own terms and privacy rules also apply.
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
