"use client";

import { useTranslations } from "next-intl";

export function LoadingSportsbook() {
  const t = useTranslations();

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-sm text-fg-muted">{t("sportsbook.index.loading")}</p>
    </div>
  );
}
