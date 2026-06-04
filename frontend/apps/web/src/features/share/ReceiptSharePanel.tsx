"use client";

import * as React from "react";

import { useSSOTSDK } from "../../ssot/sdk";
import { buildShareUrl } from "./share-link";
import { SharePanel, type SharePanelLabels } from "./SharePanel";

export function ReceiptSharePanel({
  fallbackUrl,
  labels,
  proof,
  text,
  title,
  triggerClassName
}: {
  fallbackUrl: string;
  labels: SharePanelLabels;
  proof?: string;
  text: string;
  title: string;
  triggerClassName?: string;
}) {
  const { sdk } = useSSOTSDK();
  const [currentHref, setCurrentHref] = React.useState(fallbackUrl);

  React.useEffect(() => {
    setCurrentHref(new URL(fallbackUrl, window.location.origin).toString());
  }, [fallbackUrl]);

  const shareUrl = React.useMemo(
    () => buildShareUrl({ href: currentHref, referrer: sdk?.account }),
    [currentHref, sdk?.account]
  );

  return (
    <SharePanel
      labels={labels}
      proof={proof}
      text={text}
      title={title}
      triggerClassName={triggerClassName}
      url={shareUrl}
    />
  );
}
