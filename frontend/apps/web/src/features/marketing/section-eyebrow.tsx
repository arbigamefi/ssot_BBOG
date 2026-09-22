import * as React from "react";

import { cn } from "@ssot/ui";

/**
 * The eyebrow that sits above a marketing section heading.
 *
 * Five sections had grown five copies of the same 130-character class string.
 * That is how they drifted into three different bottom margins, and how the
 * room directory ended up rendering plain brand text at a different size and
 * tracking than the pill every section around it used.
 *
 * Appearance lives here. The caller still owns its own spacing: the gap that
 * works under a 72px hero headline is not the gap that works under a 48px
 * section heading, so margin stays a decision at the call site.
 */
export function SectionEyebrow({
  size = "section",
  className,
  children
}: {
  size?: "hero" | "section";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-soft px-3 py-1.5 font-bold uppercase tracking-[0.18em] text-brand",
        size === "hero" ? "text-xs shadow-e1" : "text-[10px]",
        className
      )}
    >
      {children}
    </div>
  );
}
