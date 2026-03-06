/**
 * Allowance / approval policy for ERC20.
 *
 * Institution-grade default:
 * - Treat approve(amount) as a SET operation (not additive).
 * - If allowance < stake => approve(stake) (exact).
 *
 * NOTE: Some tokens (e.g. USDT-style) require approve(0) before changing a non-zero allowance.
 * We do NOT assume that here because it increases tx count for well-behaved tokens.
 * When such tokens are introduced, extend the release manifest to include an approvePolicy
 * per asset and implement reset-then-approve in the pipeline.
 */
export function planExactApproval(params: {
  allowance: bigint;
  required: bigint;
}): { needsApproval: boolean; approveAmount?: bigint } {
  const { allowance, required } = params;
  if (allowance >= required) return { needsApproval: false };
  return { needsApproval: true, approveAmount: required };
}
