import * as React from "react";
import { cn } from "../../lib/utils";

export type GameCardProps = {
    slug: string;
    label: string;
    /** Emoji or icon element */
    icon: React.ReactNode;
    badge?: string;
    description?: string;
    summary?: string;
    facts?: string[];
    /** e.g. "99% RTP" */
    rtp?: string;
    ctaLabel?: string;
    className?: string;
    /** Rendered as child allows wrapping with Link */
    children?: React.ReactNode;
};

const SLUG_COLORS: Record<string, string> = {
    dice: "from-blue-500/20 to-blue-900/20",
    "coin-toss": "from-amber-500/20 to-amber-900/20",
    cointoss: "from-amber-500/20 to-amber-900/20",
    roulette: "from-rose-500/20 to-rose-900/20",
    keno: "from-purple-500/20 to-purple-900/20",
};

/**
 * Game entry card with hover glow and room-level product framing.
 * Designed to be wrapped in a Next.js <Link> by the consuming page.
 */
export function GameCard({ slug, label, icon, badge, description, summary, facts, rtp, ctaLabel = "Enter Room", className }: GameCardProps) {
    const gradientColor = SLUG_COLORS[slug] ?? "from-slate-500/20 to-slate-900/20";
    const metaLabel = rtp ? "Quoted edge" : "Room entry";
    const metaValue = rtp ?? "Release-routed table";

    return (
        <div
            className={cn(
                "group cursor-pointer relative overflow-hidden rounded-[1.9rem] border border-slate-800 bg-slate-900/50 backdrop-blur-xl transition-all duration-300",
                "hover:border-slate-600 hover:-translate-y-1 hover:shadow-2xl hover:shadow-cyan-900/10",
                className
            )}
        >
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-90 transition-opacity duration-300", gradientColor)} />
            <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(2,6,23,0.86),rgba(15,23,42,0.76))]" />
            <div className="absolute left-6 top-6 h-24 w-24 rounded-full bg-white/10 blur-3xl opacity-60 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-3xl opacity-70 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="absolute inset-x-6 top-6 h-px bg-gradient-to-r from-white/30 via-white/10 to-transparent" />

            <div className="relative z-10 flex h-full flex-col p-6 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/45 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                            <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,249,0.45)]" />
                            Room live
                        </div>
                        <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-slate-950/45 text-4xl shadow-lg shadow-black/20 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
                            {icon}
                        </div>
                    </div>
                    <div className="space-y-2 text-right">
                        {badge ? (
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-slate-950/45 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                                {badge}
                            </span>
                        ) : null}
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Wallet-native room
                        </div>
                    </div>
                </div>

                <div className="mt-6 space-y-3 text-left">
                    <h3 className="text-2xl font-black tracking-tight text-white">{label}</h3>

                    {description ? (
                        <p className="text-sm leading-relaxed text-slate-300">{description}</p>
                    ) : null}

                    {summary ? (
                        <p className="text-sm leading-relaxed text-slate-400">{summary}</p>
                    ) : null}
                </div>

                <div className="mt-5 rounded-[1.35rem] border border-white/10 bg-slate-950/45 px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                {metaLabel}
                            </div>
                            <div className="mt-2 text-sm font-semibold text-white">{metaValue}</div>
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                            {slug.replace("-", " ")}
                        </div>
                    </div>
                </div>

                {facts && facts.length > 0 ? (
                    <div className="mt-5 flex flex-wrap gap-2">
                        {facts.map((fact, index) => (
                            <span
                                key={fact}
                                className={cn(
                                    "rounded-full border px-3 py-1.5 text-xs font-medium",
                                    index === 0
                                        ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
                                        : "border-white/10 bg-slate-950/45 text-slate-300"
                                )}
                            >
                                {fact}
                            </span>
                        ))}
                    </div>
                ) : null}

                <div className="mt-auto flex items-end justify-between gap-4 pt-6">
                    <div className="space-y-1">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Trust layer
                        </div>
                        <div className="text-sm font-medium text-slate-200">
                            Fully on-chain room
                        </div>
                    </div>

                    <div className="inline-flex items-center rounded-full border border-emerald-300/25 bg-emerald-300/10 px-4 py-2 text-emerald-200 font-semibold text-sm transition-all duration-300 group-hover:border-emerald-200/35 group-hover:bg-emerald-300/16 group-hover:text-emerald-100">
                        {ctaLabel}
                        <svg className="w-4 h-4 ml-1.5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
}
