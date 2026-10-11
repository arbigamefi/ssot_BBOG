import type { Sql } from "postgres";
import { isAddress, type Address, type Hex } from "viem";

/**
 * GovernanceTimelock (OpenZeppelin TimelockController 5.5) events the index stores. Admissions wait in the
 * timelock for its delay, so LPs read the queue from these rows.
 */
export type GovernanceTimelockEventName =
  | "CallScheduled"
  | "CallSalt"
  | "CallExecuted"
  | "Cancelled"
  | "MinDelayChange";

/** A decoded GovernanceTimelock log. */
export type GovernanceTimelockEvent = {
  chainId: number;
  timelock: Address;
  blockNumber: bigint;
  /** Block timestamp in milliseconds. Required for CallScheduled, whose readyAt depends on it. */
  blockTimestamp?: number;
  txHash: Hex;
  logIndex: number;
  eventName: GovernanceTimelockEventName;
  args: Record<string, unknown>;
};

/**
 * Cursor source under which the keeper indexes the GovernanceTimelock through finalized blocks, keyed by
 * the timelock address, so a governance change starts its own history. Readers use it to tell how far
 * the queue is indexed.
 */
export const GOVERNANCE_TIMELOCK_CURSOR_SOURCE = "governance-timelock-finalized";

/** `waiting` and `ready` follow TimelockController: ready once its timestamp is at or before the clock. */
export type GovernanceTimelockOperationState = "waiting" | "ready" | "executed" | "cancelled";

/**
 * One call of a scheduled operation, keyed by chain, timelock, operation id and batch index. A cancelled
 * operation can be scheduled again under the same id; the row then describes the latest schedule.
 */
export type GovernanceTimelockOperation = {
  chainId: number;
  timelock: Address;
  /** `hashOperation` or `hashOperationBatch` id. */
  operationId: Hex;
  /** Position in `scheduleBatch`; 0 for `schedule`. */
  index: number;
  target: Address;
  /** Native value in wei, decimal. */
  value: string;
  data: Hex;
  predecessor: Hex;
  /** bytes32(0) unless the schedule emitted CallSalt. */
  salt: Hex;
  /** Seconds, decimal. */
  delay: string;
  scheduledBlock: number;
  scheduledTxHash: Hex;
  /** Block timestamp of the schedule, in milliseconds. */
  scheduledAt: number;
  /** Unix seconds, decimal: schedule block timestamp plus delay, what `getTimestamp(id)` reports while pending. */
  readyAt: string;
  executedBlock?: number;
  executedTxHash?: Hex;
  cancelledBlock?: number;
  cancelledTxHash?: Hex;
  state: GovernanceTimelockOperationState;
};

export type GovernanceTimelockOperationsQuery = {
  chainId: number;
  timelock: Address;
  /** Only operations neither executed nor cancelled, that is waiting or ready. */
  pendingOnly?: boolean;
  limit?: number;
  /** Clock for waiting versus ready, in milliseconds. Defaults to the current time. */
  now?: number;
};

export type GovernanceTimelockDelayChange = {
  chainId: number;
  timelock: Address;
  blockNumber: number;
  /** Block timestamp in milliseconds, when the indexer read it. */
  blockTimestamp?: number;
  txHash: Hex;
  logIndex: number;
  /** Seconds, decimal. */
  oldDuration: string;
  /** Seconds, decimal. */
  newDuration: string;
};

export type GovernanceTimelockDelayChangesQuery = { chainId: number; timelock: Address };

const ZERO_BYTES32 = `0x${"0".repeat(64)}` as Hex;
const BYTES32 = /^0x[0-9a-f]{64}$/;
const BYTES = /^0x(?:[0-9a-f]{2})*$/;
const MAX_BATCH_INDEX = 2_147_483_647n;

type Position = { block: bigint; logIndex: number };
type Mark = Position & { txHash: Hex };

type ParsedEvent = { chainId: number; timelock: Address; position: Position; txHash: Hex } & (
  | {
      kind: "scheduled";
      operationId: Hex;
      index: number;
      target: Address;
      value: bigint;
      data: Hex;
      predecessor: Hex;
      delay: bigint;
      scheduledAt: number;
      readyAt: bigint;
    }
  | { kind: "salt"; operationId: Hex; salt: Hex }
  | { kind: "executed"; operationId: Hex; index: number }
  | { kind: "cancelled"; operationId: Hex }
  | { kind: "delay"; blockTimestamp?: number; oldDuration: bigint; newDuration: bigint }
);

