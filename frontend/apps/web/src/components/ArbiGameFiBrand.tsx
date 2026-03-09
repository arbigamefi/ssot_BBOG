import * as React from "react";

type Accent = "cyan" | "emerald";

const ACCENT_STYLES: Record<
  Accent,
  {
    shell: string;
    glow: string;
    wordmark: string;
    subtitle: string;
    gradFrom: string;
    gradTo: string;
  }
> = {
  cyan: {
    shell: "border-cyan-400/25 bg-cyan-400/10 shadow-cyan-950/30",
    glow: "text-cyan-100",
    wordmark: "text-white",
    subtitle: "text-slate-500",
    gradFrom: "#6EE7F9",
    gradTo: "#C93B63"
  },
  emerald: {
    shell: "border-emerald-400/30 bg-emerald-400/10 shadow-emerald-950/40",
    glow: "text-emerald-100",
    wordmark: "text-white",
    subtitle: "text-slate-500",
    gradFrom: "#52D4A6",
    gradTo: "#9B8CFF"
  }
};

export function ArbiGameFiMark({
  accent = "cyan",
  className
}: {
  accent?: Accent;
  className?: string;
}) {
  const style = ACCENT_STYLES[accent];
  const shellClassName = [
    "flex items-center justify-center rounded-2xl border shadow-lg transition-transform duration-200",
    style.shell,
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClassName}>
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={["h-[72%] w-[72%]", style.glow].filter(Boolean).join(" ")}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`ag-mark-${accent}`} x1="10" y1="10" x2="38" y2="38" gradientUnits="userSpaceOnUse">
            <stop stopColor={style.gradFrom} />
            <stop offset="1" stopColor={style.gradTo} />
          </linearGradient>
        </defs>
        <path
          d="M16.5 34L24 13.5L31.5 34M19.6 25H28.4"
          stroke={`url(#ag-mark-${accent})`}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M34.5 18.5C32.6 15.8 29.6 14 26.2 14C20.3 14 15.5 18.8 15.5 24.7C15.5 30.6 20.3 35.4 26.2 35.4C30.7 35.4 34.6 32.6 36.1 28.6H29.3"
          stroke="rgba(243,246,255,0.92)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function ArbiGameFiBrand({
  accent = "cyan",
  subtitle,
  compact = false
}: {
  accent?: Accent;
  subtitle?: string;
  compact?: boolean;
}) {
  const style = ACCENT_STYLES[accent];
  const wordmarkClassName = ["text-sm font-black tracking-[0.08em]", style.wordmark].join(" ");
  const subtitleClassName = [
    "text-[11px] font-semibold uppercase tracking-[0.2em]",
    style.subtitle,
    compact ? "hidden" : undefined
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex items-center gap-3">
      <ArbiGameFiMark accent={accent} className={compact ? "h-9 w-9 rounded-xl" : "h-10 w-10"} />
      <div className="space-y-0.5">
        <div className={wordmarkClassName}>ArbiGameFi</div>
        {subtitle ? <div className={subtitleClassName}>{subtitle}</div> : null}
      </div>
    </div>
  );
}
