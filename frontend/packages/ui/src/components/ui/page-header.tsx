import * as React from "react";
import { cn } from "../../lib/utils";

export type PageHeaderProps = {
    title: string;
    description?: string;
    /** Optional right-side actions (buttons, selectors, etc.) */
    actions?: React.ReactNode;
    className?: string;
};

/**
 * Unified page header with title, description, and optional action slot.
 * Used at the top of every route page for consistent visual hierarchy.
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
    return (
        <div className={cn("mb-8", className)}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tight text-white">{title}</h1>
                    {description ? (
                        <p className="text-sm text-slate-400 max-w-xl leading-relaxed">{description}</p>
                    ) : null}
                </div>
                {actions ? <div className="flex items-center gap-3 flex-shrink-0">{actions}</div> : null}
            </div>
            <div className="mt-4 h-px bg-gradient-to-r from-slate-800 via-slate-700/50 to-transparent" />
        </div>
    );
}
