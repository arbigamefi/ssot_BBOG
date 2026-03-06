import * as React from "react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { ShieldAlert } from "lucide-react";

export type ReadOnlyBannerProps = {
  reason: string;
  details?: string[];
};

export function ReadOnlyBanner({ reason, details }: ReadOnlyBannerProps) {
  return (
    <Alert variant="warning">
      <ShieldAlert size={18} />
      <AlertTitle>Read-only mode</AlertTitle>
      <AlertDescription>
        <p>{reason}</p>
        {details && details.length > 0 ? (
          <ul className="mt-2 list-disc pl-4">
            {details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
