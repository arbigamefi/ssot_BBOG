"use client";

import * as React from "react";
import Link from "next/link";

import type { DomainError } from "@ssot/ssot";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorCallout,
  Input,
  Label,
  TxStatusChip,
  TxStepper,
} from "@ssot/ui";

import type { BetStepperState } from "../model/stepperMachine";

export type BetPanelShellProps = {
  state: BetStepperState;
  onReconcile?: () => void;
  onBind?: (betId: bigint) => void;
  reconciling?: boolean;
  binding?: boolean;
  onReset: () => void;
};

function mapErrorMessage(err?: DomainError): { message: string; details?: string } | null {
  if (!err) return null;
  const details = err.details
    ? JSON.stringify(err.details, (_key, value) => (typeof value === "bigint" ? value.toString() : value), 2)
    : undefined;
  return { message: err.message, details };
}

export function BetPanelShell({
  state,
  onReconcile,
  onBind,
  reconciling,
  binding,
  onReset,
}: BetPanelShellProps) {
  const plan = state.plan;
  const needsApproval = plan?.preview.needsApproval ?? true;
  const status = state.status;
  const txHash = state.result?.placeBetTx?.txHash;
  const minedButUnreconciled = status === "mined" && Boolean(state.result?.placeBetTx?.ok);
  const error = mapErrorMessage(state.error);

  const [manualBetId, setManualBetId] = React.useState<string>("");
  const parsedManualBetId = React.useMemo(() => {
    const raw = manualBetId.trim();
    if (!raw) return null;
    try {
      return BigInt(raw);
    } catch {
      return null;
    }
  }, [manualBetId]);

  const steps = React.useMemo(() => {
    const approveState = (() => {
      if (!plan) return "todo" as const;
      if (!needsApproval) return "done" as const;
      if (status === "planning" || status === "needs-approval") return "active" as const;
      if (status === "failed") return "todo" as const;
      return "done" as const;
    })();

    const placeState = (() => {
      if (!plan) return "todo" as const;
      if (status === "ready") return "active" as const;
      if (status === "submitting") return "active" as const;
      if (status === "mined" || status === "reconciled") return "done" as const;
      if (status === "failed") return plan ? "error" as const : "todo" as const;
      return "todo" as const;
    })();

    return [
      {
        title: "Review quote",
        description: "Check the exact spend, fee, and allowance state before signing.",
        state: plan ? ("done" as const) : status === "planning" ? ("active" as const) : ("todo" as const),
      },
      {
        title: "Approve stake",
        description: "Authorize the Bank only if the current allowance is too low.",
        state: approveState,
      },
      {
        title: "Place bet",
        description: "Submit the payable Hub.placeBet call and wait for reconciliation.",
        state: placeState,
      },
    ];
  }, [needsApproval, plan, status]);

  const footer = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={onReset}>
          Reset flow
        </Button>

        {status === "reconciled" && state.betId !== undefined ? (
          <Button asChild variant="outline" className="ml-auto">
            <Link href={`/bets/${state.betId.toString()}`}>Open bet</Link>
          </Button>
        ) : null}
      </div>

      {minedButUnreconciled ? (
        <div className="space-y-3">
          <Alert variant="warning">
            <AlertTitle>Mined, waiting for bet ID</AlertTitle>
            <AlertDescription>
              The transaction landed on-chain, but the UI still needs to reconcile it into a stable bet record.
            </AlertDescription>
          </Alert>

          <div className="grid gap-3 md:grid-cols-[auto_minmax(220px,1fr)_auto]">
            <Button variant="secondary" onClick={() => onReconcile?.()} disabled={!onReconcile || Boolean(reconciling)}>
              {reconciling ? "Reconciling..." : "Retry reconcile"}
            </Button>

            <div className="space-y-1">
              <Label htmlFor="manual-betid">Manual bet ID</Label>
              <Input
                id="manual-betid"
                placeholder="e.g. 12345"
                value={manualBetId}
                onChange={(event) => setManualBetId(event.target.value)}
              />
              <div className="text-xs text-muted-foreground">Accepts decimal or 0x-prefixed values.</div>
            </div>

            <Button
              onClick={() => {
                if (!parsedManualBetId) return;
                onBind?.(parsedManualBetId);
              }}
              disabled={!onBind || Boolean(binding) || !parsedManualBetId}
            >
              {binding ? "Binding..." : "Bind bet"}
            </Button>
          </div>

          {txHash ? <div className="text-xs font-mono text-slate-500">txHash: {txHash}</div> : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.92fr)_minmax(0,1.08fr)]">
      <Card className="border-slate-800 bg-slate-900/60 shadow-xl shadow-slate-950/30">
        <CardHeader className="border-b border-white/5 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bet review</div>
              <CardTitle className="text-xl font-black tracking-tight text-white">Quote and execution facts</CardTitle>
              <div className="text-sm leading-6 text-slate-400">
                This panel only shows numbers coming from the current plan. Nothing here is decorative.
              </div>
            </div>
            <TxStatusChip status={status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          {plan ? (
            <div className="space-y-3 rounded-[1.5rem] border border-white/10 bg-black/30 p-5 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">Stake</span>
                <span className="font-mono text-white">{plan.preview.stake.toString()}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">VRF fee</span>
                <span className="font-mono text-white">{plan.preview.vrfFee.toString()}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">Allowance</span>
                <span className="font-mono text-white">{plan.preview.allowance.toString()}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">Approval required</span>
                <span className={plan.preview.needsApproval ? "font-semibold text-amber-300" : "font-semibold text-emerald-300"}>
                  {plan.preview.needsApproval ? "Yes" : "No"}
                </span>
              </div>
              {plan.preview.approveAmount !== undefined ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400">Approve amount</span>
                  <span className="font-mono text-white">{plan.preview.approveAmount.toString()}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-4 border-t border-white/5 pt-4">
                <span className="text-slate-400">Release digest</span>
                <span className="font-mono text-xs text-slate-300">{plan.releaseDigest.slice(0, 10)}...</span>
              </div>
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-black/20 p-6 text-sm leading-6 text-slate-400">
              Use the main action button to generate the quote. Once planned, this area will show the exact spend and fee before any wallet signature.
            </div>
          )}

          {error ? <ErrorCallout title="Bet flow error" message={error.message} details={error.details} /> : null}
        </CardContent>
      </Card>

      <TxStepper
        title="Transaction flow"
        subtitle="The UI stays simple, but the on-chain process remains explicit and auditable."
        steps={steps}
        footer={footer}
        className={`border-slate-800 bg-slate-900/60 shadow-xl shadow-slate-950/30 ${status === "submitting" ? "animate-pulse" : ""}`}
      />
    </div>
  );
}
