import { getAddress, type Address, type PublicClient } from "viem";
import { BANK_KEEPER_ABI, LIQUIDITY_VAULT_KEEPER_ABI } from "./abi.js";
import type { UnknownBlockGrace } from "./block-grace.js";
import { describeError } from "./errors.js";
import type { PoolHealth } from "./health.js";
import type { VaultProviderLedgerPool } from "./vault-provider-ledger.js";

// ILiquidityVaultBank.LPStatus: Ready, Busy, UnbookedResult, InvalidAccounting, Unavailable, CoolingDown,
// NoLiquidity. A pause is not an LP status: it closes new deposits only.
const LP_BUSY = 1;
const LP_UNBOOKED_RESULT = 2;
const LP_INVALID_ACCOUNTING = 3;
const LP_UNAVAILABLE = 4;

/**
 * Observe both custodians at one block. NFT maturity requires no keeper write. With `grace`, a read
 * that reaches a node without that block is reported only once it has persisted for five minutes.
 */
export async function readPoolHealth(
  pool: VaultProviderLedgerPool,
  client: Pick<PublicClient, "getBlock" | "readContract">,
  grace?: UnknownBlockGrace
): Promise<PoolHealth> {
  const result: PoolHealth = { bank: pool.bank, vault: pool.vault };
  try {
    const block = await client.getBlock();
    if (block.number == null) throw new Error("Pool accounting requires a numbered block");
    result.observedBlock = block.number.toString();
    const request = { address: pool.bank, abi: BANK_KEEPER_ABI, blockNumber: block.number };
    const [ssot, open, max, min, vault, binding, asset, lp] = (await Promise.all([
      client.readContract({ ...request, functionName: "getSSOT" }),
      client.readContract({ ...request, functionName: "openHolds" }),
      client.readContract({ ...request, functionName: "MAX_OPEN_HOLDS" }),
      client.readContract({ ...request, functionName: "minBetAmount" }),
      client.readContract({ ...request, functionName: "vault" }),
      client.readContract({
        address: pool.vault,
        abi: LIQUIDITY_VAULT_KEEPER_ABI,
        functionName: "bank",
        blockNumber: block.number
      }),
      client.readContract({
        address: pool.vault,
        abi: LIQUIDITY_VAULT_KEEPER_ABI,
        functionName: "asset",
        blockNumber: block.number
      }),
      client.readContract({ ...request, functionName: "lpAccounting" })
    ])) as [
      Record<
        "bankCash" | "vaultCash" | "L" | "P" | "R" | "K" | "G" | "PF" | "XP" | "PP",
        bigint
      > & { accountingValid: boolean; riskInPaused: boolean },
      bigint,
      bigint,
      bigint,
      Address,
      Address,
      Address,
      [bigint, bigint, number]
    ];
    if (
      getAddress(vault) !== getAddress(pool.vault) ||
      getAddress(binding) !== getAddress(pool.bank) ||
      getAddress(asset) !== getAddress(pool.asset)
    )
      throw new Error("Release Bank/Vault/asset binding mismatch");
    for (const key of ["bankCash", "vaultCash", "L", "P", "R", "K", "G", "PF", "XP", "PP"] as const)
      result[key] = ssot[key].toString();
    result.openHolds = open.toString();
    result.maxOpenHolds = max.toString();
    result.capacityHeadroom = (open < max ? max - open : 0n).toString();
    result.minBetAmount = min.toString();
    result.accountingValid = ssot.accountingValid;
    result.paused = ssot.riskInPaused;
    result.lpStatus = Number(lp[2]);
    if (!ssot.accountingValid) result.error = "Bank/Vault accounting invariant failed";
    else if (result.lpStatus === LP_UNBOOKED_RESULT)
      result.error = "Canonical VRF result awaits accounting";
    else if (
      result.lpStatus === LP_BUSY ||
      result.lpStatus === LP_INVALID_ACCOUNTING ||
      result.lpStatus === LP_UNAVAILABLE
    )
      result.error = `LP accounting unavailable (status ${result.lpStatus})`;
    grace?.succeed(pool.bank);
  } catch (error) {
    if (!grace || grace.report(pool.bank, error)) result.error = describeError(error);
    else {
      result.transientError = describeError(error);
      result.transientSince = new Date(grace.since(pool.bank)!).toISOString();
    }
  }
  return result;
}
