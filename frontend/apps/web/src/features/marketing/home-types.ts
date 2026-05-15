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
};

export type LandingStat = {
  label: string;
  value: string;
  detail: string;
};

export type LandingRoom = CatalogRoom;
