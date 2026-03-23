"use client";

import * as React from "react";

import { encodeCoinTossParams } from "@ssot/ssot/encoding/cointoss";
import { CoinTossParamsForm, type CoinTossSide } from "@ssot/ui";

import { CanonicalRoomPage } from "../../features/games/room/CanonicalRoomPage";

const COINTOSS_DETAIL_SECTIONS = [
  {
    title: "Binary call",
    body: "Pick one face, keep the ticket simple, and use the rail to review stake, quote, and approval before sending."
  },
  {
    title: "Fast room loop",
    body: "This room is intentionally compact. Face selection stays on the stage while the rail handles sizing and execution."
  },
  {
    title: "Readable ledger",
    body: "Recent tickets, player activity, and settlement traces remain underneath the room instead of interrupting the gameplay surface."
  }
];

export default function CoinTossRoomPageClient() {
  const [side, setSide] = React.useState<CoinTossSide>("heads");

  return (
    <CanonicalRoomPage
      slug="coin-toss"
      inputFingerprint={`coin-toss:${side}`}
      selectionSignal={{
        label: "Active face",
        value: side === "heads" ? "Heads" : "Tails",
        helper: "One binary pick stays active on the stage while the rail handles the ticket."
      }}
      getEncodedParams={() => encodeCoinTossParams(side === "heads")}
      detailsTitle="Coin toss structure"
      detailSections={COINTOSS_DETAIL_SECTIONS}
    >
      <CoinTossParamsForm
        side={side}
        onSideChange={setSide}
        variant="prototype"
        title="Coin toss"
        description="Pick heads or tails on the stage, then size the ticket on the rail without leaving the room."
      />
    </CanonicalRoomPage>
  );
}
