"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "@ssot/ui";

import { useCompliance } from "./ComplianceProvider";

/**
 * Reality-check reminder. When the player has set a session reminder cadence,
 * we surface a toast every N minutes telling them how long they've been
 * playing — a standard responsible-gambling nudge. The session clock resets
 * on mount (each page load starts a fresh session).
 */
export function RealityCheckTimer() {
  const t = useTranslations("compliance.realityCheck");
  const { hydrated, limits } = useCompliance();
  const minutes = limits.sessionReminderMinutes ?? 0;
  const sessionStartRef = React.useRef<number>(Date.now());

  React.useEffect(() => {
    if (!hydrated || !minutes || minutes <= 0) return;
    const intervalMs = minutes * 60 * 1000;
    const id = window.setInterval(() => {
      const elapsedMin = Math.round((Date.now() - sessionStartRef.current) / 60000);
      toast.warning(t("message", { minutes: elapsedMin }), { duration: 8000 });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [hydrated, minutes, t]);

  return null;
}
