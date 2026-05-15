// Namespaced re-exports (original)
export * as release from "./release";
export * as domain from "./domain";
export * as sdk from "./sdk";
export * as encoding from "./encoding";

// Flat re-exports of commonly used domain types so that
// `import type { DomainError } from "@ssot/ssot"` works.
export type {
  DomainError,
  DomainBet,
  DomainBankSnapshot,
  DomainBankPosition,
  DomainSportsMarket,
  DomainSportsTicket,
  DomainSportsResult,
  DomainXPBuckets
} from "./domain";

// Flat re-exports of commonly used SDK types
export type {
  PlaceBetInput,
  PlaceBetPlan,
  ExecutePlanResult,
  TxStep,
  ReconcilePlaceBetTxResult,
  BindPlaceBetTxResult,
  SSOTGameHubAPI,
  SSOTBankAPI,
  SSOTVRFHubAPI,
  SSOTSportsHubAPI,
  Address,
  Hex
} from "./sdk";

export type { TxResult } from "./sdk/types";
