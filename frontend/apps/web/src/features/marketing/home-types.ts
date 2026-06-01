import type { Address } from "@ssot/ssot/sdk";
import type { CatalogRoom } from "../casino/catalog";

export type AssetOverview = {
  address: Address;
  symbol: string;
  decimals: number;
  totalAssets: bigint;
  totalReserved: bigint;
};

export type LandingActivity = {
  id: string;
  player: string;
  game: string;
  state: string;
  time: string;
  /** Formatted payout, e.g. "25.00 USDC" — empty when not yet settled. */
  payout?: string;
  /** Win multiplier, e.g. "2.50×" — present only for winning settled bets. */
  multiplier?: string;
  /** True when the bet settled with payout > stake (drives win styling). */
  isWin?: boolean;
};

export type LandingStat = {
  label: string;
  value: string;
  detail: string;
};

export type LandingRoom = CatalogRoom;
