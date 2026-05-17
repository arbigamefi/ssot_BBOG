import postgres, { type Sql } from "postgres";
import type { Address, Hex } from "viem";

export type BetLifecycleState = "placed" | "randomReady" | "finalized" | "refunded";

export type GameHubEventName = "BetPlaced" | "BetRandomReady" | "BetFinalized" | "BetRefunded";

export type BetRow = {
  id: string;
  chainId: number;
  betId: string;
  state: BetLifecycleState;
  gameId?: Hex;
  asset?: Address;
  player?: Address;
  stake?: string;
  payout?: string;
  payoutGross?: string;
  refundAmount?: string;
  requestId?: string;
  randomHash?: Hex;
  terminalTxHash?: Hex;
  finalizedTxHash?: Hex;
  refundedTxHash?: Hex;
  placedBlock?: number;
  updatedBlock: number;
  lastTxHash: Hex;
  lastEventName: string;
  updatedAt: number;
};

export type BetIndexEvent = {
  chainId: number;
  gameHub: Address;
  blockNumber: bigint;
  txHash: Hex;
  logIndex: number;
  eventName: GameHubEventName;
  args: Record<string, unknown>;
};

export type BetIndexQuery = {
  chainId: number;
  limit: number;
  gameId?: Hex;
  player?: Address;
};

export type BetIndexCursor = {
  chainId: number;
  source: string;
  cursorKey: string;
  blockNumber: bigint;
};

export type BetIndexStore = {
  migrate: () => Promise<void>;
  writeGameHubEvents: (events: readonly BetIndexEvent[]) => Promise<BetRow[]>;
  getRecentBets: (query: BetIndexQuery) => Promise<BetRow[]>;
  getPlayerBets: (
    query: Required<Pick<BetIndexQuery, "chainId" | "limit" | "player">>
  ) => Promise<BetRow[]>;
  getCursor: (chainId: number, source: string, cursorKey: string) => Promise<bigint | null>;
  setCursor: (cursor: BetIndexCursor) => Promise<void>;
  close?: () => Promise<void>;
};

export const BET_INDEX_SCHEMA_SQL = `
create table if not exists gamehub_events (
  chain_id integer not null,
  game_hub text not null,
  block_number bigint not null,
  tx_hash text not null,
  log_index integer not null,
  event_name text not null,
  args_json jsonb not null,
  created_at timestamptz not null default now(),
  primary key (chain_id, tx_hash, log_index)
);

create index if not exists gamehub_events_source_idx
  on gamehub_events (chain_id, game_hub, block_number, log_index);

create table if not exists bets (
  chain_id integer not null,
  bet_id text not null,
  state text not null,
  game_id text,
  asset text,
  player text,
  stake text,
  payout text,
  payout_gross text,
  refund_amount text,
  request_id text,
  random_hash text,
  terminal_tx_hash text,
  finalized_tx_hash text,
  refunded_tx_hash text,
  placed_block bigint,
  updated_block bigint not null,
  last_tx_hash text not null,
  last_event_name text not null,
  updated_at timestamptz not null default now(),
  primary key (chain_id, bet_id)
);

alter table bets add column if not exists stake text;
alter table bets add column if not exists payout text;
alter table bets add column if not exists payout_gross text;
alter table bets add column if not exists refund_amount text;
alter table bets add column if not exists request_id text;
alter table bets add column if not exists random_hash text;
alter table bets add column if not exists terminal_tx_hash text;
alter table bets add column if not exists finalized_tx_hash text;
alter table bets add column if not exists refunded_tx_hash text;

create index if not exists bets_recent_idx
  on bets (chain_id, updated_block desc, bet_id desc);

create index if not exists bets_player_idx
  on bets (chain_id, player, updated_block desc);

create index if not exists bets_game_idx
  on bets (chain_id, game_id, updated_block desc);

create index if not exists bets_state_idx
  on bets (chain_id, state, updated_block desc);

create table if not exists indexer_cursors (
  chain_id integer not null,
  source text not null,
  cursor_key text not null,
  block_number bigint not null,
  updated_at timestamptz not null default now(),
  primary key (chain_id, source, cursor_key)
);
`;

export type PostgresBetIndexConfig = {
  connectionString: string;
  connectTimeoutSeconds?: number;
  ssl?: boolean | "require";
};

