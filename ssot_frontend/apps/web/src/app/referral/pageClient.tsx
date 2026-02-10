"use client";

import * as React from "react";
// Using inline hex-string type to avoid importing from viem in apps/web (ESLint boundary).
type Address = `0x${string}`;

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  ErrorCallout,
  Input,
  Label,
  toast,
} from "@ssot/ui";

import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";
import { ConnectWalletPrompt } from "../../components/ConnectWalletPrompt";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

export function ReferralPageClient() {
  const { release, readOnly, readOnlyReason } = useRelease();
  const { sdk, ready } = useSSOTSDK();

  // Current referrer state
  const [currentReferrer, setCurrentReferrer] = React.useState<Address | null>(null);
  const [loadError, setLoadError] = React.useState<string | undefined>();
  const [loading, setLoading] = React.useState(false);

  // Bind form state
  const [referrerInput, setReferrerInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [formError, setFormError] = React.useState<string | undefined>();

  const hasBoundReferrer = currentReferrer != null && currentReferrer !== ZERO_ADDRESS;

  // Fetch current referrer on mount
  const fetchReferrer = React.useCallback(async () => {
    if (!sdk || !ready || !sdk.account) return;
    setLoading(true);
    setLoadError(undefined);
    try {
      const ref = await sdk.hub.referrerOf(sdk.account);
      setCurrentReferrer(ref as Address);
    } catch (e) {
      setLoadError((e as Error)?.message ?? "Failed to fetch referrer");
    } finally {
      setLoading(false);
    }
  }, [sdk, ready]);

  React.useEffect(() => {
    void fetchReferrer();
  }, [fetchReferrer]);

  // Bind referrer action
  const handleBind = React.useCallback(async () => {
    if (!sdk || !sdk.account || readOnly) return;
    setFormError(undefined);

    const trimmed = referrerInput.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      setFormError("Please enter a valid Ethereum address (0x...)");
      return;
    }

    const addr = trimmed as Address;
    if (addr.toLowerCase() === sdk.account.toLowerCase()) {
      setFormError("Cannot set yourself as your own referrer");
      return;
    }
    if (addr === ZERO_ADDRESS) {
      setFormError("Cannot bind to zero address");
      return;
    }

    setBusy(true);
    try {
      const res = await sdk.hub.bindReferrer(addr);
      if (!res.ok) {
        setFormError(res.error?.message ?? "Bind referrer failed");
        return;
      }
      toast.success("Referrer bound successfully", {
        description: `Your referrer is now ${addr.slice(0, 6)}...${addr.slice(-4)}`,
      });
      setReferrerInput("");
      // Refresh referrer
      void fetchReferrer();
    } catch (e) {
      setFormError((e as Error)?.message ?? "Transaction failed");
    } finally {
      setBusy(false);
    }
  }, [sdk, readOnly, referrerInput, fetchReferrer]);

  // No release
  if (!release) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Referral</h1>
          <p className="text-sm text-muted-foreground">
            {readOnlyReason ?? "No embedded release available."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Referral</h1>
        <p className="text-sm text-muted-foreground">
          View and manage your referrer binding. Referrers may receive XP rewards from your play.
        </p>
      </div>

      {loadError && <ErrorCallout title="Load error" message={loadError} />}

      {/* Current referrer status */}
      <Card>
        <CardHeader>
          <CardTitle>Current Referrer</CardTitle>
          <CardDescription>
            Your currently bound referrer address on the Hub contract.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!sdk?.account ? (
            <ConnectWalletPrompt action="view your referrer" />
          ) : loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : hasBoundReferrer ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium">Referrer bound</span>
              </div>
              <p className="font-mono text-sm text-muted-foreground break-all">
                {currentReferrer}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
              <span className="text-sm text-muted-foreground">No referrer bound yet</span>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void fetchReferrer()}
            disabled={loading || !sdk?.account}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </CardFooter>
      </Card>

      {/* Bind referrer form */}
      {!hasBoundReferrer && (
        <Card>
          <CardHeader>
            <CardTitle>Bind Referrer</CardTitle>
            <CardDescription>
              Enter the address of your referrer. This is a one-time action and cannot be changed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="referrer-address">Referrer Address</Label>
              <Input
                id="referrer-address"
                placeholder="0x..."
                value={referrerInput}
                onChange={(e) => setReferrerInput(e.target.value)}
                disabled={readOnly || !sdk?.account}
              />
            </div>
            {formError && <ErrorCallout title="Error" message={formError} />}
          </CardContent>
          <CardFooter>
            <Button
              onClick={() => void handleBind()}
              disabled={readOnly || busy || !referrerInput.trim() || !sdk?.account}
            >
              {busy ? "Binding..." : "Bind Referrer"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Read-only notice */}
      {readOnly && (
        <p className="text-sm text-muted-foreground">
          Read-only mode — transactions are disabled. {readOnlyReason}
        </p>
      )}
    </div>
  );
}
