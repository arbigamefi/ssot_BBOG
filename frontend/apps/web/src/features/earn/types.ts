import type { DomainBankSnapshot } from "@ssot/ssot";
import type { VaultProviderLedgerEntry } from "@ssot/ssot/sdk";

export type EarnTab = "deposit" | "withdraw";
export type EarnBankData = { snapshot: DomainBankSnapshot };
export type EarnMetric = { label: string; value: string; detail: string };
export type EarnProviderLedgerEntry = VaultProviderLedgerEntry;
export type EarnProviderLedgerAction = EarnProviderLedgerEntry["action"];
