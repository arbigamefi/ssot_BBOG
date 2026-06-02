"use client";

import * as React from "react";

import { useSSOTSDK } from "../../ssot/sdk";
import { buildShareUrl } from "./share-link";
import { SharePanel, type SharePanelLabels } from "./SharePanel";

export function ReceiptSharePanel({
  fallbackUrl,
  labels,
  text,
  title,
  triggerClassName
}: {
  fallbackUrl: string;
  labels: SharePanelLabels;
  text: string;
  title: string;
  triggerClassName?: string;
}) {
  const { sdk } = useSSOTSDK();
  const [currentHref, setCurrentHref] = React.useState(fallbackUrl);

  React.useEffect(() => {
    setCurrentHref(window.location.href);
  }, []);

  const shareUrl = React.useMemo(
    () => buildShareUrl({ href: currentHref, referrer: sdk?.account }),
    [currentHref, sdk?.account]
  );

  return (
    <SharePanel
      labels={labels}
      text={text}
      title={title}
      triggerClassName={triggerClassName}
      url={shareUrl}
    />
  );
}
