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
          <h1 className="text-2xl font-bold tracking-tight text-fg md:text-3xl">{title}</h1>
          {description ? (
            <p className="max-w-xl text-sm leading-relaxed text-fg-muted">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-shrink-0 items-center gap-3">{actions}</div> : null}
      </div>
      <div className="mt-4 border-b border-border-soft" />
    </div>
  );
}
