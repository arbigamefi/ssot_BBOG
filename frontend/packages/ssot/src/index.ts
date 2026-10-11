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
  DomainDepositPosition,
  DomainDepositWithdrawalQuote,
  DomainDepositPage,
  DepositCursor,
  LPStatus,
  DomainXPBuckets
} from "./domain";

// Flat re-exports of commonly used SDK types
export type {
  PlaceBetInput,
  PlaceBetPlan,
  ExecutePlanResult,
  TxStep,
  GameHubTerminalProof,
  GameHubSettlementProof,
  GameHubRefundProof,
  GameHubVoidProof,
  VoidStatus,
  VoidBetResult,
  PlayerPaymentProof,
  ReconcilePlaceBetTxResult,
  BindPlaceBetTxResult,
  SSOTGameHubAPI,
  SSOTBankAPI,
  SSOTLiquidityVaultAPI,
  VaultProviderLedgerEntry,
  GameConfig,
  SSOTVRFHubAPI,
  SSOTReferralAPI,
  SSOTGovernanceAPI,
  DecodedGovernanceCall,
  GovernanceContract,
  GovernanceCallArgument,
  Address,
  Hex
} from "./sdk";

export type { TxResult } from "./sdk/types";
