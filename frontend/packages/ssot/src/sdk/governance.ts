import {
  decodeAbiParameters,
  getAddress,
  isHex,
  keccak256,
  size,
  slice,
  toBytes,
  toFunctionSelector,
  toFunctionSignature,
  type Abi,
  type AbiFunction,
  type Address,
  type Hex
} from "viem";
import type { SSOTRelease } from "../release/schema";
import { getContractAbis } from "../abis/index.mjs";

/** The contract a governance call targets, identified by address only (ADR-0037 §2, §3). */
export type GovernanceContract =
  | { name: "PoolRegistry" }
  | { name: "GameHub" }
  | { name: "Bank"; poolId: number }
  | { name: "ReferralRegistry" }
  | { name: "GovernanceTimelock" }
  | { name: "unknown" };

export interface GovernanceCallArgument {
  name: string;
  type: string;
  value: unknown;
}

export interface DecodedGovernanceCall {
  target: Address;
  contract: GovernanceContract;
  /** First four bytes of the call data; absent when the data is shorter. */
  selector?: Hex;
  /**
   * Present only when the target is known and the selector and arguments decode with its generated
   * ABI. An unknown target, an unknown selector or malformed arguments leave it absent.
   */
  function?: {
    name: string;
    /** Canonical signature, for example "setPoolActive(uint64,bool)". */
    signature: string;
    args: GovernanceCallArgument[];
  };
}

/** OpenZeppelin TimelockController role identifiers, so callers can name a grantRole or revokeRole argument. */
export const TIMELOCK_ROLE_NAMES: Readonly<Record<Hex, string>> = Object.freeze({
  [`0x${"0".repeat(64)}`]: "DEFAULT_ADMIN_ROLE",
  [keccak256(toBytes("PROPOSER_ROLE"))]: "PROPOSER_ROLE",
  [keccak256(toBytes("EXECUTOR_ROLE"))]: "EXECUTOR_ROLE",
  [keccak256(toBytes("CANCELLER_ROLE"))]: "CANCELLER_ROLE"
});

type KnownContract = Exclude<GovernanceContract["name"], "unknown">;

const { PoolRegistryAbi, GameHubAbi, BankAbi, ReferralRegistryAbi, GovernanceTimelockAbi } =
  getContractAbis();
const ABIS: Record<KnownContract, Abi> = {
  PoolRegistry: PoolRegistryAbi,
  GameHub: GameHubAbi,
  Bank: BankAbi,
  ReferralRegistry: ReferralRegistryAbi,
  GovernanceTimelock: GovernanceTimelockAbi
};
const selectorIndexes = new Map<KnownContract, Map<Hex, AbiFunction>>();

function functionBySelector(contract: KnownContract, selector: Hex) {
  let index = selectorIndexes.get(contract);
  if (!index) {
    index = new Map();
    for (const item of ABIS[contract]) {
      if (item.type === "function") index.set(toFunctionSelector(item), item);
    }
    selectorIndexes.set(contract, index);
  }
  return index.get(selector);
}

function identify(release: SSOTRelease, target: Address, timelock: Address): GovernanceContract {
  if (target === getAddress(timelock)) return { name: "GovernanceTimelock" };
  if (target === getAddress(release.contracts.poolRegistry)) return { name: "PoolRegistry" };
  if (target === getAddress(release.contracts.gameHub)) return { name: "GameHub" };
  if (target === getAddress(release.contracts.refRegistry)) return { name: "ReferralRegistry" };
  const pool = release.pools.find((item) => getAddress(item.bank) === target);
  return pool ? { name: "Bank", poolId: pool.poolId } : { name: "unknown" };
}

/**
 * Names the target of one timelock call (a CallScheduled target and data) and decodes it with the
 * generated ABI. Pure: the release manifest does not carry the timelock until A11, so the caller
 * passes it, for example from `sdk.governance.getTimelock()` or the emitter of the indexed event.
 */
export function decodeGovernanceCall(
  release: SSOTRelease,
  target: Address,
  data: Hex,
  { timelock }: { timelock: Address }
): DecodedGovernanceCall {
  if (!isHex(data, { strict: true })) throw new TypeError("Governance call data must be hex.");
  const normalized = getAddress(target);
  const contract = identify(release, normalized, timelock);
  if (size(data) < 4) return { target: normalized, contract };
  const selector = slice(data, 0, 4).toLowerCase() as Hex;
  if (contract.name === "unknown") return { target: normalized, contract, selector };
  const fn = functionBySelector(contract.name, selector);
  if (!fn) return { target: normalized, contract, selector };
  let values: readonly unknown[];
  try {
    values = decodeAbiParameters(fn.inputs, size(data) === 4 ? "0x" : slice(data, 4));
  } catch {
    return { target: normalized, contract, selector };
  }
  return {
    target: normalized,
    contract,
    selector,
    function: {
      name: fn.name,
      signature: toFunctionSignature(fn),
      args: fn.inputs.map((input, index) => ({
        name: input.name ?? "",
        type: input.type,
        value: values[index]
      }))
    }
  };
}
