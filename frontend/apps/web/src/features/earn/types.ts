import type { DomainBankPosition, DomainBankSnapshot } from "@ssot/ssot";

export type EarnTab = "deposit" | "withdraw" | "redeem";

export type EarnBankData = {
  snapshot: DomainBankSnapshot;
  position: DomainBankPosition | null;
};

export type EarnMetric = {
  label: string;
  value: string;
  detail: string;
};
