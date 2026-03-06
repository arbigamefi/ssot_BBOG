import * as React from "react";

import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { useI18n } from "../../i18n/context";

export type ErrorCalloutProps = {
  title?: string;
  message: string;
  details?: string;
  className?: string;
};

/**
 * System-level error presentation.
 *
 * Intentionally does NOT depend on protocol/domain error types.
 * Callers should map their own errors into {message, details}.
 * Falls back to i18n "error.defaultTitle" when no title is provided.
 */
export function ErrorCallout({ title, message, details, className }: ErrorCalloutProps) {
  const { t } = useI18n();
  return (
    <Alert variant="destructive" className={className} role="alert" aria-live="polite">
      <AlertTitle>{title ?? t("error.defaultTitle")}</AlertTitle>
      <AlertDescription>
        <div className="space-y-2">
          <div>{message}</div>
          {details ? (
            <pre className="whitespace-pre-wrap rounded-md bg-black/5 p-2 text-xs leading-relaxed dark:bg-white/5">
              {details}
            </pre>
          ) : null}
        </div>
      </AlertDescription>
    </Alert>
  );
}
