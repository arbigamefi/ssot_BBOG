"use client";

import * as React from "react";
import dynamic from "next/dynamic";

import { OPEN_WALLET_CONNECT_MODAL_EVENT } from "./WalletButton";

const RainbowKitConnectIsland = dynamic(
  () => import("./RainbowKitConnectIsland").then((mod) => mod.RainbowKitConnectIsland),
  { ssr: false }
);

export function WalletConnectModalHost() {
  const [requestId, setRequestId] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    window.addEventListener(
      OPEN_WALLET_CONNECT_MODAL_EVENT,
      () => setRequestId((value) => value + 1),
      { signal: controller.signal }
    );
    return () => controller.abort();
  }, []);

  return requestId > 0 ? <RainbowKitConnectIsland requestId={requestId} /> : null;
}
