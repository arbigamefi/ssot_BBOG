"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { captureReferralAttribution } from "./referral-attribution";

function ReferralAttributionCaptureInner() {
  const searchParams = useSearchParams();
  const referrer = searchParams.get("ref");

  React.useEffect(() => {
    captureReferralAttribution({ referrer });
  }, [referrer]);

  return null;
}

export function ReferralAttributionCapture() {
  return (
    <React.Suspense fallback={null}>
      <ReferralAttributionCaptureInner />
    </React.Suspense>
  );
}
