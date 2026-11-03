import * as React from "react";
import { cn } from "@ssot/ui";

import type { SignedAmount } from "./receipts";

/**
 * A figure the printer prints, in Doto. Doto's own decimal point is a single dot that
 * disappears at small sizes, so the point is set in the text face.
 */
export function PrintedFigure({
  value,
  suffix,
  className
}: {
  value: SignedAmount;
  suffix?: string;
  className?: string;
}) {
  return (
    <span className={cn("font-print font-extrabold tabular-nums", className)}>
      {value.sign}
      {value.whole}
      {value.fraction ? (
        <>
          <span className="font-text font-semibold">.</span>
          {value.fraction}
        </>
      ) : null}
      {suffix}
    </span>
  );
}