function fail(field: string): never {
  throw new Error(`Malformed governance timelock event: ${field}`);
}

function hexOf(value: unknown, pattern: RegExp, field: string): Hex {
  const text = typeof value === "string" ? value.toLowerCase() : "";
  if (!pattern.test(text)) fail(field);
  return text as Hex;
}

function addressOf(value: unknown, field: string): Address {
  if (typeof value !== "string" || !isAddress(value, { strict: false })) fail(field);
  return value.toLowerCase() as Address;
}

function uintOf(value: unknown, field: string): bigint {
  if (typeof value === "bigint" && value >= 0n) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  fail(field);
}

function batchIndexOf(value: unknown) {
  const index = uintOf(value, "index");
  if (index > MAX_BATCH_INDEX) fail("index");
  return Number(index);
}

function timestampOf(value: number | undefined, field: string) {
  if (value == null) return undefined;
  if (!Number.isSafeInteger(value) || value < 0) fail(field);
  return value;
}

function parseEvent(event: GovernanceTimelockEvent): ParsedEvent {
  if (!Number.isSafeInteger(event.chainId) || event.chainId <= 0) fail("chainId");
  if (!Number.isSafeInteger(event.logIndex) || event.logIndex < 0) fail("logIndex");
  const base = {
    chainId: event.chainId,
    timelock: addressOf(event.timelock, "timelock"),
    position: { block: uintOf(event.blockNumber, "blockNumber"), logIndex: event.logIndex },
    txHash: hexOf(event.txHash, BYTES32, "txHash")
  };
  const args = event.args ?? {};
  switch (event.eventName) {
    case "CallScheduled": {
      const scheduledAt = timestampOf(event.blockTimestamp, "blockTimestamp");
      // readyAt is the on-chain timestamp; without its block time the row would be wrong, not partial.
      if (scheduledAt == null) fail("CallScheduled needs its block timestamp");
      const delay = uintOf(args.delay, "delay");
      return {
        ...base,
        kind: "scheduled",
        operationId: hexOf(args.id, BYTES32, "id"),
        index: batchIndexOf(args.index),
        target: addressOf(args.target, "target"),
        value: uintOf(args.value, "value"),
        data: hexOf(args.data, BYTES, "data"),
        predecessor: hexOf(args.predecessor, BYTES32, "predecessor"),
        delay,
        scheduledAt,
        readyAt: BigInt(Math.floor(scheduledAt / 1000)) + delay
      };
    }
    case "CallSalt":
      return {
        ...base,
        kind: "salt",
        operationId: hexOf(args.id, BYTES32, "id"),
        salt: hexOf(args.salt, BYTES32, "salt")
      };
    case "CallExecuted":
      return {
        ...base,
        kind: "executed",
        operationId: hexOf(args.id, BYTES32, "id"),
        index: batchIndexOf(args.index)
      };
    case "Cancelled":
      return { ...base, kind: "cancelled", operationId: hexOf(args.id, BYTES32, "id") };
    case "MinDelayChange":
      return {
        ...base,
        kind: "delay",
        blockTimestamp: timestampOf(event.blockTimestamp, "blockTimestamp"),
        oldDuration: uintOf(args.oldDuration, "oldDuration"),
        newDuration: uintOf(args.newDuration, "newDuration")
      };
    default:
      fail(`event ${String(event.eventName)}`);
  }
}

function comparePositions(a: Position, b: Position) {
  if (a.block !== b.block) return a.block < b.block ? -1 : 1;
  return a.logIndex - b.logIndex;
}

/** Validates every event before anything is written, in chain order. */
export function parseGovernanceTimelockEvents(events: readonly GovernanceTimelockEvent[]) {
  return events.map(parseEvent).sort((a, b) => comparePositions(a.position, b.position));
}

