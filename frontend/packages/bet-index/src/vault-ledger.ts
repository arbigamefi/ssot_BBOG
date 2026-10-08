import { isAddress, zeroAddress, type Address } from "viem";

export type VaultProviderLedgerAction = "deposit" | "withdraw" | "transfer";

function address(value: unknown): Address | undefined {
  return typeof value === "string" && isAddress(value)
    ? (value.toLowerCase() as Address)
    : undefined;
}

// viem uses number for Solidity integers of at most 48 bits, bigint for larger integers.
function integer(value: unknown): bigint | undefined {
  if (typeof value === "bigint" && value >= 0n) return value;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? BigInt(value)
    : undefined;
}

/** Vault cash events and ordinary NFT ownership transfers have distinct economic meanings. */
export function decodeVaultProviderEvent(
  vault: Address,
  eventName: string,
  args: Record<string, unknown>
) {
  if (eventName === "Transfer") {
    const from = address(args.from);
    const to = address(args.to);
    if (
      !from ||
      !to ||
      from === zeroAddress ||
      to === zeroAddress ||
      typeof args.tokenId !== "bigint"
    )
      return null;
    return {
      action: "transfer" as const,
      owner: from,
      receiver: to,
      depositId: args.tokenId,
      assets: undefined,
      caller: undefined,
      percent: undefined,
      withdrawAfter: undefined
    };
  }
  if (eventName !== "DepositAdded" && eventName !== "DepositWithdrawn") return null;
  const owner = address(args.owner);
  const depositId = integer(args.depositId);
  if (
    !owner ||
    depositId == null ||
    typeof args.assets !== "bigint" ||
    typeof args.withdrawAfter !== "bigint"
  )
    return null;
  if (eventName === "DepositAdded") {
    const payer = address(args.payer);
    if (!payer) return null;
    return {
      action: "deposit" as const,
      owner,
      caller: payer,
      receiver: vault.toLowerCase() as Address,
      depositId,
      assets: args.assets,
      withdrawAfter: args.withdrawAfter,
      percent: undefined
    };
  }
  const percent = integer(args.percent);
  if (percent == null) return null;
  return {
    action: "withdraw" as const,
    owner,
    caller: owner,
    receiver: owner,
    depositId,
    assets: args.assets,
    withdrawAfter: args.withdrawAfter,
    percent
  };
}
