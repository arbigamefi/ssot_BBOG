"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { isCasinoRiskInEnabledForChain } from "./casino-access";

export function CasinoAvailabilityNotice({ chainId }: { chainId?: number }) {
  const t = useTranslations("casino.availability");
  const pathname = usePathname();
  if (!chainId || isCasinoRiskInEnabledForChain(chainId)) return null;
  if (pathname !== "/casino" && !/^\/casino\/[^/]+$/.test(pathname)) return null;
  return (
    <aside
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-soft bg-surface-2 p-4"
      aria-label={t("title")}
    >
      <div>
        <p className="text-sm font-semibold text-fg">{t("title")}</p>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-fg-muted">{t("description")}</p>
      </div>
      <Link
        href={`${pathname}?chainId=84532`}
        className="inline-flex min-h-11 items-center rounded-lg border border-brand/30 px-4 text-sm font-semibold text-brand hover:bg-brand-soft"
      >
        {t("tryTestnet")}
      </Link>
    </aside>
  );
}
