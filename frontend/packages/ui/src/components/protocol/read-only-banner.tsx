import * as React from "react";

export type ReadOnlyBannerProps = {
  title: string;
  reason: string;
  details?: string[];
};

/** A carbon-deep strip under the site header: the site can be read but takes no bets. */
export function ReadOnlyBanner({ title, reason, details }: ReadOnlyBannerProps) {
  return (
    <div role="status" className="border-b border-rule-carbon bg-carbon-deep font-text text-note">
      <div className="mx-auto box-content max-w-page px-gutter py-3">
        <p className="font-semibold text-paper">{title}</p>
        <p className="text-on-carbon-muted">{reason}</p>
        {details && details.length > 0 ? (
          <ul className="mt-1 list-disc pl-4 text-on-carbon-muted">
            {details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
