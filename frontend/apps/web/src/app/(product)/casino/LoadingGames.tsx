"use client";

import { useTranslations } from "next-intl";

export function LoadingGames() {
  const t = useTranslations();

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-sm text-fg-muted">{t("casino.directory.loading")}</p>
    </div>
  );
}
