import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  decodeEventLog,
  encodeAbiParameters,
  encodeEventTopics,
  zeroAddress,
  type Abi,
  type AbiEvent,
  type Hex
} from "viem";
import { decodeVaultProviderEvent } from "./vault-ledger.js";
import { createMemoryBetIndexStore } from "./index.js";

const abi = JSON.parse(
  readFileSync(
    new URL("../../ssot/src/abis/contracts/LiquidityVault.abi.json", import.meta.url),
    "utf8"
  )
).abi as Abi;
const VAULT = "0x1111111111111111111111111111111111111111" as const;
const OWNER = "0x2222222222222222222222222222222222222222" as const;
const PAYER = "0x3333333333333333333333333333333333333333" as const;
const ID = 2 ** 40;

function actualLog(eventName: string, args: Record<string, unknown>) {
  const event = abi.find((entry) => entry.type === "event" && entry.name === eventName) as AbiEvent;
  const inputs = event.inputs.filter((input) => !input.indexed);
  const data = encodeAbiParameters(
    inputs,
    inputs.map((input) => args[input.name!])
  );
  const topics = encodeEventTopics({ abi, eventName, args }) as [Hex, ...Hex[]];
  const decoded = decodeEventLog({ abi, data, topics });
  const values: unknown = decoded.args;
  if (!values || typeof values !== "object" || Array.isArray(values))
    throw new Error("expected named event fields");
  return { eventName: decoded.eventName!, args: values as Record<string, unknown> };
}

describe("Vault cash and NFT ownership facts", () => {
  it("decodes the actual uint48 event into a deposit with distinct payer and owner", () => {
    const log = actualLog("DepositAdded", {
      payer: PAYER,
      owner: OWNER,
      depositId: ID,
      assets: 100n,
      withdrawAfter: 86401n
    });
    expect(typeof log.args.depositId).toBe("number");
    expect(decodeVaultProviderEvent(VAULT, log.eventName!, log.args)).toEqual({
      action: "deposit",
      owner: OWNER,
      caller: PAYER,
      receiver: VAULT,
      depositId: BigInt(ID),
      assets: 100n,
      withdrawAfter: 86401n,
      percent: undefined
    });
  });

  it("decodes uint40 percentages without losing a real withdrawal or zero-value close", () => {
    for (const assets of [40n, 0n]) {
      const percent = assets === 0n ? 1000000000000 : 400000000000;
      const log = actualLog("DepositWithdrawn", {
        owner: OWNER,
        depositId: ID,
        percent,
        assets,
        withdrawAfter: 90000n
      });
      expect(typeof log.args.percent).toBe("number");
      expect(decodeVaultProviderEvent(VAULT, log.eventName!, log.args)).toMatchObject({
        action: "withdraw",
        owner: OWNER,
        caller: OWNER,
        receiver: OWNER,
        depositId: BigInt(ID),
        assets,
        percent: BigInt(percent)
      });
    }
  });

  it("records ordinary ownership transfer without inventing cash or operator, and skips mint/burn duplicates", () => {
    for (const [from, to] of [
      [PAYER, OWNER],
      [zeroAddress, OWNER],
      [OWNER, zeroAddress]
    ] as const) {
      const log = actualLog("Transfer", { from, to, tokenId: BigInt(ID) });
      const result = decodeVaultProviderEvent(VAULT, log.eventName!, log.args);
      if (from === zeroAddress || to === zeroAddress) expect(result).toBeNull();
      else
        expect(result).toMatchObject({
          action: "transfer",
          owner: PAYER,
          receiver: OWNER,
          assets: undefined,
          caller: undefined
        });
    }
  });

  it("shows transfers to both parties without counting the same event twice or crossing Vaults", async () => {
    const store = createMemoryBetIndexStore();
    const row = {
      id: "ignored",
      chainId: 31337,
      poolId: "1",
      bank: PAYER,
      vault: VAULT,
      asset: OWNER,
      owner: PAYER,
      receiver: OWNER,
      action: "transfer" as const,
      depositId: String(ID),
      txHash: "0x1234" as const,
      blockNumber: 10,
      logIndex: 1,
      updatedAt: 0
    };
    await store.writeVaultProviderLedgerRows([row, row]);
    for (const owner of [OWNER, PAYER]) {
      const rows = await store.getVaultProviderLedger({
        chainId: 31337,
        vault: VAULT,
        owner,
        limit: 10
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.assets).toBeUndefined();
    }
    expect(
      await store.getVaultProviderLedger({ chainId: 31337, vault: OWNER, owner: OWNER, limit: 10 })
    ).toEqual([]);
  });

  it("shows a gifted deposit to both payer and owner without inventing ownership or counting twice", async () => {
    const store = createMemoryBetIndexStore();
    const row = {
      id: "ignored",
      chainId: 31337,
      poolId: "1",
      bank: PAYER,
      vault: VAULT,
      asset: OWNER,
      owner: OWNER,
      caller: PAYER,
      receiver: VAULT,
      action: "deposit" as const,
      depositId: String(ID),
      assets: "100",
      txHash: "0xabcd" as const,
      blockNumber: 10,
      logIndex: 1,
      updatedAt: 0
    };
    await store.writeVaultProviderLedgerRows([row, row]);
    for (const owner of [OWNER, PAYER]) {
      expect(
        await store.getVaultProviderLedger({ chainId: 31337, vault: VAULT, owner, limit: 10 })
      ).toMatchObject([{ action: "deposit", owner: OWNER, caller: PAYER, assets: "100" }]);
    }
    expect(
      await store.getVaultProviderLedger({ chainId: 31337, vault: OWNER, owner: PAYER, limit: 10 })
    ).toEqual([]);
  });
});
