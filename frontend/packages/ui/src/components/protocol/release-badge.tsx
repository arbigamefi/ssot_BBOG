import * as React from "react";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

export type ReleaseBadgeProps = {
  networkName: string;
  hubShort: string;
  digestShort: string;
  className?: string;
};

export function ReleaseBadge({ networkName, hubShort, digestShort, className }: ReleaseBadgeProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Badge variant="secondary">{networkName}</Badge>
      <Badge variant="outline">Hub {hubShort}</Badge>
      <Badge variant="muted">Release {digestShort}</Badge>
    </div>
  );
}
