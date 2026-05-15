import * as React from "react";

import { CoinSideSelector, KenoSelectionPanel, RouletteSelectionPanel } from "./controls";
import type { GameMeta } from "./model";
import type { CoinSide } from "./params";

export function GameSelectionControls({
  game,
  coinSide,
  onCoinSideChange,
  rouletteSpots,
  onRouletteClear,
  kenoSpots,
  onKenoChange,
  onKenoResetResult
}: {
  game: GameMeta;
  coinSide: CoinSide;
  onCoinSideChange: (side: CoinSide) => void;
  rouletteSpots: readonly string[];
  onRouletteClear: () => void;
  kenoSpots: readonly number[];
  onKenoChange: (spots: number[]) => void;
  onKenoResetResult: () => void;
}) {
  if (game.slug === "roulette") {
    return <RouletteSelectionPanel spots={rouletteSpots} onClear={onRouletteClear} />;
  }

  if (game.slug === "coin-toss") {
    return <CoinSideSelector coinSide={coinSide} onChange={onCoinSideChange} />;
  }

  if (game.slug === "keno") {
    return (
      <KenoSelectionPanel
        spots={kenoSpots}
        onChange={onKenoChange}
        onResetResult={onKenoResetResult}
      />
    );
  }

  return null;
}
