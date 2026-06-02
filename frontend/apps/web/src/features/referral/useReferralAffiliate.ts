"use client";

import * as React from "react";

import { readReferralAttribution, resolveReferralAffiliate } from "./referral-attribution";
import { normalizeReferralAddress } from "./referral-link";

export function useReferralAffiliate({
  account,
  referrer
}: {
  account?: string | null;
  referrer?: string | null;
}) {
  const [storedReferrer, setStoredReferrer] = React.useState(
    () => readReferralAttribution()?.referrer
  );

  React.useEffect(() => {
    const attribution = resolveReferralAffiliate({ account, referrer });
    setStoredReferrer(readReferralAttribution()?.referrer ?? attribution);
  }, [account, referrer]);

  return React.useMemo(
    () => normalizeReferralAddress(storedReferrer ?? referrer, account),
    [account, referrer, storedReferrer]
  );
}
