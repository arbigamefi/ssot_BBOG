"use client";

import * as React from "react";

import { encodeDiceParams } from "@ssot/ssot/encoding/dice";
import { DiceParamsForm } from "@ssot/ui";

import { CanonicalRoomPage } from "../../features/games/room/CanonicalRoomPage";

const DICE_DETAIL_SECTIONS = [
  {
    title: "Cap-driven odds",
    body: "Move the cap to choose how aggressive the lane should be before the ticket is priced."
  },
  {
    title: "Compact rail",
    body: "Amount, repeats, quote review, and approval stay on one side rail instead of splitting across the page."
  },
  {
    title: "Readable ledger",
    body: "Recent tickets, player activity, and room intelligence stay underneath the gameplay stage."
  }
];

function summarizeRisk(cap: number) {
  if (cap <= 10) return "High-risk lane";
  if (cap <= 35) return "Aggressive lane";
  if (cap <= 70) return "Balanced lane";
  return "Safer lane";
}

export default function DiceRoomPageClient() {
  const [cap, setCap] = React.useState("50");
  const capNumber = Number(cap) || 0;

  return (
    <CanonicalRoomPage
      slug="dice"
      inputFingerprint={`dice:${cap}`}
      selectionSignal={{
        label: "Active lane",
        value: `${cap}% under`,
        helper: summarizeRisk(capNumber)
      }}
      getEncodedParams={() => encodeDiceParams(capNumber)}
      detailsTitle="Dice lane structure"
      detailSections={DICE_DETAIL_SECTIONS}
    >
      <DiceParamsForm
        cap={cap}
        onCapChange={setCap}
        variant="prototype"
        title="Dice"
        description="Choose the cap first, then size the ticket on the rail without leaving the stage."
      />
    </CanonicalRoomPage>
  );
}
