import * as React from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircleIcon,
  ClipboardDocumentIcon,
  UserCircleIcon
} from "@heroicons/react/24/outline";

export function PortfolioIdentityCard({
  account,
  alias,
  saved,
  onAliasChange,
  onCopyAccount
}: {
  account?: string;
  alias: string;
  saved: boolean;
  onAliasChange: (value: string) => void;
  onCopyAccount: () => void;
}) {
  const t = useTranslations();

  return (
    <section className="rounded-md border border-border bg-surface-1 p-5 shadow-e2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
            {t("portfolio.overview.identity.eyebrow")}
          </div>
          <h2 className="mt-2 text-2xl font-black text-fg">
            {t("portfolio.overview.identity.title")}
          </h2>
        </div>
        <div className="rounded-md border border-border bg-surface-2 p-3 text-brand">
          <UserCircleIcon className="h-6 w-6" />
        </div>
      </div>

      <div className="mt-5 rounded-md border border-border bg-surface-0 p-4">
        <label
          htmlFor="player-alias"
          className="text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle"
        >
          {t("portfolio.overview.identity.playerLabel")}
        </label>
        <input
          id="player-alias"
          type="text"
          value={alias}
          onChange={(event) => onAliasChange(event.target.value)}
          placeholder={t("portfolio.overview.identity.placeholder")}
          disabled={!account}
          className="mt-3 w-full bg-transparent text-2xl font-black text-fg outline-none placeholder:text-fg-subtle disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="mt-3 flex items-center gap-2 text-xs font-bold text-fg-muted">
          {saved ? (
            <>
              <CheckCircleIcon className="h-4 w-4 text-success" />
              {t("portfolio.overview.identity.saved")}
            </>
          ) : (
            t("portfolio.overview.identity.saving")
          )}
        </div>
      </div>

      <div className="mt-4 rounded-md border border-border bg-surface-0 p-4">
        <div className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle">
          {t("portfolio.overview.identity.walletAddress")}
        </div>
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate font-mono text-sm text-fg-muted">
            {account ?? t("portfolio.overview.common.unconnected")}
          </span>
          {account ? (
            <button
              type="button"
              onClick={onCopyAccount}
              className="rounded-md border border-border bg-surface-2 p-2 text-brand transition hover:bg-surface-3"
              aria-label={t("portfolio.overview.identity.copyWalletAddress")}
            >
              <ClipboardDocumentIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
