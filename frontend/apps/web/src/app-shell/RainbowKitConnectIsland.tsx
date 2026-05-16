"use client";

import * as React from "react";
import { ConnectButton, RainbowKitProvider } from "@rainbow-me/rainbowkit/components";

export function RainbowKitConnectIsland({ requestId }: { requestId: number }) {
  return (
    <RainbowKitProvider
      appInfo={{ appName: "ArbiGameFi" }}
      modalSize="compact"
      showRecentTransactions={false}
    >
      <ConnectButton.Custom>
        {({ connectModalOpen, mounted, openConnectModal }) => (
          <RainbowKitConnectTrigger
            connectModalOpen={connectModalOpen}
            mounted={mounted}
            openConnectModal={openConnectModal}
            requestId={requestId}
          />
        )}
      </ConnectButton.Custom>
    </RainbowKitProvider>
  );
}

function RainbowKitConnectTrigger({
  connectModalOpen,
  mounted,
  openConnectModal,
  requestId
}: {
  connectModalOpen: boolean;
  mounted: boolean;
  openConnectModal: () => void;
  requestId: number;
}) {
  const lastOpenedRequest = React.useRef(0);

  React.useEffect(() => {
    if (!mounted || connectModalOpen || lastOpenedRequest.current === requestId) return;
    lastOpenedRequest.current = requestId;
    openConnectModal();
  }, [connectModalOpen, mounted, openConnectModal, requestId]);

  return null;
}
