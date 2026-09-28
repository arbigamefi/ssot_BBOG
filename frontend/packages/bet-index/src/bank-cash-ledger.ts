import type { Address } from "viem";

export type BankProviderLedgerAction = "deposit" | "withdraw" | "recovery" | "donation";

/** Only these cash events establish provider cash flow. A receiver equal to Bank is a donation. */
export function decodeBankProviderCashEvent(
  bank: Address,
  eventName: string,
  args: Record<string, unknown>
) {
  if (!["Deposit", "Withdraw", "RecoveryClaimed"].includes(eventName)) return null;
  const recovery = eventName === "RecoveryClaimed";
  const owner = args[recovery ? "controller" : "owner"];
  const receiver = eventName === "Deposit" ? owner : args.receiver;
  const caller = args[recovery ? "caller" : "sender"];
  if (
    typeof owner !== "string" ||
    typeof receiver !== "string" ||
    typeof caller !== "string" ||
    typeof args.assets !== "bigint" ||
    (!recovery && typeof args.shares !== "bigint") ||
    (recovery && typeof args.epochId !== "bigint")
  )
    return null;
  const action: BankProviderLedgerAction =
    receiver.toLowerCase() === bank.toLowerCase()
      ? "donation"
      : recovery
        ? "recovery"
        : eventName === "Deposit"
          ? "deposit"
          : "withdraw";
  return {
    action,
    owner: owner.toLowerCase() as Address,
    receiver: receiver.toLowerCase() as Address,
    caller: caller.toLowerCase() as Address,
    assets: args.assets,
    shares: recovery ? 0n : (args.shares as bigint),
    epochId: recovery ? (args.epochId as bigint) : undefined
  };
}