export function governanceTimelockOperationState(
  operation: Pick<GovernanceTimelockOperation, "executedBlock" | "cancelledBlock" | "readyAt">,
  nowMs: number
): GovernanceTimelockOperationState {
  if (operation.executedBlock != null) return "executed";
  if (operation.cancelledBlock != null) return "cancelled";
  return BigInt(operation.readyAt) * 1000n <= BigInt(Math.floor(nowMs)) ? "ready" : "waiting";
}

function limitOf(limit: number | undefined) {
  if (limit == null) return undefined;
  if (!Number.isSafeInteger(limit) || limit < 0) throw new Error("Invalid governance query limit");
  return limit;
}

type StoredOperation = Omit<
  GovernanceTimelockOperation,
  | "state"
  | "value"
  | "delay"
  | "readyAt"
  | "scheduledBlock"
  | "executedBlock"
  | "executedTxHash"
  | "cancelledBlock"
  | "cancelledTxHash"
> & {
  value: bigint;
  delay: bigint;
  readyAt: bigint;
  scheduled: Position;
  executed?: Mark;
  cancelled?: Mark;
};

function isAfter(a: Position, b: Position) {
  return comparePositions(a, b) > 0;
}

function operationKey(chainId: number, timelock: string, operationId: string, index: number) {
  return `${chainId}:${timelock}:${operationId}:${index}`;
}

function fromStored(row: StoredOperation, nowMs: number): GovernanceTimelockOperation {
  const operation: Omit<GovernanceTimelockOperation, "state"> = {
    chainId: row.chainId,
    timelock: row.timelock,
    operationId: row.operationId,
    index: row.index,
    target: row.target,
    value: row.value.toString(),
    data: row.data,
    predecessor: row.predecessor,
    salt: row.salt,
    delay: row.delay.toString(),
    scheduledBlock: Number(row.scheduled.block),
    scheduledTxHash: row.scheduledTxHash,
    scheduledAt: row.scheduledAt,
    readyAt: row.readyAt.toString(),
    ...(row.executed
      ? { executedBlock: Number(row.executed.block), executedTxHash: row.executed.txHash }
      : {}),
    ...(row.cancelled
      ? { cancelledBlock: Number(row.cancelled.block), cancelledTxHash: row.cancelled.txHash }
      : {})
  };
  return { ...operation, state: governanceTimelockOperationState(operation, nowMs) };
}

