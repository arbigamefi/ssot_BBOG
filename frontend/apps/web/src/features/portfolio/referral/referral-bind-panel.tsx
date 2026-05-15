import * as React from "react";
import { CheckCircleIcon, ClipboardDocumentIcon } from "@heroicons/react/24/outline";

import { shortHex } from "./format";
import { ReferralActionTrace } from "./referral-action-trace";
import type { ReferralFlowState } from "./types";

export function ReferralBindPanel({
  connected,
  readOnly,
  hasBoundReferrer,
  currentReferrer,
  referralLink,
  referrerInput,
  formError,
  flow,
  explorerBaseUrl,
  onReferrerInputChange,
  onBind,
  onCopyLink
}: {
  connected: boolean;
  readOnly: boolean;
  hasBoundReferrer: boolean;
  currentReferrer?: string;
  referralLink?: string;
  referrerInput: string;
  formError?: string;
  flow: ReferralFlowState;
  explorerBaseUrl?: string;
  onReferrerInputChange: (value: string) => void;
  onBind: () => void;
  onCopyLink: () => void;
}) {
  const disabled = readOnly || !connected || flow.busy || !referrerInput.trim();

  return (
    <section className="rounded-md border border-border bg-surface-1 shadow-e2">
      <div className="border-b border-border p-5">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
          Execution
        </div>
        <h2 className="mt-2 text-2xl font-black text-fg">Referral transaction console</h2>
      </div>

      <div className="grid gap-5 p-5">
        <div className="rounded-md border border-border bg-surface-0 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle">
                Affiliate link
              </div>
              <p className="mt-2 text-sm leading-6 text-fg-muted">
                Share this link with players after the wallet is connected.
              </p>
            </div>
            <ClipboardDocumentIcon className="h-5 w-5 text-brand" />
          </div>

          {referralLink ? (
            <div className="mt-4 flex items-center gap-3 rounded-md border border-border-soft bg-surface-2 p-3">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg-muted">
                {referralLink}
              </span>
              <button
                type="button"
                onClick={onCopyLink}
                className="shrink-0 rounded-md bg-brand px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-fg-inverse transition hover:bg-brand-hover"
              >
                Copy
              </button>
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-dashed border-border bg-surface-2 p-4 text-sm text-fg-muted">
              Connect a wallet to generate and bind referral state.
            </div>
          )}
        </div>

        <div className="rounded-md border border-border bg-surface-0 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle">
            Upstream binding
          </div>

          {!connected ? (
            <p className="mt-3 text-sm leading-6 text-fg-muted">
              Connect a wallet to bind a referrer.
            </p>
          ) : hasBoundReferrer ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-success/30 bg-success-soft p-4">
              <div className="flex items-center gap-3">
                <CheckCircleIcon className="h-5 w-5 text-success" />
                <span className="text-sm font-bold text-fg">Bound referrer</span>
              </div>
              <span className="font-mono text-sm font-black text-success">
                {shortHex(currentReferrer)}
              </span>
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              <label className="sr-only" htmlFor="referrer-address">
                Referrer address
              </label>
              <input
                id="referrer-address"
                value={referrerInput}
                onChange={(event) => onReferrerInputChange(event.target.value)}
                placeholder="0x... referrer address"
                disabled={readOnly || flow.busy}
                spellCheck={false}
                className="h-12 rounded-md border border-border bg-surface-2 px-4 font-mono text-sm text-fg outline-none transition placeholder:text-fg-subtle focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {formError ? <p className="text-xs font-bold text-danger">{formError}</p> : null}
              <button
                type="button"
                onClick={onBind}
                disabled={disabled}
                className="rounded-md bg-brand px-5 py-4 text-sm font-black uppercase tracking-[0.12em] text-fg-inverse shadow-glow transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {flow.busy ? "Binding" : "Bind referrer"}
              </button>
            </div>
          )}

          {readOnly ? (
            <div className="mt-4 rounded-md border border-warn/30 bg-warn-soft p-3 text-sm text-warn">
              Writes are disabled for this release.
            </div>
          ) : null}
        </div>

        <ReferralActionTrace flow={flow} explorerBaseUrl={explorerBaseUrl} />
      </div>
    </section>
  );
}
