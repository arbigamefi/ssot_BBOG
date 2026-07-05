import { createPublicClient, defineChain, getAddress, parseAbi, webSocket } from "viem";

import type { SSOTRelease } from "../release/schema";

const GAME_HUB_ROUND_EVENTS_ABI = parseAbi([
  "event BetRandomReady(uint256 indexed positionId, uint256 indexed requestId, bytes32 randomHash)",
  "event BetFinalized(uint256 indexed positionId, uint256 payoutGross, uint256 payoutNet, uint256 feeOnPayout, uint256 protocolFeeAccrual)",
  "event BetRefunded(uint256 indexed positionId, uint256 refundAmount)"
]);

export function gameHubRoundEventMatchesBet(
  log: { args?: Record<string, unknown> },
  betId: bigint
) {
  const positionId = log.args?.positionId;
  if (positionId == null) return false;
  try {
    return BigInt(positionId as bigint | number | string) === betId;
  } catch {
    return false;
  }
}

export function watchGameHubRoundEvents({
  release,
  wsUrl,
  betId,
  onRoundEvent,
  onError
}: {
  release: SSOTRelease;
  wsUrl: string;
  betId: bigint;
  onRoundEvent: () => void;
  onError?: (error: Error) => void;
}) {
  const httpFallbackUrl = wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
  const chain = defineChain({
    id: release.chainId,
    name: `Chain ${release.chainId}`,
    nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
    rpcUrls: { default: { http: [httpFallbackUrl], webSocket: [wsUrl] } }
  });
  const eventClient = createPublicClient({ chain, transport: webSocket(wsUrl) });

  return eventClient.watchContractEvent({
    address: getAddress(release.contracts.gameHub),
    abi: GAME_HUB_ROUND_EVENTS_ABI,
    onLogs: (logs) => {
      if (logs.some((log) => gameHubRoundEventMatchesBet(log, betId))) onRoundEvent();
    },
    onError
  });
}