/** In-memory twin of the PostgreSQL tables; both apply the same position rules. */
export function createMemoryGovernanceTimelockIndex() {
  const operations = new Map<string, StoredOperation>();
  const delayChanges = new Map<string, GovernanceTimelockDelayChange>();
  const sameOperation = (row: StoredOperation, event: ParsedEvent & { operationId: Hex }) =>
    row.chainId === event.chainId &&
    row.timelock === event.timelock &&
    row.operationId === event.operationId;

  const apply = (event: ParsedEvent) => {
    switch (event.kind) {
      case "scheduled": {
        const key = operationKey(event.chainId, event.timelock, event.operationId, event.index);
        const existing = operations.get(key);
        if (existing && !isAfter(event.position, existing.scheduled)) return;
        const schedule = {
          target: event.target,
          value: event.value,
          data: event.data,
          predecessor: event.predecessor,
          delay: event.delay,
          scheduled: event.position,
          scheduledTxHash: event.txHash,
          scheduledAt: event.scheduledAt,
          readyAt: event.readyAt
        };
        if (!existing) {
          operations.set(key, {
            chainId: event.chainId,
            timelock: event.timelock,
            operationId: event.operationId,
            index: event.index,
            salt: ZERO_BYTES32,
            ...schedule
          });
          return;
        }
        // A newer schedule of the same id follows a cancellation; marks of the earlier one no longer apply.
        Object.assign(existing, schedule);
        if (existing.executed && !isAfter(existing.executed, event.position))
          existing.executed = undefined;
        if (existing.cancelled && !isAfter(existing.cancelled, event.position))
          existing.cancelled = undefined;
        return;
      }
      case "salt":
        for (const row of operations.values()) if (sameOperation(row, event)) row.salt = event.salt;
        return;
      case "executed": {
        const row = operations.get(
          operationKey(event.chainId, event.timelock, event.operationId, event.index)
        );
        if (
          row &&
          isAfter(event.position, row.scheduled) &&
          (!row.executed || isAfter(event.position, row.executed))
        )
          row.executed = { ...event.position, txHash: event.txHash };
        return;
      }
      case "cancelled":
        for (const row of operations.values()) {
          if (
            sameOperation(row, event) &&
            isAfter(event.position, row.scheduled) &&
            (!row.cancelled || isAfter(event.position, row.cancelled))
          )
            row.cancelled = { ...event.position, txHash: event.txHash };
        }
        return;
      case "delay": {
        const key = `${event.chainId}:${event.txHash}:${event.position.logIndex}`;
        if (delayChanges.has(key)) return;
        delayChanges.set(key, {
          chainId: event.chainId,
          timelock: event.timelock,
          blockNumber: Number(event.position.block),
          ...(event.blockTimestamp == null ? {} : { blockTimestamp: event.blockTimestamp }),
          txHash: event.txHash,
          logIndex: event.position.logIndex,
          oldDuration: event.oldDuration.toString(),
          newDuration: event.newDuration.toString()
        });
        return;
      }
    }
  };

  return {
    write(events: readonly GovernanceTimelockEvent[]) {
      for (const event of parseGovernanceTimelockEvents(events)) apply(event);
    },
    operations({ chainId, timelock, pendingOnly, limit, now }: GovernanceTimelockOperationsQuery) {
      const nowMs = now ?? Date.now();
      const key = timelock.toLowerCase();
      const rows = [...operations.values()]
        .filter((row) => row.chainId === chainId && row.timelock === key)
        .filter((row) => !pendingOnly || (!row.executed && !row.cancelled))
        .sort(
          (a, b) =>
            comparePositions(a.scheduled, b.scheduled) ||
            a.operationId.localeCompare(b.operationId) ||
            a.index - b.index
        );
      const bounded = limitOf(limit);
      return (bounded == null ? rows : rows.slice(0, bounded)).map((row) => fromStored(row, nowMs));
    },
    delayChanges({ chainId, timelock }: GovernanceTimelockDelayChangesQuery) {
      const key = timelock.toLowerCase();
      return [...delayChanges.values()]
        .filter((row) => row.chainId === chainId && row.timelock === key)
        .sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);
    }
  };
}

export const GOVERNANCE_TIMELOCK_SCHEMA_SQL = `
create table if not exists governance_timelock_operations (
  chain_id integer not null,
  timelock text not null,
  operation_id text not null,
  batch_index integer not null,
  target text not null,
  value numeric(78, 0) not null,
  data text not null,
  predecessor text not null,
  salt text not null,
  delay numeric(78, 0) not null,
  scheduled_block bigint not null,
  scheduled_log_index integer not null,
  scheduled_tx_hash text not null,
  scheduled_at timestamptz not null,
  ready_at numeric(78, 0) not null,
  executed_block bigint,
  executed_log_index integer,
  executed_tx_hash text,
  cancelled_block bigint,
  cancelled_log_index integer,
  cancelled_tx_hash text,
  updated_at timestamptz not null default now(),
  primary key (chain_id, timelock, operation_id, batch_index)
);

create index if not exists governance_timelock_operations_schedule_idx
  on governance_timelock_operations (chain_id, timelock, scheduled_block, scheduled_log_index);

create table if not exists governance_timelock_delay_changes (
  chain_id integer not null,
  timelock text not null,
  block_number bigint not null,
  block_timestamp timestamptz,
  tx_hash text not null,
  log_index integer not null,
  old_duration numeric(78, 0) not null,
  new_duration numeric(78, 0) not null,
  primary key (chain_id, tx_hash, log_index)
);

create index if not exists governance_timelock_delay_changes_timelock_idx
  on governance_timelock_delay_changes (chain_id, timelock, block_number, log_index);
`;

/**
 * Applies the events in one transaction, serialized per timelock. Each statement is guarded by event
 * position, so a replayed range or a second writer leaves the same rows.
 */
