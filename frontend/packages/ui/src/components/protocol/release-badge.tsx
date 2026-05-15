import * as React from "react";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

export type ReleaseBadgeProps = {
  networkName: string;
  gameHubShort: string;
  digestShort: string;
  className?: string;
};

export function ReleaseBadge({
  networkName,
  gameHubShort,
  digestShort,
  className
}: ReleaseBadgeProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Badge variant="secondary">{networkName}</Badge>
      <Badge variant="outline">GameHub {gameHubShort}</Badge>
      <Badge variant="muted">Release {digestShort}</Badge>
    </div>
  );
}
