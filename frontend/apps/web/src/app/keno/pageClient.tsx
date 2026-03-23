"use client";

import * as React from "react";

import { encodeKenoParams } from "@ssot/ssot/encoding/keno";
import { KenoParamsForm, maskToArray } from "@ssot/ui";

import { CanonicalRoomPage } from "../../features/games/room/CanonicalRoomPage";

const KENO_DETAIL_SECTIONS = [
  {
    title: "Board-first picks",
    body: "Build the ticket directly on the board, then keep stake sizing and quote review in the side rail."
  },
  {
    title: "Packed selection",
    body: "The room keeps the packed selection readable on the stage while the encoded params stay hidden behind the functional layer."
  },
  {
    title: "Draw ledger",
    body: "Recent tickets, players, analytics, and settlement flow stay underneath the board so the room remains easy to scan."
  }
];

function describeSelection(count: number) {
  if (count <= 0) return "Pick at least one number on the board to build a valid Keno ticket.";
  if (count <= 3) return "Light selection with a tighter board footprint.";
  if (count <= 6) return "Balanced board with room to size the ticket cleanly.";
  return "Dense board coverage with a higher-variance packed selection.";
}

export default function KenoRoomPageClient() {
  const [mask, setMask] = React.useState("0");
  const selected = React.useMemo(() => maskToArray(mask), [mask]);

  return (
    <CanonicalRoomPage
      slug="keno"
      inputFingerprint={`keno:${mask}`}
      selectionSignal={{
        label: "Active board",
        value: `${selected.length} spot${selected.length === 1 ? "" : "s"}`,
        helper: describeSelection(selected.length)
      }}
      getEncodedParams={() => encodeKenoParams(BigInt(mask || "0"))}
      detailsTitle="Keno board structure"
      detailSections={KENO_DETAIL_SECTIONS}
    >
      <KenoParamsForm
        mask={mask}
        onMaskChange={setMask}
        variant="prototype"
        title="Keno"
        description="Mark the board first, then size the ticket on the rail while the room keeps the draw surface centered."
      />
    </CanonicalRoomPage>
  );
}