export async function writeGovernanceTimelockEventsSql(
  sql: Sql,
  events: readonly GovernanceTimelockEvent[]
) {
  const parsed = parseGovernanceTimelockEvents(events);
  if (parsed.length === 0) return;
  await sql.begin(async (tx) => {
    const identities = [
      ...new Set(parsed.map((event) => `governance-timelock:${event.chainId}:${event.timelock}`))
    ].sort();
    for (const identity of identities)
      await tx`select pg_advisory_xact_lock(hashtextextended(${identity}, 0))`;
    for (const event of parsed) {
      const block = event.position.block.toString();
      const logIndex = event.position.logIndex;
      switch (event.kind) {
        case "scheduled":
          await tx`
            insert into governance_timelock_operations as o (
              chain_id, timelock, operation_id, batch_index, target, value, data, predecessor, salt,
              delay, scheduled_block, scheduled_log_index, scheduled_tx_hash, scheduled_at, ready_at
            ) values (
              ${event.chainId}, ${event.timelock}, ${event.operationId}, ${event.index},
              ${event.target}, ${event.value.toString()}::numeric, ${event.data}, ${event.predecessor},
              ${ZERO_BYTES32}, ${event.delay.toString()}::numeric, ${block}::bigint, ${logIndex}::integer,
              ${event.txHash}, ${new Date(event.scheduledAt)}, ${event.readyAt.toString()}::numeric
            )
            on conflict (chain_id, timelock, operation_id, batch_index) do update set
              target = excluded.target,
              value = excluded.value,
              data = excluded.data,
              predecessor = excluded.predecessor,
              delay = excluded.delay,
              scheduled_block = excluded.scheduled_block,
              scheduled_log_index = excluded.scheduled_log_index,
              scheduled_tx_hash = excluded.scheduled_tx_hash,
              scheduled_at = excluded.scheduled_at,
              ready_at = excluded.ready_at,
              executed_block = case
                when (o.executed_block, o.executed_log_index)
                  > (excluded.scheduled_block, excluded.scheduled_log_index)
                then o.executed_block end,
              executed_log_index = case
                when (o.executed_block, o.executed_log_index)
                  > (excluded.scheduled_block, excluded.scheduled_log_index)
                then o.executed_log_index end,
              executed_tx_hash = case
                when (o.executed_block, o.executed_log_index)
                  > (excluded.scheduled_block, excluded.scheduled_log_index)
                then o.executed_tx_hash end,
              cancelled_block = case
                when (o.cancelled_block, o.cancelled_log_index)
                  > (excluded.scheduled_block, excluded.scheduled_log_index)
                then o.cancelled_block end,
              cancelled_log_index = case
                when (o.cancelled_block, o.cancelled_log_index)
                  > (excluded.scheduled_block, excluded.scheduled_log_index)
                then o.cancelled_log_index end,
              cancelled_tx_hash = case
                when (o.cancelled_block, o.cancelled_log_index)
                  > (excluded.scheduled_block, excluded.scheduled_log_index)
                then o.cancelled_tx_hash end,
              updated_at = now()
            where (excluded.scheduled_block, excluded.scheduled_log_index)
              > (o.scheduled_block, o.scheduled_log_index)
          `;
          break;
        case "salt":
          await tx`
            update governance_timelock_operations set salt = ${event.salt}, updated_at = now()
            where chain_id = ${event.chainId} and timelock = ${event.timelock}
              and operation_id = ${event.operationId}
          `;
          break;
        case "executed":
          await tx`
            update governance_timelock_operations as o set
              executed_block = ${block}::bigint,
              executed_log_index = ${logIndex}::integer,
              executed_tx_hash = ${event.txHash},
              updated_at = now()
            where o.chain_id = ${event.chainId} and o.timelock = ${event.timelock}
              and o.operation_id = ${event.operationId} and o.batch_index = ${event.index}
              and (${block}::bigint, ${logIndex}::integer) > (o.scheduled_block, o.scheduled_log_index)
              and (o.executed_block is null
                or (${block}::bigint, ${logIndex}::integer) > (o.executed_block, o.executed_log_index))
          `;
          break;
        case "cancelled":
          await tx`
            update governance_timelock_operations as o set
              cancelled_block = ${block}::bigint,
              cancelled_log_index = ${logIndex}::integer,
              cancelled_tx_hash = ${event.txHash},
              updated_at = now()
            where o.chain_id = ${event.chainId} and o.timelock = ${event.timelock}
              and o.operation_id = ${event.operationId}
              and (${block}::bigint, ${logIndex}::integer) > (o.scheduled_block, o.scheduled_log_index)
              and (o.cancelled_block is null
                or (${block}::bigint, ${logIndex}::integer) > (o.cancelled_block, o.cancelled_log_index))
          `;
          break;
        case "delay":
          await tx`
            insert into governance_timelock_delay_changes (
              chain_id, timelock, block_number, block_timestamp, tx_hash, log_index,
              old_duration, new_duration
            ) values (
              ${event.chainId}, ${event.timelock}, ${block}::bigint,
              ${event.blockTimestamp == null ? null : new Date(event.blockTimestamp)},
              ${event.txHash}, ${logIndex}::integer, ${event.oldDuration.toString()}::numeric,
              ${event.newDuration.toString()}::numeric
            )
            on conflict (chain_id, tx_hash, log_index) do nothing
          `;
          break;
      }
    }
  });
}

