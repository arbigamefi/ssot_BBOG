"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ssot/ui";

import { useRelease } from "../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../ssot/sdk";

export function SDKStatusCard() {
  const rel = useRelease();
  const { sdk, ready, readOnly } = useSSOTSDK();
  const [fee, setFee] = React.useState<bigint | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setErr(null);
      setFee(null);
      if (!sdk || readOnly) return;
      try {
        const q = await sdk.hub.quoteVRFFee(1);
        if (alive) setFee(q);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [sdk, readOnly]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>SDK Wiring (Milestone B)</CardTitle>
        <CardDescription>
          Wagmi providers feed viem clients into the SSOT SDK. Feature code stays protocol-agnostic.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div>
          <span className="text-muted-foreground">ChainId:</span> {rel.chainId}
        </div>
        <div>
          <span className="text-muted-foreground">Release loaded:</span>{" "}
          {rel.release ? "yes" : "no"}
        </div>
        <div>
          <span className="text-muted-foreground">SDK ready:</span> {ready ? "yes" : "no"}
        </div>
        <div>
          <span className="text-muted-foreground">Write mode:</span>{" "}
          {readOnly ? "read-only" : "enabled"}
        </div>
        <div>
          <span className="text-muted-foreground">Sportsbook entry:</span>{" "}
          {rel.sportsbook.enabled ? "enabled" : "disabled"}
        </div>
        {!rel.sportsbook.enabled && rel.sportsbook.disabledReason ? (
          <div className="text-muted-foreground">{rel.sportsbook.disabledReason}</div>
        ) : null}
        {!readOnly && fee !== null && (
          <div>
            <span className="text-muted-foreground">quoteVRFFee(1):</span> {fee.toString()}
          </div>
        )}
        {err && <div className="text-destructive">{err}</div>}
        {readOnly && (
          <div className="text-muted-foreground">
            Replace the embedded release snapshot with a real release bundle to enable writes.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
