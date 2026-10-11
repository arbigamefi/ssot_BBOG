import { describe, expect, it } from "vitest";
import { encodeFunctionData, getAddress, keccak256, toBytes, toFunctionSelector } from "viem";
import { getContractAbis } from "../abis/index.mjs";
import fixture from "../fixtures/release-v16.fixture.json";
import { ReleaseSchema } from "../release/schema";
import { decodeGovernanceCall, TIMELOCK_ROLE_NAMES } from "./governance";

const release = ReleaseSchema.parse(fixture);
const abis = getContractAbis();
const TIMELOCK = release.contracts.governanceTimelock;
const SAFE = "0x00000000000000000000000000000000000000bb" as const;
const GAME = release.gamesMeta[0]!.gameId as `0x${string}`;
const decode = (target: string, data: `0x${string}`) =>
  decodeGovernanceCall(release, target as `0x${string}`, data);

describe("decodeGovernanceCall", () => {
  it.each([
    {
      target: release.contracts.poolRegistry,
      abi: abis.PoolRegistryAbi,
      functionName: "setPoolActive",
      args: [1n, true],
      contract: { name: "PoolRegistry" },
      signature: "setPoolActive(uint64,bool)",
      decoded: [
        { name: "poolId", type: "uint64", value: 1n },
        { name: "active", type: "bool", value: true }
      ]
    },
    {
      target: release.contracts.gameHub,
      abi: abis.GameHubAbi,
      functionName: "disableGame",
      args: [GAME],
      contract: { name: "GameHub" },
      signature: "disableGame(bytes32)",
      decoded: [{ name: "gameId", type: "bytes32", value: GAME }]
    },
    {
      target: release.pools[0]!.bank,
      abi: abis.BankAbi,
      functionName: "setRiskInPaused",
      args: [false],
      contract: { name: "Bank", poolId: 1 },
      signature: "setRiskInPaused(bool)",
      decoded: [{ name: "paused_", type: "bool", value: false }]
    },
    {
      target: release.contracts.refRegistry,
      abi: abis.ReferralRegistryAbi,
      functionName: "setBinderOnce",
      args: [getAddress(release.contracts.gameHub)],
      contract: { name: "ReferralRegistry" },
      signature: "setBinderOnce(address)",
      decoded: [{ name: "b", type: "address", value: getAddress(release.contracts.gameHub) }]
    },
    {
      target: TIMELOCK,
      abi: abis.GovernanceTimelockAbi,
      functionName: "updateDelay",
      args: [345_600n],
      contract: { name: "GovernanceTimelock" },
      signature: "updateDelay(uint256)",
      decoded: [{ name: "newDelay", type: "uint256", value: 345_600n }]
    }
  ])(
    "names $contract.name and decodes $functionName",
    ({ target, abi, functionName, args, contract, signature, decoded }) => {
      const data = encodeFunctionData({ abi, functionName, args });
      expect(decode(target, data)).toEqual({
        target: getAddress(target),
        contract,
        selector: data.slice(0, 10),
        function: { name: functionName, signature, args: decoded }
      });
    }
  );

  it("names timelock roles in grantRole and revokeRole", () => {
    const proposer = keccak256(toBytes("PROPOSER_ROLE"));
    const data = encodeFunctionData({
      abi: abis.GovernanceTimelockAbi,
      functionName: "grantRole",
      args: [proposer, SAFE]
    });
    const call = decode(TIMELOCK, data);
    expect(call.function?.args[0]).toEqual({ name: "role", type: "bytes32", value: proposer });
    expect(TIMELOCK_ROLE_NAMES[call.function!.args[0]!.value as `0x${string}`]).toBe(
      "PROPOSER_ROLE"
    );
    expect(Object.values(TIMELOCK_ROLE_NAMES).sort()).toEqual([
      "CANCELLER_ROLE",
      "DEFAULT_ADMIN_ROLE",
      "EXECUTOR_ROLE",
      "PROPOSER_ROLE"
    ]);
    expect(TIMELOCK_ROLE_NAMES[`0x${"0".repeat(64)}`]).toBe("DEFAULT_ADMIN_ROLE");
  });

  it("decodes a call without arguments from its bare selector", () => {
    const data = encodeFunctionData({ abi: abis.BankAbi, functionName: "acceptGovernance" });
    expect(decode(release.pools[0]!.bank.toUpperCase().replace("0X", "0x"), data)).toMatchObject({
      contract: { name: "Bank", poolId: 1 },
      function: { name: "acceptGovernance", signature: "acceptGovernance()", args: [] }
    });
  });

  it("keeps only the selector for an unknown target, function or argument encoding", () => {
    const setPoolActive = encodeFunctionData({
      abi: abis.PoolRegistryAbi,
      functionName: "setPoolActive",
      args: [1n, false]
    });
    // A release Vault has no governance surface, so it is not a named target.
    expect(decode(release.pools[0]!.vault, setPoolActive)).toEqual({
      target: getAddress(release.pools[0]!.vault),
      contract: { name: "unknown" },
      selector: setPoolActive.slice(0, 10)
    });
    // A GameHub selector sent to the PoolRegistry decodes with no function.
    const disable = encodeFunctionData({
      abi: abis.GameHubAbi,
      functionName: "disableGame",
      args: [GAME]
    });
    expect(decode(release.contracts.poolRegistry, disable)).toEqual({
      target: getAddress(release.contracts.poolRegistry),
      contract: { name: "PoolRegistry" },
      selector: disable.slice(0, 10)
    });
    // Truncated arguments: the selector is known, the call is not shown as decoded.
    expect(
      decode(release.contracts.poolRegistry, setPoolActive.slice(0, 40) as `0x${string}`)
    ).toEqual({
      target: getAddress(release.contracts.poolRegistry),
      contract: { name: "PoolRegistry" },
      selector: toFunctionSelector("setPoolActive(uint64,bool)")
    });
    expect(decode(TIMELOCK, "0x")).toEqual({
      target: getAddress(TIMELOCK),
      contract: { name: "GovernanceTimelock" }
    });
  });

  it("matches selectors case-insensitively and rejects non-hex data", () => {
    const data = encodeFunctionData({
      abi: abis.PoolRegistryAbi,
      functionName: "setPoolActive",
      args: [1n, true]
    });
    expect(
      decode(release.contracts.poolRegistry, `0x${data.slice(2).toUpperCase()}`).function?.name
    ).toBe("setPoolActive");
    expect(() => decode(release.contracts.poolRegistry, "0xzz" as `0x${string}`)).toThrow(
      TypeError
    );
  });
});