function optionalNumber(value: unknown) {
  return value == null ? undefined : Number(value);
}

function optionalHex(value: unknown) {
  return typeof value === "string" && value.length > 0 ? (value as Hex) : undefined;
}

function dateMs(value: unknown) {
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(String(value)).getTime();
  if (!Number.isFinite(parsed)) throw new Error("Invalid governance timelock timestamp");
  return parsed;
}

function operationFromDatabase(
  row: Record<string, unknown>,
  nowMs: number
): GovernanceTimelockOperation {
  const executedBlock = optionalNumber(row.executedBlock);
  const cancelledBlock = optionalNumber(row.cancelledBlock);
  const operation: Omit<GovernanceTimelockOperation, "state"> = {
    chainId: Number(row.chainId),
    timelock: String(row.timelock) as Address,
    operationId: String(row.operationId) as Hex,
    index: Number(row.batchIndex),
    target: String(row.target) as Address,
    value: String(row.value),
    data: String(row.data) as Hex,
    predecessor: String(row.predecessor) as Hex,
    salt: String(row.salt) as Hex,
    delay: String(row.delay),
    scheduledBlock: Number(row.scheduledBlock),
    scheduledTxHash: String(row.scheduledTxHash) as Hex,
    scheduledAt: dateMs(row.scheduledAt),
    readyAt: String(row.readyAt),
    ...(executedBlock == null
      ? {}
      : { executedBlock, executedTxHash: optionalHex(row.executedTxHash) }),
    ...(cancelledBlock == null
      ? {}
      : { cancelledBlock, cancelledTxHash: optionalHex(row.cancelledTxHash) })
  };
  return { ...operation, state: governanceTimelockOperationState(operation, nowMs) };
}

export async function readGovernanceTimelockOperationsSql(
  sql: Sql,
  { chainId, timelock, pendingOnly, limit, now }: GovernanceTimelockOperationsQuery
) {
  const nowMs = now ?? Date.now();
  const bounded = limitOf(limit);
  const rows = await sql`
    select * from governance_timelock_operations
    where chain_id = ${chainId} and timelock = ${timelock.toLowerCase()}
      ${pendingOnly ? sql`and executed_block is null and cancelled_block is null` : sql``}
    order by scheduled_block, scheduled_log_index, operation_id, batch_index
    ${bounded == null ? sql`` : sql`limit ${bounded}`}
  `;
  return rows.map((row) => operationFromDatabase(row, nowMs));
}

export async function readGovernanceTimelockDelayChangesSql(
  sql: Sql,
  { chainId, timelock }: GovernanceTimelockDelayChangesQuery
): Promise<GovernanceTimelockDelayChange[]> {
  const rows = await sql`
    select * from governance_timelock_delay_changes
    where chain_id = ${chainId} and timelock = ${timelock.toLowerCase()}
    order by block_number, log_index
  `;
  return rows.map((row) => ({
    chainId: Number(row.chainId),
    timelock: String(row.timelock) as Address,
    blockNumber: Number(row.blockNumber),
    ...(row.blockTimestamp == null ? {} : { blockTimestamp: dateMs(row.blockTimestamp) }),
    txHash: String(row.txHash) as Hex,
    logIndex: Number(row.logIndex),
    oldDuration: String(row.oldDuration),
    newDuration: String(row.newDuration)
  }));
}