export function createMemoryBetIndexStore(): BetIndexStore {
  const bets = new Map<string, BetRow>();
  const cursors = new Map<string, bigint>();

  const writeGameHubEvents = async (input: readonly BetIndexEvent[]) => {
    const changed = new Map<string, BetRow>();
    const sorted = [...input].sort(compareEvents);
    for (const event of sorted) {
      const betId = String(event.args.positionId ?? event.args.betId ?? event.args.id ?? "0");
      const key = `${event.chainId}:${betId}`;
      const existing = bets.get(key);
      const next = applyEventToBet(existing, event);
      if (!existing || next.updatedBlock >= existing.updatedBlock) {
        bets.set(key, next);
        changed.set(key, next);
      }
    }
    return [...changed.values()];
  };

  return {
    migrate: async () => undefined,
    writeGameHubEvents,
    getRecentBets: async ({ chainId, gameId, limit }) =>
      [...bets.values()]
        .filter((row) => row.chainId === chainId)
        .filter((row) => !gameId || row.gameId?.toLowerCase() === gameId.toLowerCase())
        .sort(compareBetRows)
        .slice(0, limit),
    getPlayerBets: async ({ chainId, player, limit }) =>
      [...bets.values()]
        .filter((row) => row.chainId === chainId)
        .filter((row) => row.player?.toLowerCase() === player.toLowerCase())
        .sort(compareBetRows)
        .slice(0, limit),
    getCursor: async (chainId: number, source: string, cursorKey: string) =>
      cursors.get(cursorId(chainId, source, cursorKey)) ?? null,
    setCursor: async (cursor: BetIndexCursor) => {
      cursors.set(cursorId(cursor.chainId, cursor.source, cursor.cursorKey), cursor.blockNumber);
    }
  };
}

export function createPostgresBetIndexStore(config: PostgresBetIndexConfig): BetIndexStore {
  const sql = postgres(config.connectionString, {
    connect_timeout: config.connectTimeoutSeconds ?? 5,
    max: 5,
    ssl: config.ssl ? "require" : undefined,
    transform: postgres.camel
  });

  return createPostgresBetIndexStoreFromSql(sql);
}

