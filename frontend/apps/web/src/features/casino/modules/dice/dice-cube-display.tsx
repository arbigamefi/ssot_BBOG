import * as React from "react";
import { cn } from "@ssot/ui";

function formatFaceNumber(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "50";
  return String(Math.max(1, Math.min(100, Math.round(value))));
}

function Facet({ points, fill, opacity = 1 }: { points: string; fill: string; opacity?: number }) {
  return <polygon points={points} fill={fill} opacity={opacity} />;
}

export function DiceCubeDisplay({
  isPending,
  showResult,
  resultNum,
  targetNum
}: {
  isPending: boolean;
  showResult: boolean;
  resultNum: number | null;
  targetNum: number;
}) {
  const centerValue =
    showResult && resultNum != null ? formatFaceNumber(resultNum) : formatFaceNumber(targetNum);
  const faceMode = showResult && resultNum != null ? "ROLL" : "TARGET";

  return (
    <div className="relative z-10 flex flex-col items-center [perspective:1400px]">
      <div className="pointer-events-none absolute -bottom-8 h-12 w-72 rounded-full bg-brand/18 blur-[42px]" />
      <div
        className={cn(
          "transform-gpu transition-transform duration-500 [transform-style:preserve-3d]",
          isPending
            ? "animate-[dice-percentile-tumble_1.15s_cubic-bezier(0.22,0.72,0.24,1)_infinite]"
            : "rotate-[-5deg]",
          showResult && !isPending && "scale-[1.04]"
        )}
      >
        <svg
          viewBox="0 0 320 300"
          role="img"
          aria-label="Percentile roll die"
          className="h-72 w-72 overflow-visible drop-shadow-[0_34px_48px_hsl(var(--brand)/0.24)]"
        >
          <defs>
            <linearGradient
              id="percentileTop"
              x1="88"
              x2="246"
              y1="24"
              y2="142"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="hsl(var(--accent) / 0.92)" />
              <stop offset="1" stopColor="hsl(var(--brand) / 0.54)" />
            </linearGradient>
            <linearGradient
              id="percentileGlass"
              x1="42"
              x2="272"
              y1="68"
              y2="260"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="hsl(var(--accent) / 0.62)" />
              <stop offset="0.46" stopColor="hsl(var(--surface-2) / 0.72)" />
              <stop offset="1" stopColor="hsl(var(--surface-0) / 0.96)" />
            </linearGradient>
            <linearGradient
              id="percentileFace"
              x1="106"
              x2="215"
              y1="86"
              y2="208"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="hsl(var(--surface-3) / 0.92)" />
              <stop offset="0.54" stopColor="hsl(var(--surface-1) / 0.82)" />
              <stop offset="1" stopColor="hsl(var(--brand) / 0.24)" />
            </linearGradient>
            <linearGradient
              id="percentileEdge"
              x1="42"
              x2="278"
              y1="36"
              y2="270"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="hsl(var(--accent) / 0.76)" />
              <stop offset="1" stopColor="hsl(var(--brand) / 0.5)" />
            </linearGradient>
            <filter id="percentileSoftGlow" x="-18%" y="-18%" width="136%" height="136%">
              <feGaussianBlur stdDeviation="2.1" result="blur" />
              <feColorMatrix
                in="blur"
                result="glow"
                type="matrix"
                values="0 0 0 0 0.24 0 0 0 0 0.92 0 0 0 0 0.86 0 0 0 0.26 0"
              />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <ellipse cx="160" cy="270" rx="96" ry="18" fill="hsl(var(--brand) / 0.12)" />

          <g filter="url(#percentileSoftGlow)">
            <Facet points="160,24 76,68 122,118" fill="url(#percentileTop)" opacity={0.82} />
            <Facet points="160,24 244,68 198,118" fill="url(#percentileTop)" opacity={0.7} />
            <Facet points="76,68 34,150 122,118" fill="url(#percentileGlass)" opacity={0.8} />
            <Facet points="244,68 286,150 198,118" fill="url(#percentileGlass)" opacity={0.72} />
            <Facet points="34,150 92,244 122,118" fill="url(#percentileGlass)" opacity={0.62} />
            <Facet
              points="286,150 228,244 198,118"
              fill="hsl(var(--surface-0) / 0.9)"
              opacity={0.88}
            />
            <Facet points="92,244 160,282 160,202" fill="hsl(var(--surface-0) / 0.92)" />
            <Facet points="228,244 160,282 160,202" fill="hsl(var(--surface-1) / 0.78)" />
            <Facet points="122,118 198,118 160,202" fill="url(#percentileFace)" opacity={0.98} />
            <Facet points="122,118 160,202 92,244" fill="hsl(var(--surface-2) / 0.72)" />
            <Facet points="198,118 228,244 160,202" fill="hsl(var(--surface-2) / 0.58)" />
          </g>

          <g fill="none" stroke="url(#percentileEdge)" strokeLinecap="round" strokeLinejoin="round">
            <path
              d="M160 24 244 68 286 150 228 244 160 282 92 244 34 150 76 68 160 24Z"
              strokeWidth="2.4"
            />
            <path d="M76 68 122 118 160 24 198 118 244 68" strokeWidth="1.45" opacity="0.72" />
            <path d="M34 150 122 118 198 118 286 150" strokeWidth="1.55" opacity="0.72" />
            <path d="M122 118 92 244 160 202 228 244 198 118" strokeWidth="1.45" opacity="0.66" />
            <path d="M160 202 160 282" strokeWidth="1.1" opacity="0.38" />
          </g>

          <g fill="hsl(var(--fg) / 0.62)">
            <circle cx="229" cy="64" r="5.4" />
            <ellipse cx="247" cy="59" rx="9.5" ry="2.3" />
            <circle cx="61" cy="130" r="4.5" opacity="0.68" />
            <ellipse cx="146" cy="254" rx="11" ry="3" opacity="0.5" />
          </g>

          <g
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
            fontWeight="800"
            textAnchor="middle"
          >
            <text
              x="74"
              y="150"
              fill="hsl(var(--fg-muted))"
              fontSize="22"
              opacity="0.62"
              transform="rotate(-18 74 150)"
            >
              01
            </text>
            <text
              x="246"
              y="150"
              fill="hsl(var(--fg-muted))"
              fontSize="22"
              opacity="0.58"
              transform="rotate(18 246 150)"
            >
              99
            </text>
            <text x="160" y="142" fill="hsl(var(--fg-subtle))" fontSize="10" letterSpacing="0.22em">
              {faceMode}
            </text>
            <text x="160" y="184" fill="hsl(var(--fg))" fontSize="44">
              {centerValue}
            </text>
          </g>

          {showResult && !isPending && (
            <circle
              cx="160"
              cy="168"
              r="56"
              fill="none"
              stroke="hsl(var(--brand) / 0.72)"
              strokeWidth="2"
              strokeDasharray="4 8"
            />
          )}
        </svg>
      </div>

      {showResult && !isPending && resultNum !== null && (
        <div
          aria-hidden
          className="absolute -bottom-8 h-1.5 w-24 rounded-full bg-brand/50 shadow-e2 animate-in fade-in zoom-in duration-500"
        />
      )}
    </div>
  );
}
