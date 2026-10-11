import { randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createMemoryBetIndexStore,
  createPostgresBetIndexStoreFromSql,
  governanceTimelockOperationState,
  type BetIndexStore,
  type GovernanceTimelockEvent
} from "./index.js";

const url = process.env.KEEPER_TEST_POSTGRES_URL;
if (url && !["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname)) {
  throw new Error("KEEPER_TEST_POSTGRES_URL must target a local disposable PostgreSQL instance");
}

const chainId = 8453;
// Mixed case on purpose: the index stores lowercase hex.
const timelock = "0x00000000000000000000000000000000000000Ee" as const;
const otherTimelock = "0x00000000000000000000000000000000000000Ef" as const;
const registry = "0x0000000000000000000000000000000000000066" as const;
const hub = "0x0000000000000000000000000000000000000064" as const;
const ZERO = `0x${"00".repeat(32)}` as const;
const DELAY = 259_200n;
const opA = `0x${"a1".repeat(32)}` as const;
const opB = `0x${"b2".repeat(32)}` as const;
const opC = `0x${"c3".repeat(32)}` as const;
const saltB = `0x${"5b".repeat(32)}` as const;
const saltC = `0x${"5c".repeat(32)}` as const;
const tx = (block: number) => `0x${block.toString(16).padStart(64, "0")}` as const;
// Block n is mined at 1,000,000 s + 10 s per block, so readyAt is easy to check.
const seconds = (block: number) => 1_000_000 + (block - 100) * 10;

function log(
  block: number,
  logIndex: number,
  eventName: GovernanceTimelockEvent["eventName"],
  args: Record<string, unknown>,
  overrides: Partial<GovernanceTimelockEvent> = {}
): GovernanceTimelockEvent {
  return {
    chainId,
    timelock,
    blockNumber: BigInt(block),
    blockTimestamp: seconds(block) * 1000,
    txHash: tx(block),
    logIndex,
    eventName,
    args,
    ...overrides
  };
}

const scheduled = (
  block: number,
  logIndex: number,
  id: `0x${string}`,
  index: number,
  target: `0x${string}`,
  value = 0n,
  data: `0x${string}` = "0x1234abcd"
) =>
  log(block, logIndex, "CallScheduled", {
    id,
    index: BigInt(index),
    target,
    value,
    data,
    predecessor: ZERO,
    delay: DELAY
  });

const constructorDelay = log(50, 3, "MinDelayChange", { oldDuration: 0n, newDuration: DELAY });
const scheduleA = scheduled(100, 0, opA, 0, registry);
const scheduleB = [
  scheduled(101, 0, opB, 0, hub, 0n, "0x"),
  scheduled(101, 1, opB, 1, registry, 5n, "0xdeadbeef"),
  log(101, 2, "CallSalt", { id: opB, salt: saltB })
];
const scheduleC = [
  scheduled(102, 0, opC, 0, hub),
  log(102, 1, "CallSalt", { id: opC, salt: saltC })
];
const cancelC = log(110, 0, "Cancelled", { id: opC });
const executeB = [
  log(200, 4, "CallExecuted", { id: opB, index: 0n, target: hub, value: 0n, data: "0x" }),
  log(200, 5, "CallExecuted", {
    id: opB,
    index: 1n,
    target: registry,
    value: 5n,
    data: "0xdeadbeef"
  })
];
// The guardian cancelled opC; the Safe schedules the identical call again, so the id repeats.
const rescheduleC = [
  scheduled(210, 7, opC, 0, hub),
  log(210, 8, "CallSalt", { id: opC, salt: saltC })
];
const raiseDelay = log(220, 0, "MinDelayChange", { oldDuration: DELAY, newDuration: 345_600n });
const history = [
  constructorDelay,
  scheduleA,
  ...scheduleB,
  ...scheduleC,
  cancelC,
  ...executeB,
  ...rescheduleC,
  raiseDelay
];

for (const backend of ["memory", "postgres"] as const) {
  describe.skipIf(backend === "postgres" && !url)(`${backend} governance timelock index`, () => {
    let store: BetIndexStore;
    let second: BetIndexStore;
    let admin: Sql | undefined;
    const connections: Sql[] = [];
    const schema = `governance_${randomUUID().replaceAll("-", "")}`;
    const connect = () => {
      const sql = postgres(url!, {
        transform: postgres.camel,
        onnotice: () => undefined,
        connection: { search_path: schema }
      });
      connections.push(sql);
      return createPostgresBetIndexStoreFromSql(sql);
    };
    beforeAll(async () => {
      if (backend !== "postgres") return;
      admin = postgres(url!, { onnotice: () => undefined });
      await admin.unsafe(`create schema "${schema}"`);
      store = connect();
      second = connect();
      await Promise.all([store.initializeSchema(), second.initializeSchema()]);
    });
    beforeEach(async () => {
      if (backend === "memory") {
        store = createMemoryBetIndexStore();
        second = store;
      } else {
        await admin!.unsafe(
          `truncate "${schema}".governance_timelock_operations, "${schema}".governance_timelock_delay_changes`
        );
      }
    });
    afterAll(async () => {
      await Promise.allSettled(connections.map((sql) => sql.end()));
      await admin?.unsafe(`drop schema if exists "${schema}" cascade`);
      await admin?.end();
    });

    const operations = (now: number, pendingOnly = false, limit?: number) =>
      second.getGovernanceTimelockOperations({ chainId, timelock, now, pendingOnly, limit });

    it("follows schedule, salt, batch execution, cancellation and a later reschedule of the same id", async () => {
      await store.writeGovernanceTimelockEvents([constructorDelay, scheduleA, ...scheduleB]);
      await store.writeGovernanceTimelockEvents([...scheduleC, cancelC]);
      const beforeReady = seconds(100) * 1000;
      expect(await operations(beforeReady)).toEqual([
        {
          chainId,
          timelock: timelock.toLowerCase(),
          operationId: opA,
          index: 0,
          target: registry,
          value: "0",
          data: "0x1234abcd",
          predecessor: ZERO,
          salt: ZERO,
          delay: "259200",
          scheduledBlock: 100,
          scheduledTxHash: tx(100),
          scheduledAt: seconds(100) * 1000,
          readyAt: String(seconds(100) + 259_200),
          state: "waiting"
        },
        expect.objectContaining({
          operationId: opB,
          index: 0,
          target: hub,
          data: "0x",
          salt: saltB
        }),
        expect.objectContaining({
          operationId: opB,
          index: 1,
          value: "5",
          data: "0xdeadbeef",
          salt: saltB,
          state: "waiting"
        }),
        expect.objectContaining({
          operationId: opC,
          salt: saltC,
          scheduledBlock: 102,
          cancelledBlock: 110,
          cancelledTxHash: tx(110),
          state: "cancelled"
        })
      ]);

      await store.writeGovernanceTimelockEvents([...executeB, ...rescheduleC, raiseDelay]);
      const rows = await operations(beforeReady);
      expect(rows.map((row) => [row.operationId, row.index, row.state])).toEqual([
        [opA, 0, "waiting"],
        [opB, 0, "executed"],
        [opB, 1, "executed"],
        [opC, 0, "waiting"]
      ]);
      expect(rows[1]).toMatchObject({ executedBlock: 200, executedTxHash: tx(200) });
      expect(rows[2]).toMatchObject({ executedBlock: 200, executedTxHash: tx(200) });
      // The reschedule replaces the cancelled schedule; the cancellation belonged to the earlier one.
      expect(rows[3]).toMatchObject({
        scheduledBlock: 210,
        scheduledTxHash: tx(210),
        readyAt: String(seconds(210) + 259_200),
        salt: saltC
      });
      expect(rows[3]?.cancelledBlock).toBeUndefined();
      expect(rows[3]?.cancelledTxHash).toBeUndefined();
      expect(
        await second.getGovernanceTimelockDelayChanges({
          chainId,
          timelock: timelock.toLowerCase() as `0x${string}`
        })
      ).toEqual([
        {
          chainId,
          timelock: timelock.toLowerCase(),
          blockNumber: 50,
          blockTimestamp: seconds(50) * 1000,
          txHash: tx(50),
          logIndex: 3,
          oldDuration: "0",
          newDuration: "259200"
        },
        expect.objectContaining({ blockNumber: 220, oldDuration: "259200", newDuration: "345600" })
      ]);

      // Replaying the whole range, or only its older part, changes nothing.
      const snapshot = await operations(beforeReady);
      await store.writeGovernanceTimelockEvents(history);
      await store.writeGovernanceTimelockEvents([...scheduleC, cancelC]);
      expect(await operations(beforeReady)).toEqual(snapshot);
      expect(await second.getGovernanceTimelockDelayChanges({ chainId, timelock })).toHaveLength(2);
    });

    it("derives waiting and ready from the query clock and lists only pending operations on request", async () => {
      await store.writeGovernanceTimelockEvents(history);
      const readyAtA = (seconds(100) + 259_200) * 1000;
      expect((await operations(readyAtA - 1))[0]?.state).toBe("waiting");
      expect((await operations(readyAtA))[0]?.state).toBe("ready");
      expect((await operations(readyAtA, true)).map((row) => [row.operationId, row.state])).toEqual(
        [
          [opA, "ready"],
          [opC, "waiting"]
        ]
      );
      expect((await operations(readyAtA, false, 2)).map((row) => row.index)).toEqual([0, 0]);
      expect((await operations(readyAtA, true, 1)).map((row) => row.operationId)).toEqual([opA]);
      expect(
        governanceTimelockOperationState(
          { readyAt: "10", executedBlock: 1, cancelledBlock: undefined },
          0
        )
      ).toBe("executed");
    });

    it("scopes operations by chain and timelock", async () => {
      await store.writeGovernanceTimelockEvents([
        scheduleA,
        { ...scheduled(105, 0, opB, 0, hub), timelock: otherTimelock },
        { ...scheduled(106, 0, opC, 0, hub), chainId: 84532 }
      ]);
      expect((await operations(0)).map((row) => row.operationId)).toEqual([opA]);
      expect(
        (
          await second.getGovernanceTimelockOperations({ chainId, timelock: otherTimelock, now: 0 })
        ).map((row) => row.operationId)
      ).toEqual([opB]);
      expect(
        await second.getGovernanceTimelockOperations({ chainId: 84532, timelock, now: 0 })
      ).toHaveLength(1);
    });

    it.each([
      ["a schedule without its block time", { ...scheduleA, blockTimestamp: undefined }],
      ["a malformed operation id", log(100, 0, "Cancelled", { id: "0x1234" })],
      ["an unknown event", log(100, 0, "RoleGranted" as never, {})]
    ])("rejects %s and writes nothing from that batch", async (_name, bad) => {
      await expect(
        store.writeGovernanceTimelockEvents([...scheduleB, bad as GovernanceTimelockEvent])
      ).rejects.toThrow(/governance timelock/i);
      expect(await operations(0)).toEqual([]);
    });

    it("leaves the same rows when two writers apply the same history concurrently", async () => {
      await Promise.all([
        store.writeGovernanceTimelockEvents(history),
        second.writeGovernanceTimelockEvents([...history].reverse()),
        store.writeGovernanceTimelockEvents(history)
      ]);
      expect((await operations(0)).map((row) => [row.operationId, row.index, row.state])).toEqual([
        [opA, 0, "waiting"],
        [opB, 0, "executed"],
        [opB, 1, "executed"],
        [opC, 0, "waiting"]
      ]);
    });
  });
}