export function createPostgresBetIndexStoreFromSql(sql: Sql): BetIndexStore {
  return {
    migrate: async () => {
      await sql.unsafe(BET_INDEX_SCHEMA_SQL);
    },
    writeGameHubEvents: async (events: readonly BetIndexEvent[]) => {
      if (events.length === 0) return [];
      const rows = foldBetIndexEvents(events);
      await sql.begin(async (tx) => {
        for (const event of events) {
          await tx`
            insert into gamehub_events (
              chain_id, game_hub, block_number, tx_hash, log_index, event_name, args_json
            ) values (
              ${event.chainId},
              ${event.gameHub.toLowerCase()},
              ${event.blockNumber.toString()},
              ${event.txHash.toLowerCase()},
              ${event.logIndex},
              ${event.eventName},
              ${tx.json(serializeArgs(event.args) as never)}
            )
            on conflict (chain_id, tx_hash, log_index) do nothing
          `;
        }

        for (const row of rows) {
          await tx`
            insert into bets (
              chain_id, bet_id, state, game_id, asset, player, stake, payout,
              payout_gross, refund_amount, request_id, random_hash, terminal_tx_hash,
              finalized_tx_hash, refunded_tx_hash, placed_block,
              updated_block, last_tx_hash, last_event_name, updated_at
            ) values (
              ${row.chainId},
              ${row.betId},
              ${row.state},
              ${row.gameId?.toLowerCase() ?? null},
              ${row.asset?.toLowerCase() ?? null},
              ${row.player?.toLowerCase() ?? null},
              ${row.stake ?? null},
              ${row.payout ?? null},
              ${row.payoutGross ?? null},
              ${row.refundAmount ?? null},
              ${row.requestId ?? null},
              ${row.randomHash?.toLowerCase() ?? null},
              ${row.terminalTxHash?.toLowerCase() ?? null},
              ${row.finalizedTxHash?.toLowerCase() ?? null},
              ${row.refundedTxHash?.toLowerCase() ?? null},
              ${row.placedBlock ?? null},
              ${row.updatedBlock},
              ${row.lastTxHash.toLowerCase()},
              ${row.lastEventName},
              ${new Date(row.updatedAt)}
            )
            on conflict (chain_id, bet_id) do update set
              state = case
                when excluded.updated_block >= bets.updated_block then excluded.state
                else bets.state
              end,
              game_id = coalesce(excluded.game_id, bets.game_id),
              asset = coalesce(excluded.asset, bets.asset),
              player = coalesce(excluded.player, bets.player),
              stake = coalesce(excluded.stake, bets.stake),
              payout = coalesce(excluded.payout, bets.payout),
              payout_gross = coalesce(excluded.payout_gross, bets.payout_gross),
              refund_amount = coalesce(excluded.refund_amount, bets.refund_amount),
              request_id = coalesce(excluded.request_id, bets.request_id),
              random_hash = coalesce(excluded.random_hash, bets.random_hash),
              terminal_tx_hash = coalesce(excluded.terminal_tx_hash, bets.terminal_tx_hash),
              finalized_tx_hash = coalesce(excluded.finalized_tx_hash, bets.finalized_tx_hash),
              refunded_tx_hash = coalesce(excluded.refunded_tx_hash, bets.refunded_tx_hash),
              placed_block = coalesce(bets.placed_block, excluded.placed_block),
              updated_block = greatest(bets.updated_block, excluded.updated_block),
              last_tx_hash = case
                when excluded.updated_block >= bets.updated_block then excluded.last_tx_hash
                else bets.last_tx_hash
              end,
              last_event_name = case
                when excluded.updated_block >= bets.updated_block then excluded.last_event_name
                else bets.last_event_name
              end,
              updated_at = case
                when excluded.updated_block >= bets.updated_block then excluded.updated_at
                else bets.updated_at
              end
          `;
        }
      });
      return rows;
    },
    getRecentBets: async ({ chainId, gameId, limit }) => {
      const rows = gameId
        ? await sql`
            select * from bets
            where chain_id = ${chainId} and game_id = ${gameId.toLowerCase()}
            order by updated_block desc, bet_id desc
            limit ${limit}
          `
        : await sql`
            select * from bets
            where chain_id = ${chainId}
            order by updated_block desc, bet_id desc
            limit ${limit}
          `;
      return rows.map(rowFromDatabase).sort(compareBetRows);
    },
    getPlayerBets: async ({ chainId, player, limit }) => {
      const rows = await sql`
        select * from bets
        where chain_id = ${chainId} and player = ${player.toLowerCase()}
        order by updated_block desc, bet_id desc
        limit ${limit}
      `;
      return rows.map(rowFromDatabase).sort(compareBetRows);
    },
    getCursor: async (chainId: number, source: string, cursorKey: string) => {
      const rows = await sql`
        select block_number from indexer_cursors
        where chain_id = ${chainId} and source = ${source} and cursor_key = ${cursorKey.toLowerCase()}
        limit 1
      `;
      const value = rows[0]?.blockNumber;
      return value == null ? null : BigInt(value);
    },
    setCursor: async (cursor: BetIndexCursor) => {
      await sql`
        insert into indexer_cursors (chain_id, source, cursor_key, block_number)
        values (
          ${cursor.chainId},
          ${cursor.source},
          ${cursor.cursorKey.toLowerCase()},
          ${cursor.blockNumber.toString()}
        )
        on conflict (chain_id, source, cursor_key) do update set
          block_number = excluded.block_number,
          updated_at = now()
      `;
    },
    close: async () => {
      await sql.end();
    }
  };
}

export function serializeArgs(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(args).map(([key, value]) => [key, serializeValue(value)])
  );
}

function serializeValue(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value && typeof value === "object") return serializeArgs(value as Record<string, unknown>);
  return value;
}

export function foldBetIndexEvents(events: readonly BetIndexEvent[]) {
  const rows = new Map<string, BetRow>();
  const sorted = [...events].sort(compareEvents);

  for (const event of sorted) {
    const betId = String(event.args.positionId ?? event.args.betId ?? event.args.id ?? "0");
    const key = `${event.chainId}:${betId}`;
    rows.set(key, applyEventToBet(rows.get(key), event));
  }

  return [...rows.values()];
}

function compareEvents(a: BetIndexEvent, b: BetIndexEvent) {
  const blockDelta = Number(a.blockNumber - b.blockNumber);
  if (blockDelta !== 0) return blockDelta;
  return a.logIndex - b.logIndex;
}

export function compareBetRows(a: BetRow, b: BetRow) {
  if (b.updatedBlock !== a.updatedBlock) return b.updatedBlock - a.updatedBlock;
  const aId = BigInt(a.betId);
  const bId = BigInt(b.betId);
  if (bId === aId) return 0;
  return bId > aId ? 1 : -1;
}

