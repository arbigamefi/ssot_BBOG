import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, CodeBracketIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

export function HomeHero({
  copy
}: {
  copy: {
    channel: string;
    title: string;
    description: string;
    enterCasino: string;
    viewBank: string;
    proofRows: {
      vrf: { title: string; detail: string };
      bytecode: { title: string; detail: string };
    };
  };
}) {
  const proofPoints = [
    { icon: ShieldCheckIcon, ...copy.proofRows.vrf },
    { icon: CodeBracketIcon, ...copy.proofRows.bytecode }
  ];
  return (
    <section className="relative overflow-hidden border-b border-border-soft bg-surface-0">
      {/* Hero atmosphere — matches the rebuilt game consoles. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[44rem]"
        style={{
          background: "radial-gradient(120% 70% at 50% -6%, hsl(var(--surface-2)), transparent 72%)"
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-12 h-[560px] w-[920px] max-w-full -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, hsl(var(--brand) / 0.18), transparent 68%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-1/3 h-[420px] w-[420px] rounded-full"
        style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.1), transparent 70%)" }}
      />

      <div className="relative mx-auto grid min-h-[560px] max-w-[1440px] grid-cols-1 gap-10 px-6 pb-16 pt-28 md:pb-20 md:pt-32 lg:min-h-[660px] lg:grid-cols-[minmax(0,0.95fr)_minmax(440px,0.85fr)] lg:items-center lg:px-10">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-soft px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-brand shadow-e1">
            <span className="h-2 w-2 rounded-full bg-accent" />
            {copy.channel}
          </div>

          <h1 className="max-w-4xl text-5xl font-bold leading-[1.03] tracking-normal text-fg md:text-7xl">
            {copy.title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-fg-muted md:text-xl">
            {copy.description}
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/casino"
              className="inline-flex items-center justify-center gap-3 rounded-md bg-brand px-6 py-4 text-sm font-bold uppercase tracking-[0.12em] text-fg-inverse shadow-e2 transition-[transform,box-shadow,background-color] hover:bg-brand-hover"
            >
              {copy.enterCasino} <ArrowRightIcon className="h-5 w-5" />
            </Link>
            <Link
              href="/earn"
              className="inline-flex items-center justify-center rounded-md border border-border-soft bg-surface-2 px-6 py-4 text-sm font-bold uppercase tracking-[0.12em] text-fg transition-[transform,box-shadow,border-color,background-color] hover:border-brand/40 hover:bg-surface-3 hover:shadow-e2"
            >
              {copy.viewBank}
            </Link>
          </div>

          {/* Trust row — turns the empty lower hero into credibility, and
              fills the column so the composition reads intentional. */}
          <div className="mt-12 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
            {proofPoints.map((point) => (
              <div
                key={point.title}
                className="flex gap-3 rounded-lg border border-border-soft bg-surface-1/60 p-4"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-brand/20 bg-brand-soft text-brand">
                  <point.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-fg">{point.title}</div>
                  <div className="mt-1 text-xs leading-5 text-fg-muted">{point.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hero visual — page-local SVG keeps the roulette presence without
            pulling the full game stage runtime into the homepage bundle. */}
        <div className="relative flex h-full items-center justify-center lg:justify-end">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-[440px] w-[440px] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background: "radial-gradient(circle, hsl(var(--brand) / 0.26), transparent 65%)"
            }}
          />
          <div className="relative">
            <HeroRouletteVisual />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroRouletteVisual() {
  const pockets = Array.from({ length: 37 }, (_, index) => index);
  return (
    <div className="relative h-[300px] w-[300px] md:h-[380px] md:w-[380px]" aria-hidden>
      <div className="absolute left-1/2 top-1/2 h-[92%] w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface-0/65 blur-3xl" />
      <svg viewBox="0 0 380 380" className="relative h-full w-full drop-shadow-2xl">
        <defs>
          <radialGradient id="home-roulette-apron" cx="45%" cy="32%" r="74%">
            <stop offset="0%" stopColor="hsl(var(--surface-3))" />
            <stop offset="58%" stopColor="hsl(var(--surface-1))" />
            <stop offset="100%" stopColor="hsl(var(--surface-0))" />
          </radialGradient>
          <radialGradient id="home-roulette-cone" cx="42%" cy="35%" r="78%">
            <stop offset="0%" stopColor="hsl(var(--accent))" />
            <stop offset="56%" stopColor="hsl(var(--brand))" />
            <stop offset="100%" stopColor="hsl(var(--surface-2))" />
          </radialGradient>
          <filter id="home-roulette-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="16" stdDeviation="14" floodColor="black" floodOpacity="0.55" />
          </filter>
        </defs>

        <ellipse cx="190" cy="342" rx="120" ry="20" fill="hsl(var(--surface-0))" opacity="0.62" />
        {/* Slow CSS rotation — no JS cost, respects prefers-reduced-motion.
            Roughly one full turn every 30s, the pace of a real wheel. */}
        <g
          className="motion-safe:animate-[spin_30s_linear_infinite]"
          style={{ transformOrigin: "190px 190px" }}
        >
          <g filter="url(#home-roulette-shadow)">
            <circle cx="190" cy="190" r="168" fill="url(#home-roulette-apron)" />
            <circle
              cx="190"
              cy="190"
              r="152"
              fill="none"
              stroke="hsl(var(--fg) / 0.16)"
              strokeWidth="2"
            />
            <circle
              cx="190"
              cy="190"
              r="132"
              fill="hsl(var(--surface-0))"
              stroke="hsl(var(--border-strong))"
              strokeWidth="2"
            />

            {pockets.map((_, index) => {
              const segment = 360 / pockets.length;
              const start = index * segment - 90 - segment / 2;
              const end = start + segment;
              const largeArc = segment > 180 ? 1 : 0;
              const outer = 132;
              const inner = 92;
              const a0 = (start * Math.PI) / 180;
              const a1 = (end * Math.PI) / 180;
              const x0 = 190 + outer * Math.cos(a0);
              const y0 = 190 + outer * Math.sin(a0);
              const x1 = 190 + outer * Math.cos(a1);
              const y1 = 190 + outer * Math.sin(a1);
              const x2 = 190 + inner * Math.cos(a1);
              const y2 = 190 + inner * Math.sin(a1);
              const x3 = 190 + inner * Math.cos(a0);
              const y3 = 190 + inner * Math.sin(a0);
              const fill =
                index === 0
                  ? "hsl(var(--success))"
                  : index % 2 === 0
                    ? "hsl(var(--danger))"
                    : "hsl(var(--surface-0))";
              return (
                <path
                  key={index}
                  d={`M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${outer} ${outer} 0 ${largeArc} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)} A ${inner} ${inner} 0 ${largeArc} 0 ${x3.toFixed(2)} ${y3.toFixed(2)} Z`}
                  fill={fill}
                  stroke="hsl(var(--fg) / 0.18)"
                  strokeWidth="0.75"
                />
              );
            })}

            <circle
              cx="190"
              cy="190"
              r="91"
              fill="hsl(var(--surface-1))"
              stroke="hsl(var(--border-strong))"
              strokeWidth="2"
            />
            <circle cx="190" cy="190" r="62" fill="url(#home-roulette-cone)" />
            <circle cx="190" cy="190" r="34" fill="hsl(var(--surface-0))" opacity="0.88" />
            <path
              d="M190 134v112M134 190h112"
              stroke="hsl(var(--fg) / 0.38)"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <circle cx="190" cy="190" r="12" fill="hsl(var(--fg))" />
          </g>
        </g>

        <path
          d="M128 96c46-48 127-46 169 6"
          fill="none"
          stroke="hsl(var(--fg) / 0.22)"
          strokeLinecap="round"
          strokeWidth="5"
        />
        <circle cx="296" cy="104" r="9" fill="hsl(var(--fg))" />
        <circle cx="190" cy="18" r="6" fill="hsl(var(--accent))" />
      </svg>
    </div>
  );
}
