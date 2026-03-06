import * as React from "react";

import { Badge } from "../ui/badge";

export type TxStatus = "idle" | "planning" | "needs-approval" | "ready" | "submitting" | "mined" | "reconciled" | "failed";

const LABEL: Record<TxStatus, string> = {
  idle: "Idle",
  planning: "Planning",
  "needs-approval": "Needs approval",
  ready: "Ready",
  submitting: "Submitting",
  mined: "Mined",
  reconciled: "Reconciled",
  failed: "Failed",
};

export function TxStatusChip({ status, className }: { status: TxStatus; className?: string }) {
  const variant: React.ComponentProps<typeof Badge>["variant"] = status === "failed" ? "destructive" : "secondary";
  return (
    <Badge variant={variant} className={className}>
      {LABEL[status]}
    </Badge>
  );
}
