"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

export interface CopyButtonProps {
  /** The text to copy to clipboard. */
  value: string;
  /** Extra class names on the wrapper button. */
  className?: string;
  /** Accessible label. Default: "Copy to clipboard". */
  label?: string;
}

/**
 * Small icon button that copies `value` to the clipboard on click.
 * Shows a checkmark for 1.5 s after a successful copy.
 */
export function CopyButton({ value, className, label = "Copy to clipboard" }: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API not available (e.g. insecure context)
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-muted transition-colors duration-200",
        "hover:bg-surface-2 hover:text-fg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
        className
      )}
      aria-label={label}
      title={copied ? "Copied!" : label}
      data-testid="copy-button"
    >
      {copied ? (
        <svg
          className="h-4 w-4 text-success"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
          />
        </svg>
      )}
    </button>
  );
}
