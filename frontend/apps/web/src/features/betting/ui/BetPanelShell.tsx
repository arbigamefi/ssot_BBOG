"use client";

import * as React from "react";
import Link from "next/link";

import type { DomainError } from "@ssot/ssot";
import { Alert, AlertDescription, AlertTitle, Button, Card, CardContent, CardHeader, CardTitle, ErrorCallout, Input, Label, TxStatusChip, TxStepper } from "@ssot/ui";

import type { BetStepperState } from "../model/stepperMachine";

export type BetPanelShellProps = {
  title: string;
  description?: string;
  state: BetStepperState;
  onPlan: () => void;
  onExecute: () => void;

  /** Retry reconcile for mined-but-unreconciled txs. */
  onReconcile?: () => void;
  /** Manual bind betId for mined-but-unreconciled txs. */
  onBind?: (betId: bigint) => void;

  reconciling?: boolean;
  binding?: boolean;

  onReset: () => void;
  children?: React.ReactNode;
};

function mapErrorMessage(err?: DomainError): { message: string; details?: string } | null {
  if (!err) return null;
  const details = err.details
    ? JSON.stringify(err.details, (_key, value) => (typeof value === "bigint" ? value.toString() : value), 2)
    : undefined;
  return { message: err.message, details };
}

export function BetPanelShell({ title, description, state, onPlan, onExecute, onReconcile, onBind, reconciling, binding, onReset, children }: BetPanelShellProps) {
  const plan = state.plan;
  const needsApproval = plan?.preview.needsApproval ?? true;
  const status = state.status;

  const txHash = state.result?.placeBetTx?.txHash;
  const minedButUnreconciled = status === "mined" && Boolean(state.result?.placeBetTx?.ok);

  const [manualBetId, setManualBetId] = React.useState<string>("");
  const parsedManualBetId = React.useMemo(() => {
    const raw = manualBetId.trim();
    if (!raw) return null;
    try {
      // accept both decimal and 0x-prefixed
      return BigInt(raw);
    } catch {
      return null;
    }
  }, [manualBetId]);

  const error = mapErrorMessage(state.error);

  const steps = React.useMemo(() => {
    const approveState = (() => {
      if (!plan) return "todo" as const;
      if (!needsApproval) return "done" as const;
      if (status === "planning" || status === "needs-approval") return "active" as const;
      if (status === "failed") return "todo" as const;
      // submitting/mined/reconciled -> approve presumed done
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
        title: "Approve",
        description: "Authorize Bank to transfer stake",
        state: approveState,
      },
      {
        title: "Place bet",
        description: "Hub.placeBet (payable)",
        state: placeState,
      },
    ];
  }, [needsApproval, plan, status]);

  const footer = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onPlan} disabled={status === "planning" || status === "submitting"}>
          {status === "planning" ? "Planning…" : "Plan"}
        </Button>
        <Button
          variant="secondary"
          onClick={onExecute}
          disabled={!plan || status === "planning" || status === "submitting"}
        >
          Execute
        </Button>
        <Button variant="ghost" onClick={onReset}>
          Reset
        </Button>

        {status === "reconciled" && state.betId !== undefined ? (
          <Button asChild variant="outline" className="ml-auto">
            <Link href={`/bets/${state.betId.toString()}`}>View bet</Link>
          </Button>
        ) : null}
      </div>

      {minedButUnreconciled ? (
        <div className="space-y-2">
          <Alert variant="warning">
            <AlertTitle>Mined but not reconciled</AlertTitle>
            <AlertDescription>
              <p className="text-sm">
                The transaction is mined, but the app could not extract a <span className="font-mono">betId</span> yet.
              </p>
              {txHash ? (
                <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                  txHash: {txHash}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                Try <span className="font-medium text-foreground">Retry reconcile</span>. If you already know the betId, you can bind it manually.
              </p>
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap items-end gap-2">
            <Button
              variant="secondary"
              onClick={() => onReconcile?.()}
              disabled={!onReconcile || Boolean(reconciling)}
            >
              {reconciling ? "Reconciling…" : "Retry reconcile"}
            </Button>

            <div className="min-w-[220px] flex-1 space-y-1">
              <Label htmlFor="manual-betid">Bet ID</Label>
              <Input
                id="manual-betid"
                placeholder="e.g. 12345"
                value={manualBetId}
                onChange={(e) => setManualBetId(e.target.value)}
              />
              <div className="text-xs text-muted-foreground">
                Accepts decimal or <span className="font-mono">0x</span>-prefixed.
              </div>
            </div>

            <Button
              onClick={() => {
                if (!parsedManualBetId) return;
                onBind?.(parsedManualBetId);
              }}
              disabled={!onBind || Boolean(binding) || !parsedManualBetId}
            >
              {binding ? "Binding…" : "Bind betId"}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            If this keeps failing, go to <Link className="underline" href="/bets">Bets</Link> and click <span className="font-medium text-foreground">Sync</span> to refresh local facts.
          </div>
        </div>
      ) : null}
    </div>
  );


  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className={`relative overflow-hidden transition-all duration-300 border backdrop-blur-3xl shadow-2xl ${status === "submitting" || status === "mined"
        ? "border-emerald-500/50 shadow-emerald-900/40 bg-slate-900/80 animate-pulse"
        : "border-slate-800 shadow-indigo-900/20 bg-slate-900/60 hover:border-slate-700"
        }`}>
        <CardHeader className="border-b border-white/5 pb-4">
          <CardTitle className="flex items-center justify-between gap-3">
            <span className="text-2xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
              {title}
            </span>
            <TxStatusChip status={status} />
          </CardTitle>
          {description ? <div className="text-sm font-medium text-muted-foreground/80 mt-2">{description}</div> : null}
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {children ? <div className="space-y-4">{children}</div> : null}

          {plan ? (
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5 text-sm shadow-inner relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[50px] pointer-events-none" />
              <div className="mb-4 font-bold tracking-wider text-primary uppercase text-xs">Plan preview</div>
              <div className="space-y-3 relative z-10">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground font-medium">VRF fee</span>
                  <span className="font-mono text-white tracking-widest">{plan.preview.vrfFee.toString()}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground font-medium">Stake</span>
                  <span className="font-mono text-white tracking-widest">{plan.preview.stake.toString()}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground font-medium">Allowance</span>
                  <span className="font-mono text-white tracking-widest">{plan.preview.allowance.toString()}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground font-medium">Needs approval</span>
                  <span className={`font-bold ${plan.preview.needsApproval ? 'text-secondary' : 'text-primary'}`}>{plan.preview.needsApproval ? "Yes" : "No"}</span>
                </div>
                {plan.preview.approveAmount !== undefined ? (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground font-medium">Approve amount</span>
                    <span className="font-mono text-white tracking-widest">{plan.preview.approveAmount.toString()}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-4 pt-4 mt-2 border-t border-white/5">
                  <span className="text-muted-foreground font-medium">Release digest</span>
                  <span className="font-mono text-xs text-muted-foreground/50">{plan.releaseDigest.slice(0, 10)}…</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm text-muted-foreground">
              Click <span className="font-bold text-primary neon-text-primary">Plan</span> to compute VRF fee and required steps.
            </div>
          )}

          {error ? <ErrorCallout title="Error" message={error.message} details={error.details} /> : null}
        </CardContent>
      </Card>

      <div className={`relative overflow-hidden rounded-2xl p-1 transition-all duration-300 ${status === "submitting" ? "animate-pulse" : ""}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-slate-900/50 to-emerald-500/10 backdrop-blur-xl" />
        <div className="relative bg-slate-950/80 border border-slate-800 shadow-2xl rounded-xl h-full backdrop-blur-2xl">
          <TxStepper title="Transaction Trace" subtitle="On-Chain State Machine" steps={steps} footer={footer} />
        </div>
      </div>
    </div>
  );
}
