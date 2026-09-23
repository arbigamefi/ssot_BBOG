export type CasinoFinancialRow = {
  state?: string;
  stake?: string | bigint | number;
  payout?: string | bigint | number;
  refundAmount?: string | bigint | number;
};

function unsigned(value: CasinoFinancialRow["stake"]): bigint | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "number" && !Number.isSafeInteger(value)) return undefined;
  try {
    const parsed = BigInt(value);
    return parsed >= 0n ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** Financial facts are complete only when the unused-stake refund is proven. */
export function getCasinoFinancials(row: CasinoFinancialRow) {
  if (row.state !== "finalized" && row.state !== "refunded") return undefined;
  const stake = unsigned(row.stake);
  const refund = unsigned(row.refundAmount);
  const award = row.state === "refunded" ? 0n : unsigned(row.payout);
  if (stake == null || refund == null || award == null || refund > stake) return undefined;
  return {
    stake,
    refund,
    award,
    returned: award + refund,
    net: award + refund - stake,
    turnover: row.state === "refunded" ? 0n : stake - refund
  };
}

export function getCasinoCashReturned(row: CasinoFinancialRow): bigint | undefined {
  return getCasinoFinancials(row)?.returned;
}
