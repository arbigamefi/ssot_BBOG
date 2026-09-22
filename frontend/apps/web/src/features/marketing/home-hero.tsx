import * as React from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  CodeBracketIcon,
  ShieldCheckIcon
} from "@heroicons/react/24/outline";
import { SectionEyebrow } from "./section-eyebrow";

export function HomeHero({
  copy
}: {
  copy: {
    channel: string;
    title: string;
    description: string;
    enterCasino: string;
    viewBank: string;
    scrollHint: string;
    visual: {
      status: string;
      wallet: string;
      receipt: string;
      proof: string;
    };
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
    <section className="relative overflow-hidden border-b border-border-soft bg-surface-0 lg:min-h-[calc(100svh-5.5rem)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,hsl(var(--surface-0))_0%,hsl(var(--surface-1))_58%,hsl(var(--surface-0))_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_55%_42%,hsl(var(--brand)/0.1),transparent_58%)] lg:block"
      />

      <div className="relative mx-auto grid max-w-[1440px] grid-cols-1 gap-8 px-6 pb-12 pt-24 md:gap-10 md:pb-16 md:pt-32 lg:min-h-[calc(100svh-5.5rem)] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center lg:gap-6 lg:px-10 lg:pb-20 lg:pt-28 xl:grid-cols-[minmax(0,0.88fr)_minmax(440px,0.92fr)] xl:gap-8">
        <div className="max-w-3xl lg:pb-8">
          <SectionEyebrow size="hero" className="mb-6">
            <span className="h-2 w-2 rounded-full bg-accent" />
            {copy.channel}
          </SectionEyebrow>

          <h1 className="max-w-4xl text-4xl font-bold leading-[1.04] tracking-normal text-fg sm:text-5xl md:text-7xl lg:text-6xl xl:text-[5rem]">
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

          <div className="mt-10 hidden max-w-xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid">
            {proofPoints.map((point) => (
              <div key={point.title} className="flex gap-3 border-t border-border-soft pt-4">
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

        <div className="relative flex min-h-[270px] items-center justify-center pb-2 md:min-h-[350px] lg:min-h-[520px] lg:justify-end lg:pb-0">
          <div className="relative mx-auto w-full max-w-[380px] sm:max-w-[410px] md:max-w-[450px] lg:ml-auto lg:mr-0 lg:max-w-none">
            <HeroPayoutVisual copy={copy.visual} />
          </div>
        </div>

        <div className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
          {proofPoints.map((point) => (
            <div key={point.title} className="flex gap-3 border-t border-border-soft pt-4">
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

      <a
        href="#home-after-hero"
        aria-label={copy.scrollHint}
        className="absolute left-1/2 top-[calc(100svh-7.25rem)] hidden h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border border-border-soft bg-surface-1/80 text-fg-muted shadow-e2 backdrop-blur transition-colors hover:border-brand/40 hover:text-fg motion-safe:animate-bounce lg:flex"
      >
        <ChevronDownIcon className="h-5 w-5" />
      </a>
    </section>
  );
}

function HeroPayoutVisual({
  copy
}: {
  copy: {
    status: string;
    wallet: string;
    receipt: string;
    proof: string;
  };
}) {
  const pockets = Array.from({ length: 37 }, (_, index) => index);
  return (
    <div
      className="relative mx-auto h-[324px] w-full max-w-[380px] sm:h-[346px] sm:max-w-[408px] md:h-[384px] md:max-w-[456px] lg:mx-0 lg:h-[440px] lg:w-[500px] lg:max-w-none xl:h-[480px] xl:w-[620px]"
      aria-hidden
      style={{ perspective: "1600px" }}
    >
      {/* Layer 1 — background atmosphere: one brand light source + a soft floor shadow. */}
      <div
        className="pointer-events-none absolute right-[2%] top-[2%] h-[76%] w-[76%] rounded-full blur-xl"
        style={{
          background:
            "radial-gradient(circle at 52% 42%, hsl(var(--brand) / 0.2), hsl(var(--accent) / 0.08) 38%, transparent 68%)"
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-[10%] bottom-[3%] h-12 rounded-full blur-2xl"
        style={{
          background: "radial-gradient(ellipse, hsl(var(--surface-0) / 0.85), transparent 72%)"
        }}
      />

      {/* Layer 2 — roulette mechanical: set back, laid onto the table on desktop.
          Sized *under* the receipt card on purpose: perspective, the table fade
          and a shortened shadow push it back, so its footprint has to agree with
          them instead of pulling it forward again. Right-set and dissolving into
          the table are the point — that is the table's vanishing direction. */}
      <div className="absolute left-1/2 top-[-1.25rem] h-[244px] w-[244px] -translate-x-1/2 opacity-70 sm:h-[266px] sm:w-[266px] md:top-[-0.75rem] md:h-[292px] md:w-[292px] md:opacity-80 lg:left-auto lg:right-1 lg:top-[-2rem] lg:h-[300px] lg:w-[300px] lg:translate-x-0 lg:opacity-[0.78] lg:[transform:rotateX(20deg)] xl:right-2 xl:top-[-0.75rem] xl:h-[338px] xl:w-[338px]">
        <HeroRouletteWheel pockets={pockets} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%]"
          style={{
            background: "linear-gradient(to top, hsl(var(--surface-0) / 0.62), transparent)"
          }}
        />
      </div>

      {/* Layer 3 — foreground receipt glass: brought forward, slightly angled, casting a shadow.
          Widest object in the frame, and right-flush with the wheel, so the two
          share one edge instead of drifting apart. The extra width also reaches
          back toward the headline and closes the dead band between the columns. */}
      <div className="absolute inset-x-0 bottom-1 w-full origin-center md:bottom-0 lg:left-auto lg:right-0 lg:w-full lg:max-w-[440px] lg:[transform:rotateY(-7deg)_rotateX(4deg)] xl:max-w-[500px]">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-2 -bottom-5 top-8 -z-10 rounded-lg blur-2xl"
          style={{ background: "hsl(var(--surface-0) / 0.75)" }}
        />
        <div className="relative overflow-hidden rounded-lg border border-border-soft bg-surface-1/88 shadow-e3">
          {/* top edge highlight — the single light catching the glass rim */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background: "linear-gradient(90deg, transparent, hsl(var(--fg) / 0.24), transparent)"
            }}
          />
          <div className="flex items-center justify-between border-b border-border-soft px-4 py-3 md:px-5 md:py-4">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-fg-muted">
              {copy.receipt}
            </span>
            <span className="rounded-full border border-success/35 bg-success/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-success">
              {copy.status}
            </span>
          </div>
          <div className="px-4 py-4 md:px-5 md:py-5">
            <div className="font-mono text-[2.85rem] font-bold leading-none tracking-normal text-success md:text-6xl">
              + 9.6
              <span className="ml-2 text-xl text-success/80 md:ml-3 md:text-3xl">USDC</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-fg-muted">
              <span className="rounded-full border border-border-soft bg-surface-0 px-3 py-1.5">
                0xd662...BFB9
              </span>
              <span>{copy.wallet}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 border-t border-border-soft">
            <div className="px-4 py-3 md:px-5 md:py-4">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-fg-muted">VRF</div>
              <div className="mt-1 font-mono text-sm font-semibold text-fg">0x44a3...a39</div>
            </div>
            <div className="border-l border-border-soft px-4 py-3 md:px-5 md:py-4">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-fg-muted">
                {copy.proof}
              </div>
              <div className="mt-1 font-mono text-sm font-semibold text-fg">{"#"}294</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroRouletteWheel({ pockets }: { pockets: number[] }) {
  return (
    <svg viewBox="0 0 380 380" className="relative h-full w-full drop-shadow-lg">
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
          {/* Short, soft cast: an object set back on the table throws less
              shadow than one held in front of it. */}
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="black" floodOpacity="0.38" />
        </filter>
      </defs>

      <ellipse cx="190" cy="342" rx="120" ry="20" fill="hsl(var(--surface-0))" opacity="0.62" />
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
  );
}
