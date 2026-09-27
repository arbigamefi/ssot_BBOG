/**
 * The page of one casino bet's receipt.
 *
 * Bet ids restart at 1 in every GameHub deployment, so the link names the hub
 * that issued the bet and keeps pointing at it after a new release. A link
 * without a hub reads the chain's active release.
 */
export function buildReceiptPath({
  betId,
  chainId,
  gameHub
}: {
  betId: bigint | string;
  chainId: number;
  gameHub?: string | null;
}) {
  const path = `/casino/receipt/${chainId}/${betId.toString()}`;
  return gameHub ? `${path}?hub=${gameHub.toLowerCase()}` : path;
}
