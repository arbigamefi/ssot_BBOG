import * as React from "react";

export type PageTransitionProps = {
  children: React.ReactNode;
  pageKey?: string;
  className?: string;
};

/**
 * Lightweight page wrapper. Route-level motion is intentionally CSS-only so heavy animation
 * libraries never become part of the default product route bundle.
 */
export function PageTransition({ children, pageKey, className }: PageTransitionProps) {
  return (
    <div key={pageKey} className={className}>
      {children}
    </div>
  );
}