function applyEventToBet(prev: BetRow | undefined, event: BetIndexEvent): BetRow {
  const betId = String(event.args.positionId ?? event.args.betId ?? event.args.id ?? "0");
  const next: BetRow = prev
    ? { ...prev }
    : {
        betId,
        chainId: event.chainId,
        id: `${event.chainId}:${betId}`,
        lastEventName: event.eventName,
        lastTxHash: event.txHash,
        state: "placed",
        updatedAt: Date.now(),
        updatedBlock: Number(event.blockNumber)
      };

  if (event.eventName === "BetPlaced") {
    if (event.args.gameId) next.gameId = event.args.gameId as BetRow["gameId"];
    if (event.args.asset) next.asset = event.args.asset as BetRow["asset"];
    if (event.args.player) next.player = event.args.player as BetRow["player"];
    if (event.args.user && !next.player) next.player = event.args.user as BetRow["player"];
    if (event.args.stake != null) next.stake = toBigintString(event.args.stake);
    if (event.args.requestId != null) next.requestId = toBigintString(event.args.requestId);
    next.placedBlock = Number(event.blockNumber);
  }

  if (event.eventName === "BetRandomReady") {
    if (event.args.requestId != null) next.requestId = toBigintString(event.args.requestId);
    if (event.args.randomHash) next.randomHash = event.args.randomHash as BetRow["randomHash"];
  }

  if (event.eventName === "BetFinalized") {
    if (event.args.payoutGross != null) next.payoutGross = toBigintString(event.args.payoutGross);
    if (event.args.payoutNet != null) next.payout = toBigintString(event.args.payoutNet);
    next.terminalTxHash = event.txHash;
    next.finalizedTxHash = event.txHash;
  }

  if (event.eventName === "BetRefunded") {
    if (event.args.refundAmount != null) {
      next.refundAmount = toBigintString(event.args.refundAmount);
      next.payout = next.refundAmount;
    }
    next.terminalTxHash = event.txHash;
    next.refundedTxHash = event.txHash;
  }

  next.state = reduceState(next.state, event.eventName);
  next.updatedBlock = Math.max(next.updatedBlock, Number(event.blockNumber));
  next.lastTxHash = event.txHash;
  next.lastEventName = event.eventName;
  next.updatedAt = Date.now();
  return next;
}

function reduceState(prev: BetLifecycleState, eventName: BetIndexEvent["eventName"]) {
  if (eventName === "BetRefunded") return "refunded";
  if (eventName === "BetFinalized") return "finalized";
  if (eventName === "BetRandomReady") {
    if (prev === "finalized" || prev === "refunded") return prev;
    return "randomReady";
  }
  return prev;
}

function rowFromDatabase(row: Record<string, unknown>): BetRow {
  return {
    asset: optionalAddress(row.asset),
    betId: String(row.betId),
    chainId: Number(row.chainId),
    finalizedTxHash: optionalHex(row.finalizedTxHash),
    gameId: optionalHex(row.gameId),
    id: `${Number(row.chainId)}:${String(row.betId)}`,
    lastEventName: String(row.lastEventName),
    lastTxHash: String(row.lastTxHash) as Hex,
    payout: optionalString(row.payout),
    payoutGross: optionalString(row.payoutGross),
    placedBlock: optionalNumber(row.placedBlock),
    player: optionalAddress(row.player),
    randomHash: optionalHex(row.randomHash),
    refundedTxHash: optionalHex(row.refundedTxHash),
    refundAmount: optionalString(row.refundAmount),
    requestId: optionalString(row.requestId),
    state: normalizeState(row.state),
    stake: optionalString(row.stake),
    terminalTxHash: optionalHex(row.terminalTxHash),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.getTime() : Date.now(),
    updatedBlock: Number(row.updatedBlock)
  };
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalHex(value: unknown) {
  return optionalString(value) as Hex | undefined;
}

function optionalAddress(value: unknown) {
  return optionalString(value) as Address | undefined;
}

function optionalNumber(value: unknown) {
  return value == null ? undefined : Number(value);
}

function normalizeState(value: unknown): BetLifecycleState {
  if (
    value === "placed" ||
    value === "randomReady" ||
    value === "finalized" ||
    value === "refunded"
  ) {
    return value;
  }
  return "placed";
}

function toBigintString(v: unknown): string {
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number") return BigInt(v).toString();
  if (typeof v === "string") {
    if (v.startsWith("0x")) {
      try {
        return BigInt(v).toString();
      } catch {
        return v;
      }
    }
    if (/^\d+$/.test(v)) return v;
  }
  return String(v);
}

function cursorId(chainId: number, source: string, cursorKey: string) {
  return `${chainId}:${source}:${cursorKey.toLowerCase()}`;
}
