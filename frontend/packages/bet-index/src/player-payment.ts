import { decodeEventLog, isAddressEqual, parseAbi, type Address, type Hex } from "viem";

/** Historical evidence from the terminal transaction, never the current aggregate claim balance. */
export type PlayerPaymentProof =
  | { status: "unknown"; amount?: string }
  /** Full payoutNet + refundAmount, in asset base units. */
  | { status: "transferred" | "payable" | "none"; amount: string };

export const PLAYER_PAYMENT_ABI = parseAbi([
  "event BetReserveReleased(uint256 indexed betId, address indexed player, uint256 reserved)",
  "event BetSettled(uint256 indexed betId, address indexed player, uint256 payoutGross, uint256 payoutNet, uint256 refundAmount, uint256 feeOnPayout, uint256 protocolFeeAccrual, uint256 xpAccrued, uint256 xpLocked, uint256 xpHoldback)",
  "event BetRefunded(uint256 indexed betId, address indexed player, uint256 refundAmount)",
  "event PlayerPayableCreated(uint256 indexed betId, address indexed player, uint256 amount)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
]);

/** Use the complete, ordered logs of the successful terminal transaction. Missing evidence stays unknown. */
export function extractPlayerPaymentProof({
  logs,
  bank,
  asset,
  player,
  betId,
  amount
}: {
  logs: readonly { address: Address; data: Hex; topics: readonly Hex[] }[];
  bank: Address;
  asset: Address;
  player: Address;
  betId: bigint;
  amount: bigint;
}): PlayerPaymentProof {
  const unknown = { status: "unknown" as const, amount: amount.toString() };
  if (amount === 0n) return { ...unknown, status: "none" };
  if (amount < 0n) return unknown;
  const decoded = logs.flatMap((log, index) => {
    try {
      if (!isAddressEqual(log.address, bank) && !isAddressEqual(log.address, asset)) return [];
      const event = decodeEventLog({
        abi: PLAYER_PAYMENT_ABI,
        data: log.data,
        topics: [...log.topics] as [Hex, ...Hex[]],
        strict: true
      });
      return [{ ...event, address: log.address, index }];
    } catch {
      return [];
    }
  });
  const matching = decoded.filter(
    (event) =>
      isAddressEqual(event.address, bank) &&
      "betId" in event.args &&
      event.args.betId === betId &&
      isAddressEqual(event.args.player, player)
  );
  const releases = matching.filter((event) => event.eventName === "BetReserveReleased");
  const terminals = matching.filter(
    (event) => event.eventName === "BetSettled" || event.eventName === "BetRefunded"
  );
  if (releases.length !== 1 || terminals.length !== 1) return unknown;
  const start = releases[0]!.index;
  const terminal = terminals[0]!;
  if (start >= terminal.index) return unknown;
  const terminalAmount =
    terminal.eventName === "BetSettled"
      ? terminal.args.payoutNet + terminal.args.refundAmount
      : terminal.eventName === "BetRefunded"
        ? terminal.args.refundAmount
        : undefined;
  if (terminalAmount !== amount) return unknown;
  const inPayment = decoded.filter((event) => event.index > start && event.index < terminal.index);
  const payables = inPayment.filter(
    (event) =>
      event.eventName === "PlayerPayableCreated" &&
      isAddressEqual(event.address, bank) &&
      event.args.betId === betId &&
      isAddressEqual(event.args.player, player)
  );
  if (payables.length) {
    const payable = payables[0]!;
    return payables.length === 1 &&
      payable.eventName === "PlayerPayableCreated" &&
      payable.args.amount === amount
      ? { ...unknown, status: "payable" }
      : unknown;
  }
  const transfers = inPayment.filter(
    (event) =>
      event.eventName === "Transfer" &&
      isAddressEqual(event.address, asset) &&
      isAddressEqual(event.args.from, bank) &&
      isAddressEqual(event.args.to, player)
  );
  const transfer = transfers[0];
  return transfers.length === 1 &&
    transfer?.eventName === "Transfer" &&
    transfer.args.value === amount
    ? { ...unknown, status: "transferred" }
    : unknown;
}
