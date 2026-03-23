"use client";

import * as React from "react";

import { encodeRouletteParams } from "@ssot/ssot/encoding/roulette";
import {
  RouletteParamsForm,
  createDefaultRouletteSelection,
  summarizeRouletteSelection,
  type RouletteSelection
} from "@ssot/ui";

import { CanonicalRoomPage } from "../../features/games/room/CanonicalRoomPage";

const ROULETTE_DETAIL_SECTIONS = [
  {
    title: "Inside board",
    body: "Straight, split, street, corner, and six-line calls all start directly from the standard European table."
  },
  {
    title: "Outside rail",
    body: "Dozen, column, red, black, odd, even, low, and high stay available as wider coverage calls."
  },
  {
    title: "Ledger path",
    body: "Review the ticket on the rail, then keep the room ledger, analytics, and settlement flow underneath the table."
  }
];

function mapRouletteSelectionToInput(selection: RouletteSelection) {
  if (selection.kind !== "bitmask") return selection;

  const normalized = selection.mask.trim();
  return {
    kind: "bitmask" as const,
    mask: normalized ? BigInt(normalized) : 0n
  };
}

export default function RouletteRoomPageClient() {
  const [selection, setSelection] = React.useState<RouletteSelection>(
    createDefaultRouletteSelection()
  );
  const summary = React.useMemo(() => summarizeRouletteSelection(selection), [selection]);

  return (
    <CanonicalRoomPage
      slug="roulette"
      inputFingerprint={JSON.stringify(selection)}
      selectionSignal={{
        label: summary.family,
        value: summary.display,
        helper: summary.helper
      }}
      getEncodedParams={() => encodeRouletteParams(mapRouletteSelectionToInput(selection))}
      detailsTitle="European table structure"
      detailSections={ROULETTE_DETAIL_SECTIONS}
    >
      <RouletteParamsForm
        selection={selection}
        onChange={setSelection}
        variant="prototype"
        title="European roulette"
        description="Standard 0-36 table. Pick the board first, then size the ticket on the rail."
      />
    </CanonicalRoomPage>
  );
}
