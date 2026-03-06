import * as React from "react";
import { cn } from "../../lib/utils";

export type GameCardProps = {
    slug: string;
    label: string;
    /** Emoji or icon element */
    icon: React.ReactNode;
    description?: string;
    /** e.g. "99% RTP" */
    rtp?: string;
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
 * Game entry card with hover glow, icon animation, and Play CTA.
 * Designed to be wrapped in a Next.js <Link> by the consuming page.
 */
export function GameCard({ slug, label, icon, description, rtp, className }: GameCardProps) {
    const gradientColor = SLUG_COLORS[slug] ?? "from-slate-500/20 to-slate-900/20";

    return (
        <div
            className={cn(
                "group cursor-pointer relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm transition-all duration-300",
                "hover:border-slate-600 hover:-translate-y-1 hover:shadow-2xl hover:shadow-cyan-900/10",
                className
            )}
        >
            {/* Hover gradient overlay */}
            <div className={cn("absolute inset-0 bg-gradient-to-b opacity-0 group-hover:opacity-100 transition-opacity duration-300", gradientColor)} />

            <div className="relative z-10 p-8 flex flex-col items-center text-center">
                {/* Icon */}
                <div className="text-5xl mb-5 transform group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 drop-shadow-xl">
                    {icon}
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-white mb-1">{label}</h3>

                {/* RTP */}
                {rtp ? (
                    <span className="text-xs font-mono text-emerald-400/80 mb-2">{rtp}</span>
                ) : null}

                {/* Description */}
                {description ? (
                    <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
                ) : null}

                {/* Play CTA */}
                <div className="mt-6 flex items-center text-emerald-400 font-semibold text-sm opacity-0 group-hover:opacity-100 transform translate-y-3 group-hover:translate-y-0 transition-all duration-300">
                    Play Now
                    <svg className="w-4 h-4 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                </div>
            </div>
        </div>
    );
}
