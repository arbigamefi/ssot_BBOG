import postgres, { type Sql } from "postgres";
import type { Address, Hex } from "viem";

export type BetLifecycleState = "placed" | "randomReady" | "finalized" | "refunded";
export type SportsTicketLifecycleState = "held" | "settled" | "refunded" | "voided";

export type GameHubEventName = "BetPlaced" | "BetRandomReady" | "BetFinalized" | "BetRefunded";
export type SportsHubEventName =
  | "TicketPlaced"
  | "TicketSettled"
  | "TicketRefunded"
  | "TicketVoided";

export type BetRow = {
  id: string;
  chainId: number;
  betId: string;
  state: BetLifecycleState;
  gameId?: Hex;
  asset?: Address;
  player?: Address;
  pricingAffiliate?: Address;
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
  placedAt?: number;
  updatedBlock: number;
  lastTxHash: Hex;
  lastEventName: string;
  updatedAt: number;
};

export type BetIndexEvent = {
  chainId: number;
  gameHub: Address;
  blockNumber: bigint;
  /** Chain block timestamp in milliseconds when available. */
  blockTimestamp?: number;
  txHash: Hex;
  logIndex: number;
  eventName: GameHubEventName;
  args: Record<string, unknown>;
};

export type SportsTicketRow = {
  id: string;
  chainId: number;
  ticketId: string;
  positionId?: string;
  marketId?: string;
  eventId?: string;
  poolId?: string;
  outcomeId?: number;
  player?: Address;
  stake?: string;
  payout?: string;
  reserved?: string;
  refundAmount?: string;
  oddsSnapshotHash?: Hex;
  rulebookHash?: Hex;
  state: SportsTicketLifecycleState;
  placedBlock?: number;
  updatedBlock: number;
  lastTxHash: Hex;
  lastEventName: string;
  terminalTxHash?: Hex;
  settledTxHash?: Hex;
  refundedTxHash?: Hex;
  voidedTxHash?: Hex;
  updatedAt: number;
};

export type SportsTicketIndexEvent = {
  chainId: number;
  sportsHub: Address;
  blockNumber: bigint;
  txHash: Hex;
  logIndex: number;
  eventName: SportsHubEventName;
  args: Record<string, unknown>;
};

export type BankProviderLedgerAction = "deposit" | "withdraw";

export type BankProviderLedgerRow = {
  id: string;
  chainId: number;
  poolId: string;
  owner: Address;
  bank: Address;
  asset: Address;
  action: BankProviderLedgerAction;
  txHash: Hex;
  blockNumber: number;
  logIndex: number;
  timestamp?: number;
  assets?: string;
  shares: string;
  sharePrice?: string;
  updatedAt: number;
};

export type BetIndexQuery = {
  chainId: number;
  limit: number;
  gameId?: Hex;
  player?: Address;
  affiliate?: Address;
};

export type SportsTicketIndexQuery = {
  chainId: number;
  limit: number;
  player?: Address;
};

export type BankProviderLedgerQuery = {
  chainId: number;
  limit: number;
  owner: Address;
  poolId: number | string;
  beforeBlock?: number;
  beforeLogIndex?: number;
};

export type BetIndexAffiliateStats = {
  affiliate: Address;
  betCount: number;
  settledCount: number;
  turnover: string;
  payout: string;
  payoutGross: string;
};

export type BetIndexCasinoStats = {
  asset: Address;
  betCount: number;
  settledCount: number;
  /** Finalized bets whose payout exceeded the stake (a net win). */
  wonCount: number;
  uniquePlayers: number;
  turnover: string;
  payout: string;
  payoutGross: string;
};

export type BetIndexCasinoLeaderboardEntry = {
  asset: Address;
  player: Address;
  betCount: number;
  settledCount: number;
  turnover: string;
  payout: string;
  payoutGross: string;
};

export type BetIndexCasinoPlayerRank = {
  asset: Address;
  player: Address;
  /** 1-based position in the turnover ranking for the requested scope. */
  rank: number;
  betCount: number;
  turnover: string;
};

export type BetIndexCasinoTopWinEntry = {
  asset: Address;
  betId: string;
  gameId?: Hex;
  player: Address;
  stake: string;
  payout: string;
  payoutGross: string;
  /** payout / stake, scaled by 1e6 to avoid floating point drift. */
  multiplierPpm: string;
};

export type BetIndexGameVolume = {
  asset: Address;
  gameId: Hex;
  betCount: number;
  settledCount: number;
  wonCount: number;
  uniquePlayers: number;
  turnover: string;
  payout: string;
  payoutGross: string;
};

export type BetIndexCasinoTimeseriesPoint = {
  asset: Address;
  date: string;
  betCount: number;
  settledCount: number;
  wonCount: number;
  uniquePlayers: number;
  turnover: string;
  payout: string;
  payoutGross: string;
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
  writeSportsHubEvents: (events: readonly SportsTicketIndexEvent[]) => Promise<SportsTicketRow[]>;
  writeBankProviderLedgerRows: (
    rows: readonly BankProviderLedgerRow[]
  ) => Promise<BankProviderLedgerRow[]>;
  getRecentBets: (query: BetIndexQuery) => Promise<BetRow[]>;
  getPlayerBets: (
    query: Required<Pick<BetIndexQuery, "chainId" | "limit" | "player">>
  ) => Promise<BetRow[]>;
  getPlayerSportsTickets: (
    query: Required<Pick<SportsTicketIndexQuery, "chainId" | "limit" | "player">>
  ) => Promise<SportsTicketRow[]>;
  getBankProviderLedger: (query: BankProviderLedgerQuery) => Promise<BankProviderLedgerRow[]>;
  getHeldSportsTicketIdsByMarket: (query: {
    chainId: number;
    limit: number;
    marketId: string;
  }) => Promise<bigint[]>;
  getAffiliateBets: (
    query: Required<Pick<BetIndexQuery, "chainId" | "limit" | "affiliate">>
  ) => Promise<BetRow[]>;
  getAffiliateStats: (
    query: Required<Pick<BetIndexQuery, "chainId" | "affiliate">>
  ) => Promise<BetIndexAffiliateStats>;
  getCasinoStats: (query: {
    asset: Address;
    chainId: number;
    /** Optional unix-seconds lower bound on chain placement time (windowed stats). */
    since?: number;
  }) => Promise<BetIndexCasinoStats>;
  getCasinoLeaderboard: (query: {
    asset: Address;
    chainId: number;
    limit: number;
    /** Optional game filter — when set, ranks players within that game only. */
    gameId?: Hex;
    /** Optional unix-seconds lower bound on chain placement time (windowed ranking). */
    since?: number;
  }) => Promise<BetIndexCasinoLeaderboardEntry[]>;
  getCasinoTopWins: (query: {
    asset: Address;
    chainId: number;
    limit: number;
    /** Optional game filter — when set, ranks winning bets within that game only. */
    gameId?: Hex;
    /** Optional unix-seconds lower bound on chain placement time (windowed ranking). */
    since?: number;
  }) => Promise<BetIndexCasinoTopWinEntry[]>;
  /**
   * Resolve a single player's 1-based position in the turnover leaderboard for
   * the given scope, or null when they have no bets in scope. Lets the UI show
   * "your rank" even when the player is outside the rendered top N.
   */
  getCasinoPlayerRank: (query: {
    asset: Address;
    chainId: number;
    player: Address;
    /** Optional game filter — ranks the player within that game only. */
    gameId?: Hex;
    /** Optional unix-seconds lower bound on chain placement time. */
    since?: number;
  }) => Promise<BetIndexCasinoPlayerRank | null>;
  getGameVolumes: (query: {
    asset: Address;
    chainId: number;
    /** Optional unix-seconds lower bound on chain placement time (windowed volume). */
    since?: number;
  }) => Promise<BetIndexGameVolume[]>;
  getCasinoTimeseries: (query: {
    asset: Address;
    chainId: number;
    days: number;
    /** Optional game filter — when set, groups daily volume for that game only. */
    gameId?: Hex;
  }) => Promise<BetIndexCasinoTimeseriesPoint[]>;
  getCursor: (chainId: number, source: string, cursorKey: string) => Promise<bigint | null>;
  setCursor: (cursor: BetIndexCursor) => Promise<void>;
  close?: () => Promise<void>;
};

export const BET_INDEX_SCHEMA_SQL = `
create table if not exists gamehub_events (
  chain_id integer not null,
  game_hub text not null,
  block_number bigint not null,
  block_timestamp timestamptz,
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
  pricing_affiliate text,
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
  placed_at timestamptz,
  updated_block bigint not null,
  last_tx_hash text not null,
  last_event_name text not null,
  updated_at timestamptz not null default now(),
  primary key (chain_id, bet_id)
);

alter table bets add column if not exists stake text;
alter table bets add column if not exists pricing_affiliate text;
alter table bets add column if not exists payout text;
alter table bets add column if not exists payout_gross text;
alter table bets add column if not exists refund_amount text;
alter table bets add column if not exists request_id text;
alter table bets add column if not exists random_hash text;
alter table bets add column if not exists terminal_tx_hash text;
alter table bets add column if not exists finalized_tx_hash text;
alter table bets add column if not exists refunded_tx_hash text;
alter table bets add column if not exists placed_at timestamptz;
alter table gamehub_events add column if not exists block_timestamp timestamptz;

create index if not exists bets_recent_idx
  on bets (chain_id, updated_block desc, bet_id desc);

create index if not exists bets_player_idx
  on bets (chain_id, player, updated_block desc);

create index if not exists bets_affiliate_idx
  on bets (chain_id, pricing_affiliate, updated_block desc);

create index if not exists bets_game_idx
  on bets (chain_id, game_id, updated_block desc);

create index if not exists bets_asset_placed_at_idx
  on bets (chain_id, asset, placed_at desc);

create index if not exists bets_state_idx
  on bets (chain_id, state, updated_block desc);

create table if not exists sport_tickets (
  chain_id integer not null,
  ticket_id text not null,
  position_id text,
  market_id text,
  event_id text,
  pool_id text,
  outcome_id integer,
  player text,
  stake text,
  payout text,
  reserved text,
  refund_amount text,
  odds_snapshot_hash text,
  rulebook_hash text,
  state text not null,
  placed_block bigint,
  updated_block bigint not null,
  last_tx_hash text not null,
  last_event_name text not null,
  terminal_tx_hash text,
  settled_tx_hash text,
  refunded_tx_hash text,
  voided_tx_hash text,
  updated_at timestamptz not null default now(),
  primary key (chain_id, ticket_id)
);

alter table sport_tickets add column if not exists position_id text;
alter table sport_tickets add column if not exists market_id text;
alter table sport_tickets add column if not exists event_id text;
alter table sport_tickets add column if not exists pool_id text;
alter table sport_tickets add column if not exists outcome_id integer;
alter table sport_tickets add column if not exists player text;
alter table sport_tickets add column if not exists stake text;
alter table sport_tickets add column if not exists payout text;
alter table sport_tickets add column if not exists reserved text;
alter table sport_tickets add column if not exists refund_amount text;
alter table sport_tickets add column if not exists odds_snapshot_hash text;
alter table sport_tickets add column if not exists rulebook_hash text;
alter table sport_tickets add column if not exists terminal_tx_hash text;
alter table sport_tickets add column if not exists settled_tx_hash text;
alter table sport_tickets add column if not exists refunded_tx_hash text;
alter table sport_tickets add column if not exists voided_tx_hash text;

create index if not exists sport_tickets_recent_idx
  on sport_tickets (chain_id, updated_block desc, ticket_id desc);

create index if not exists sport_tickets_player_idx
  on sport_tickets (chain_id, player, updated_block desc);

create index if not exists sport_tickets_market_idx
  on sport_tickets (chain_id, market_id, updated_block desc);

create index if not exists sport_tickets_market_state_idx
  on sport_tickets (chain_id, market_id, state, updated_block desc, ticket_id desc);

create table if not exists bank_provider_ledger (
  chain_id integer not null,
  pool_id text not null,
  owner text not null,
  bank text not null,
  asset text not null,
  action text not null,
  tx_hash text not null,
  block_number bigint not null,
  log_index integer not null,
  timestamp timestamptz,
  asset_amount text,
  share_amount text not null,
  share_price text,
  updated_at timestamptz not null default now(),
  primary key (chain_id, tx_hash, log_index)
);

alter table bank_provider_ledger add column if not exists pool_id text;
alter table bank_provider_ledger add column if not exists owner text;
alter table bank_provider_ledger add column if not exists bank text;
alter table bank_provider_ledger add column if not exists asset text;
alter table bank_provider_ledger add column if not exists action text;
alter table bank_provider_ledger add column if not exists block_number bigint;
alter table bank_provider_ledger add column if not exists timestamp timestamptz;
alter table bank_provider_ledger add column if not exists asset_amount text;
alter table bank_provider_ledger add column if not exists share_amount text;
alter table bank_provider_ledger add column if not exists share_price text;
alter table bank_provider_ledger add column if not exists updated_at timestamptz;

create index if not exists bank_provider_ledger_owner_idx
  on bank_provider_ledger (chain_id, pool_id, owner, block_number desc, log_index desc);

create index if not exists bank_provider_ledger_bank_idx
  on bank_provider_ledger (chain_id, bank, block_number desc, log_index desc);

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
  const sportsTickets = new Map<string, SportsTicketRow>();
  const bankProviderLedger = new Map<string, BankProviderLedgerRow>();
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
  const writeSportsHubEvents = async (input: readonly SportsTicketIndexEvent[]) => {
    const changed = new Map<string, SportsTicketRow>();
    const sorted = [...input].sort(compareEvents);
    for (const event of sorted) {
      const ticketId = String(event.args.ticketId ?? event.args.id ?? "0");
      const key = `${event.chainId}:${ticketId}`;
      const existing = sportsTickets.get(key);
      const next = applyEventToSportsTicket(existing, event);
      if (!existing || next.updatedBlock >= existing.updatedBlock) {
        sportsTickets.set(key, next);
        changed.set(key, next);
      }
    }
    return [...changed.values()];
  };
  const writeBankProviderLedgerRows = async (input: readonly BankProviderLedgerRow[]) => {
    for (const row of input) {
      bankProviderLedger.set(bankProviderLedgerId(row.chainId, row.txHash, row.logIndex), {
        ...row,
        asset: row.asset.toLowerCase() as Address,
        bank: row.bank.toLowerCase() as Address,
        owner: row.owner.toLowerCase() as Address,
        poolId: String(row.poolId),
        txHash: row.txHash.toLowerCase() as Hex
      });
    }
    return [...input];
  };

  return {
    migrate: async () => undefined,
    writeGameHubEvents,
    writeSportsHubEvents,
    writeBankProviderLedgerRows,
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
    getPlayerSportsTickets: async ({ chainId, player, limit }) =>
      [...sportsTickets.values()]
        .filter((row) => row.chainId === chainId)
        .filter((row) => row.player?.toLowerCase() === player.toLowerCase())
        .sort(compareSportsTicketRows)
        .slice(0, limit),
    getBankProviderLedger: async ({ beforeBlock, beforeLogIndex, chainId, limit, owner, poolId }) =>
      [...bankProviderLedger.values()]
        .filter((row) => row.chainId === chainId)
        .filter((row) => row.poolId === String(poolId))
        .filter((row) => row.owner.toLowerCase() === owner.toLowerCase())
        .filter((row) => isBankProviderLedgerBeforeCursor(row, beforeBlock, beforeLogIndex))
        .sort(compareBankProviderLedgerRows)
        .slice(0, limit),
    getHeldSportsTicketIdsByMarket: async ({ chainId, limit, marketId }) =>
      [...sportsTickets.values()]
        .filter((row) => row.chainId === chainId)
        .filter((row) => row.marketId === marketId)
        .filter((row) => row.state === "held")
        .sort(compareSportsTicketRows)
        .slice(0, limit)
        .map((row) => BigInt(row.ticketId)),
    getAffiliateBets: async ({ affiliate, chainId, limit }) =>
      [...bets.values()]
        .filter((row) => row.chainId === chainId)
        .filter((row) => row.pricingAffiliate?.toLowerCase() === affiliate.toLowerCase())
        .sort(compareBetRows)
        .slice(0, limit),
    getAffiliateStats: async ({ affiliate, chainId }) =>
      affiliateStatsFromRows({
        affiliate,
        rows: [...bets.values()].filter(
          (row) =>
            row.chainId === chainId &&
            row.pricingAffiliate?.toLowerCase() === affiliate.toLowerCase()
        )
      }),
    getCasinoStats: async ({ asset, chainId, since }) =>
      casinoStatsFromRows({
        asset,
        rows: [...bets.values()].filter(
          (row) =>
            row.chainId === chainId &&
            row.asset?.toLowerCase() === asset.toLowerCase() &&
            withinSince(row, since)
        )
      }),
    getCasinoLeaderboard: async ({ asset, chainId, limit, gameId, since }) =>
      casinoLeaderboardFromRows({
        asset,
        limit,
        rows: [...bets.values()].filter(
          (row) =>
            row.chainId === chainId &&
            row.asset?.toLowerCase() === asset.toLowerCase() &&
            (!gameId || row.gameId?.toLowerCase() === gameId.toLowerCase()) &&
            withinSince(row, since)
        )
      }),
    getCasinoTopWins: async ({ asset, chainId, limit, gameId, since }) =>
      casinoTopWinsFromRows({
        asset,
        limit,
        rows: [...bets.values()].filter(
          (row) =>
            row.chainId === chainId &&
            row.asset?.toLowerCase() === asset.toLowerCase() &&
            (!gameId || row.gameId?.toLowerCase() === gameId.toLowerCase()) &&
            withinSince(row, since)
        )
      }),
    getCasinoPlayerRank: async ({ asset, chainId, player, gameId, since }) =>
      casinoPlayerRankFromRows({
        asset,
        player,
        rows: [...bets.values()].filter(
          (row) =>
            row.chainId === chainId &&
            row.asset?.toLowerCase() === asset.toLowerCase() &&
            (!gameId || row.gameId?.toLowerCase() === gameId.toLowerCase()) &&
            withinSince(row, since)
        )
      }),
    getGameVolumes: async ({ asset, chainId, since }) =>
      gameVolumesFromRows({
        asset,
        rows: [...bets.values()].filter(
          (row) =>
            row.chainId === chainId &&
            row.asset?.toLowerCase() === asset.toLowerCase() &&
            withinSince(row, since)
        )
      }),
    getCasinoTimeseries: async ({ asset, chainId, days, gameId }) =>
      casinoTimeseriesFromRows({
        asset,
        days,
        rows: [...bets.values()].filter(
          (row) =>
            row.chainId === chainId &&
            row.asset?.toLowerCase() === asset.toLowerCase() &&
            (!gameId || row.gameId?.toLowerCase() === gameId.toLowerCase())
        )
      }),
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
    onnotice: () => undefined,
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
              chain_id, game_hub, block_number, block_timestamp, tx_hash, log_index, event_name,
              args_json
            ) values (
              ${event.chainId},
              ${event.gameHub.toLowerCase()},
              ${event.blockNumber.toString()},
              ${event.blockTimestamp == null ? null : new Date(event.blockTimestamp)},
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
              chain_id, bet_id, state, game_id, asset, player, pricing_affiliate, stake, payout,
              payout_gross, refund_amount, request_id, random_hash, terminal_tx_hash,
              finalized_tx_hash, refunded_tx_hash, placed_block, placed_at,
              updated_block, last_tx_hash, last_event_name, updated_at
            ) values (
              ${row.chainId},
              ${row.betId},
              ${row.state},
              ${row.gameId?.toLowerCase() ?? null},
              ${row.asset?.toLowerCase() ?? null},
              ${row.player?.toLowerCase() ?? null},
              ${row.pricingAffiliate?.toLowerCase() ?? null},
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
              ${row.placedAt == null ? null : new Date(row.placedAt)},
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
              pricing_affiliate = coalesce(excluded.pricing_affiliate, bets.pricing_affiliate),
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
              placed_at = coalesce(bets.placed_at, excluded.placed_at),
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
    writeSportsHubEvents: async (events: readonly SportsTicketIndexEvent[]) => {
      if (events.length === 0) return [];
      const rows = foldSportsTicketIndexEvents(events);
      await sql.begin(async (tx) => {
        for (const row of rows) {
          await tx`
            insert into sport_tickets (
              chain_id, ticket_id, position_id, market_id, event_id, pool_id, outcome_id, player,
              stake, payout, reserved, refund_amount, odds_snapshot_hash, rulebook_hash, state,
              placed_block, updated_block, last_tx_hash, last_event_name, terminal_tx_hash,
              settled_tx_hash, refunded_tx_hash, voided_tx_hash, updated_at
            ) values (
              ${row.chainId},
              ${row.ticketId},
              ${row.positionId ?? null},
              ${row.marketId ?? null},
              ${row.eventId ?? null},
              ${row.poolId ?? null},
              ${row.outcomeId ?? null},
              ${row.player?.toLowerCase() ?? null},
              ${row.stake ?? null},
              ${row.payout ?? null},
              ${row.reserved ?? null},
              ${row.refundAmount ?? null},
              ${row.oddsSnapshotHash?.toLowerCase() ?? null},
              ${row.rulebookHash?.toLowerCase() ?? null},
              ${row.state},
              ${row.placedBlock ?? null},
              ${row.updatedBlock},
              ${row.lastTxHash.toLowerCase()},
              ${row.lastEventName},
              ${row.terminalTxHash?.toLowerCase() ?? null},
              ${row.settledTxHash?.toLowerCase() ?? null},
              ${row.refundedTxHash?.toLowerCase() ?? null},
              ${row.voidedTxHash?.toLowerCase() ?? null},
              ${new Date(row.updatedAt)}
            )
            on conflict (chain_id, ticket_id) do update set
              position_id = coalesce(excluded.position_id, sport_tickets.position_id),
              market_id = coalesce(excluded.market_id, sport_tickets.market_id),
              event_id = coalesce(excluded.event_id, sport_tickets.event_id),
              pool_id = coalesce(excluded.pool_id, sport_tickets.pool_id),
              outcome_id = coalesce(excluded.outcome_id, sport_tickets.outcome_id),
              player = coalesce(excluded.player, sport_tickets.player),
              stake = coalesce(excluded.stake, sport_tickets.stake),
              payout = coalesce(excluded.payout, sport_tickets.payout),
              reserved = coalesce(excluded.reserved, sport_tickets.reserved),
              refund_amount = coalesce(excluded.refund_amount, sport_tickets.refund_amount),
              odds_snapshot_hash = coalesce(
                excluded.odds_snapshot_hash,
                sport_tickets.odds_snapshot_hash
              ),
              rulebook_hash = coalesce(excluded.rulebook_hash, sport_tickets.rulebook_hash),
              state = case
                when excluded.updated_block >= sport_tickets.updated_block then excluded.state
                else sport_tickets.state
              end,
              placed_block = coalesce(sport_tickets.placed_block, excluded.placed_block),
              updated_block = greatest(sport_tickets.updated_block, excluded.updated_block),
              last_tx_hash = case
                when excluded.updated_block >= sport_tickets.updated_block then excluded.last_tx_hash
                else sport_tickets.last_tx_hash
              end,
              last_event_name = case
                when excluded.updated_block >= sport_tickets.updated_block then excluded.last_event_name
                else sport_tickets.last_event_name
              end,
              terminal_tx_hash = coalesce(
                excluded.terminal_tx_hash,
                sport_tickets.terminal_tx_hash
              ),
              settled_tx_hash = coalesce(excluded.settled_tx_hash, sport_tickets.settled_tx_hash),
              refunded_tx_hash = coalesce(
                excluded.refunded_tx_hash,
                sport_tickets.refunded_tx_hash
              ),
              voided_tx_hash = coalesce(excluded.voided_tx_hash, sport_tickets.voided_tx_hash),
              updated_at = case
                when excluded.updated_block >= sport_tickets.updated_block then excluded.updated_at
                else sport_tickets.updated_at
              end
          `;
        }
      });
      return rows;
    },
    writeBankProviderLedgerRows: async (rows: readonly BankProviderLedgerRow[]) => {
      if (rows.length === 0) return [];
      await sql.begin(async (tx) => {
        for (const row of rows) {
          await tx`
            insert into bank_provider_ledger (
              chain_id, pool_id, owner, bank, asset, action, tx_hash, block_number, log_index,
              timestamp, asset_amount, share_amount, share_price, updated_at
            ) values (
              ${row.chainId},
              ${String(row.poolId)},
              ${row.owner.toLowerCase()},
              ${row.bank.toLowerCase()},
              ${row.asset.toLowerCase()},
              ${row.action},
              ${row.txHash.toLowerCase()},
              ${row.blockNumber},
              ${row.logIndex},
              ${row.timestamp == null ? null : new Date(row.timestamp)},
              ${row.assets ?? null},
              ${row.shares},
              ${row.sharePrice ?? null},
              ${new Date(row.updatedAt)}
            )
            on conflict (chain_id, tx_hash, log_index) do update set
              pool_id = excluded.pool_id,
              owner = excluded.owner,
              bank = excluded.bank,
              asset = excluded.asset,
              action = excluded.action,
              block_number = excluded.block_number,
              timestamp = excluded.timestamp,
              asset_amount = excluded.asset_amount,
              share_amount = excluded.share_amount,
              share_price = excluded.share_price,
              updated_at = excluded.updated_at
          `;
        }
      });
      return [...rows];
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
    getPlayerSportsTickets: async ({ chainId, player, limit }) => {
      const rows = await sql`
        select * from sport_tickets
        where chain_id = ${chainId} and player = ${player.toLowerCase()}
        order by updated_block desc, ticket_id desc
        limit ${limit}
      `;
      return rows.map(sportsTicketRowFromDatabase).sort(compareSportsTicketRows);
    },
    getBankProviderLedger: async ({
      beforeBlock,
      beforeLogIndex,
      chainId,
      limit,
      owner,
      poolId
    }) => {
      const cursorFilter =
        beforeBlock != null && beforeLogIndex != null
          ? sql`
              and (
                block_number < ${beforeBlock}
                or (block_number = ${beforeBlock} and log_index < ${beforeLogIndex})
              )
            `
          : sql``;
      const rows = await sql`
        select * from bank_provider_ledger
        where chain_id = ${chainId}
          and pool_id = ${String(poolId)}
          and owner = ${owner.toLowerCase()}
          ${cursorFilter}
        order by block_number desc, log_index desc
        limit ${limit}
      `;
      return rows.map(bankProviderLedgerRowFromDatabase).sort(compareBankProviderLedgerRows);
    },
    getHeldSportsTicketIdsByMarket: async ({ chainId, limit, marketId }) => {
      const rows = await sql`
        select ticket_id from sport_tickets
        where chain_id = ${chainId} and market_id = ${marketId} and state = 'held'
        order by updated_block desc, ticket_id desc
        limit ${limit}
      `;
      return rows.map((row) => BigInt(String(row.ticketId)));
    },
    getAffiliateBets: async ({ affiliate, chainId, limit }) => {
      const rows = await sql`
        select * from bets
        where chain_id = ${chainId} and pricing_affiliate = ${affiliate.toLowerCase()}
        order by updated_block desc, bet_id desc
        limit ${limit}
      `;
      return rows.map(rowFromDatabase).sort(compareBetRows);
    },
    getAffiliateStats: async ({ affiliate, chainId }) => {
      const rows = await sql`
        select
          count(*)::text as bet_count,
          count(*) filter (where state in ('finalized', 'refunded'))::text as settled_count,
          coalesce(sum(nullif(stake, '')::numeric), 0)::text as turnover,
          coalesce(sum(nullif(payout, '')::numeric), 0)::text as payout,
          coalesce(sum(nullif(payout_gross, '')::numeric), 0)::text as payout_gross
        from bets
        where chain_id = ${chainId} and pricing_affiliate = ${affiliate.toLowerCase()}
      `;
      const row = rows[0] ?? {};
      return {
        affiliate,
        betCount: Number(row.betCount ?? 0),
        settledCount: Number(row.settledCount ?? 0),
        turnover: String(row.turnover ?? "0"),
        payout: String(row.payout ?? "0"),
        payoutGross: String(row.payoutGross ?? "0")
      };
    },
    getCasinoStats: async ({ asset, chainId, since }) => {
      const rows = await sql`
        select
          count(*)::text as bet_count,
          count(*) filter (where state in ('finalized', 'refunded'))::text as settled_count,
          count(*) filter (
            where state = 'finalized'
              and nullif(payout, '')::numeric > coalesce(nullif(stake, '')::numeric, 0)
          )::text as won_count,
          count(distinct player) filter (where player is not null)::text as unique_players,
          coalesce(sum(nullif(stake, '')::numeric), 0)::text as turnover,
          coalesce(sum(nullif(payout, '')::numeric), 0)::text as payout,
          coalesce(sum(nullif(payout_gross, '')::numeric), 0)::text as payout_gross
        from bets
        where chain_id = ${chainId} and asset = ${asset.toLowerCase()}
          ${since != null ? sql`and coalesce(placed_at, updated_at) >= to_timestamp(${since})` : sql``}
      `;
      const row = rows[0] ?? {};
      return {
        asset: asset.toLowerCase() as Address,
        betCount: Number(row.betCount ?? 0),
        settledCount: Number(row.settledCount ?? 0),
        wonCount: Number(row.wonCount ?? 0),
        uniquePlayers: Number(row.uniquePlayers ?? 0),
        turnover: String(row.turnover ?? "0"),
        payout: String(row.payout ?? "0"),
        payoutGross: String(row.payoutGross ?? "0")
      };
    },
    getCasinoLeaderboard: async ({ asset, chainId, limit, gameId, since }) => {
      const rows = await sql`
        select
          player,
          count(*)::text as bet_count,
          count(*) filter (where state in ('finalized', 'refunded'))::text as settled_count,
          coalesce(sum(nullif(stake, '')::numeric), 0)::text as turnover,
          coalesce(sum(nullif(payout, '')::numeric), 0)::text as payout,
          coalesce(sum(nullif(payout_gross, '')::numeric), 0)::text as payout_gross
        from bets
        where chain_id = ${chainId} and asset = ${asset.toLowerCase()} and player is not null
        ${gameId ? sql`and game_id = ${gameId.toLowerCase()}` : sql``}
        ${since != null ? sql`and coalesce(placed_at, updated_at) >= to_timestamp(${since})` : sql``}
        group by player
        order by coalesce(sum(nullif(stake, '')::numeric), 0) desc, count(*) desc, player asc
        limit ${limit}
      `;
      return rows.map((row) => ({
        asset: asset.toLowerCase() as Address,
        player: String(row.player).toLowerCase() as Address,
        betCount: Number(row.betCount ?? 0),
        settledCount: Number(row.settledCount ?? 0),
        turnover: String(row.turnover ?? "0"),
        payout: String(row.payout ?? "0"),
        payoutGross: String(row.payoutGross ?? "0")
      }));
    },
    getCasinoTopWins: async ({ asset, chainId, limit, gameId, since }) => {
      const rows = await sql`
        select
          bet_id,
          game_id,
          player,
          stake,
          payout,
          payout_gross,
          floor((coalesce(nullif(payout, '')::numeric, 0) * 1000000) / nullif(stake, '')::numeric)::text as multiplier_ppm
        from bets
        where chain_id = ${chainId}
          and asset = ${asset.toLowerCase()}
          and player is not null
          and state = 'finalized'
          and coalesce(nullif(stake, '')::numeric, 0) > 0
          and coalesce(nullif(payout, '')::numeric, 0) > coalesce(nullif(stake, '')::numeric, 0)
          ${gameId ? sql`and game_id = ${gameId.toLowerCase()}` : sql``}
          ${since != null ? sql`and coalesce(placed_at, updated_at) >= to_timestamp(${since})` : sql``}
        order by
          (coalesce(nullif(payout, '')::numeric, 0) / nullif(stake, '')::numeric) desc,
          coalesce(nullif(payout, '')::numeric, 0) desc,
          bet_id desc
        limit ${limit}
      `;
      return rows.map((row) => ({
        asset: asset.toLowerCase() as Address,
        betId: String(row.betId),
        gameId: row.gameId ? (String(row.gameId).toLowerCase() as Hex) : undefined,
        multiplierPpm: String(row.multiplierPpm ?? "0"),
        payout: String(row.payout ?? "0"),
        payoutGross: String(row.payoutGross ?? "0"),
        player: String(row.player).toLowerCase() as Address,
        stake: String(row.stake ?? "0")
      }));
    },
    getCasinoPlayerRank: async ({ asset, chainId, player, gameId, since }) => {
      // Rank every player by turnover (matching the leaderboard ordering), then
      // pluck the requested player's row. The window ordering tuple is unique
      // per player, so rank() yields a precise 1-based position with no ties.
      const rows = await sql`
        select rnk, bet_count, turnover from (
          select
            player,
            count(*)::text as bet_count,
            coalesce(sum(nullif(stake, '')::numeric), 0)::text as turnover,
            rank() over (
              order by coalesce(sum(nullif(stake, '')::numeric), 0) desc, count(*) desc, player asc
            )::text as rnk
          from bets
          where chain_id = ${chainId} and asset = ${asset.toLowerCase()} and player is not null
          ${gameId ? sql`and game_id = ${gameId.toLowerCase()}` : sql``}
          ${since != null ? sql`and coalesce(placed_at, updated_at) >= to_timestamp(${since})` : sql``}
          group by player
        ) ranked
        where player = ${player.toLowerCase()}
        limit 1
      `;
      const row = rows[0];
      if (!row) return null;
      return {
        asset: asset.toLowerCase() as Address,
        betCount: Number(row.betCount ?? 0),
        player: player.toLowerCase() as Address,
        rank: Number(row.rnk ?? 0),
        turnover: String(row.turnover ?? "0")
      };
    },
    getGameVolumes: async ({ asset, chainId, since }) => {
      const rows = await sql`
        select
          game_id,
          count(*)::text as bet_count,
          count(*) filter (where state in ('finalized', 'refunded'))::text as settled_count,
          count(*) filter (
            where state = 'finalized'
              and nullif(payout, '')::numeric > coalesce(nullif(stake, '')::numeric, 0)
          )::text as won_count,
          count(distinct player) filter (where player is not null)::text as unique_players,
          coalesce(sum(nullif(stake, '')::numeric), 0)::text as turnover,
          coalesce(sum(nullif(payout, '')::numeric), 0)::text as payout,
          coalesce(sum(nullif(payout_gross, '')::numeric), 0)::text as payout_gross
        from bets
        where chain_id = ${chainId} and asset = ${asset.toLowerCase()} and game_id is not null
          ${since != null ? sql`and coalesce(placed_at, updated_at) >= to_timestamp(${since})` : sql``}
        group by game_id
        order by coalesce(sum(nullif(stake, '')::numeric), 0) desc, game_id asc
      `;
      return rows.map((row) => ({
        asset: asset.toLowerCase() as Address,
        gameId: String(row.gameId).toLowerCase() as Hex,
        betCount: Number(row.betCount ?? 0),
        settledCount: Number(row.settledCount ?? 0),
        wonCount: Number(row.wonCount ?? 0),
        uniquePlayers: Number(row.uniquePlayers ?? 0),
        turnover: String(row.turnover ?? "0"),
        payout: String(row.payout ?? "0"),
        payoutGross: String(row.payoutGross ?? "0")
      }));
    },
    getCasinoTimeseries: async ({ asset, chainId, days, gameId }) => {
      const boundedDays = Math.max(1, Math.min(366, Math.trunc(days)));
      const rows = await sql`
        select
          to_char(date_trunc('day', coalesce(placed_at, updated_at) at time zone 'utc'), 'YYYY-MM-DD') as date,
          count(*)::text as bet_count,
          count(*) filter (where state in ('finalized', 'refunded'))::text as settled_count,
          count(*) filter (
            where state = 'finalized'
              and nullif(payout, '')::numeric > coalesce(nullif(stake, '')::numeric, 0)
          )::text as won_count,
          count(distinct player) filter (where player is not null)::text as unique_players,
          coalesce(sum(nullif(stake, '')::numeric), 0)::text as turnover,
          coalesce(sum(nullif(payout, '')::numeric), 0)::text as payout,
          coalesce(sum(nullif(payout_gross, '')::numeric), 0)::text as payout_gross
        from bets
        where chain_id = ${chainId}
          and asset = ${asset.toLowerCase()}
          ${gameId ? sql`and game_id = ${gameId.toLowerCase()}` : sql``}
          and coalesce(placed_at, updated_at) >= now() - (${boundedDays.toString()} || ' days')::interval
        group by date
        order by date asc
      `;
      return rows.map((row) => ({
        asset: asset.toLowerCase() as Address,
        betCount: Number(row.betCount ?? 0),
        date: String(row.date),
        payout: String(row.payout ?? "0"),
        payoutGross: String(row.payoutGross ?? "0"),
        settledCount: Number(row.settledCount ?? 0),
        turnover: String(row.turnover ?? "0"),
        uniquePlayers: Number(row.uniquePlayers ?? 0),
        wonCount: Number(row.wonCount ?? 0)
      }));
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

function compareEvents(
  a: Pick<BetIndexEvent | SportsTicketIndexEvent, "blockNumber" | "logIndex">,
  b: Pick<BetIndexEvent | SportsTicketIndexEvent, "blockNumber" | "logIndex">
) {
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

export function compareSportsTicketRows(a: SportsTicketRow, b: SportsTicketRow) {
  if (b.updatedBlock !== a.updatedBlock) return b.updatedBlock - a.updatedBlock;
  const aId = BigInt(a.ticketId);
  const bId = BigInt(b.ticketId);
  if (bId === aId) return 0;
  return bId > aId ? 1 : -1;
}

export function compareBankProviderLedgerRows(a: BankProviderLedgerRow, b: BankProviderLedgerRow) {
  if (b.blockNumber !== a.blockNumber) return b.blockNumber - a.blockNumber;
  return b.logIndex - a.logIndex;
}

function isBankProviderLedgerBeforeCursor(
  row: BankProviderLedgerRow,
  beforeBlock?: number,
  beforeLogIndex?: number
) {
  if (beforeBlock == null || beforeLogIndex == null) return true;
  if (row.blockNumber < beforeBlock) return true;
  return row.blockNumber === beforeBlock && row.logIndex < beforeLogIndex;
}

export function foldSportsTicketIndexEvents(events: readonly SportsTicketIndexEvent[]) {
  const rows = new Map<string, SportsTicketRow>();
  const sorted = [...events].sort(compareEvents);

  for (const event of sorted) {
    const ticketId = String(event.args.ticketId ?? event.args.id ?? "0");
    const key = `${event.chainId}:${ticketId}`;
    rows.set(key, applyEventToSportsTicket(rows.get(key), event));
  }

  return [...rows.values()];
}

function affiliateStatsFromRows({
  affiliate,
  rows
}: {
  affiliate: Address;
  rows: readonly BetRow[];
}): BetIndexAffiliateStats {
  return rows.reduce<BetIndexAffiliateStats>(
    (stats, row) => {
      stats.betCount += 1;
      if (row.state === "finalized" || row.state === "refunded") stats.settledCount += 1;
      stats.turnover = addStringBigints(stats.turnover, row.stake);
      stats.payout = addStringBigints(stats.payout, row.payout);
      stats.payoutGross = addStringBigints(stats.payoutGross, row.payoutGross);
      return stats;
    },
    {
      affiliate,
      betCount: 0,
      payout: "0",
      payoutGross: "0",
      settledCount: 0,
      turnover: "0"
    }
  );
}

function casinoStatsFromRows({
  asset,
  rows
}: {
  asset: Address;
  rows: readonly BetRow[];
}): BetIndexCasinoStats {
  const players = new Set<string>();
  const stats = rows.reduce<BetIndexCasinoStats>(
    (next, row) => {
      next.betCount += 1;
      if (row.state === "finalized" || row.state === "refunded") next.settledCount += 1;
      if (row.state === "finalized") {
        const stake = BigInt(row.stake || "0");
        const payout = BigInt(row.payout || "0");
        if (payout > stake) next.wonCount += 1;
      }
      if (row.player) players.add(row.player.toLowerCase());
      next.turnover = addStringBigints(next.turnover, row.stake);
      next.payout = addStringBigints(next.payout, row.payout);
      next.payoutGross = addStringBigints(next.payoutGross, row.payoutGross);
      return next;
    },
    {
      asset: asset.toLowerCase() as Address,
      betCount: 0,
      payout: "0",
      payoutGross: "0",
      settledCount: 0,
      wonCount: 0,
      turnover: "0",
      uniquePlayers: 0
    }
  );
  stats.uniquePlayers = players.size;
  return stats;
}

function casinoLeaderboardFromRows({
  asset,
  limit,
  rows
}: {
  asset: Address;
  limit: number;
  rows: readonly BetRow[];
}): BetIndexCasinoLeaderboardEntry[] {
  const byPlayer = new Map<string, BetRow[]>();
  for (const row of rows) {
    if (!row.player) continue;
    const player = row.player.toLowerCase();
    byPlayer.set(player, [...(byPlayer.get(player) ?? []), row]);
  }

  return [...byPlayer.entries()]
    .map(([player, playerRows]) => {
      const stats = casinoStatsFromRows({ asset, rows: playerRows });
      return {
        asset: asset.toLowerCase() as Address,
        player: player as Address,
        betCount: stats.betCount,
        settledCount: stats.settledCount,
        turnover: stats.turnover,
        payout: stats.payout,
        payoutGross: stats.payoutGross
      };
    })
    .sort((a, b) => {
      const turnoverDelta = BigInt(b.turnover || "0") - BigInt(a.turnover || "0");
      if (turnoverDelta !== 0n) return turnoverDelta > 0n ? 1 : -1;
      if (b.betCount !== a.betCount) return b.betCount - a.betCount;
      return a.player.localeCompare(b.player);
    })
    .slice(0, limit);
}

function casinoPlayerRankFromRows({
  asset,
  player,
  rows
}: {
  asset: Address;
  player: Address;
  rows: readonly BetRow[];
}): BetIndexCasinoPlayerRank | null {
  // Reuse the same ordering as the leaderboard so the rank matches what the
  // player would see in the list. limit = full board so we get every position.
  const board = casinoLeaderboardFromRows({ asset, limit: Number.MAX_SAFE_INTEGER, rows });
  const target = player.toLowerCase();
  const index = board.findIndex((entry) => entry.player.toLowerCase() === target);
  if (index === -1) return null;
  const entry = board[index]!;
  return {
    asset: asset.toLowerCase() as Address,
    betCount: entry.betCount,
    player: target as Address,
    rank: index + 1,
    turnover: entry.turnover
  };
}

function casinoTopWinsFromRows({
  asset,
  limit,
  rows
}: {
  asset: Address;
  limit: number;
  rows: readonly BetRow[];
}): BetIndexCasinoTopWinEntry[] {
  return rows
    .flatMap((row) => {
      if (!row.player || row.state !== "finalized") return [];
      const stake = BigInt(row.stake || "0");
      const payout = BigInt(row.payout || "0");
      if (stake <= 0n || payout <= stake) return [];
      return [
        {
          asset: asset.toLowerCase() as Address,
          betId: row.betId,
          gameId: row.gameId?.toLowerCase() as Hex | undefined,
          multiplierPpm: ((payout * 1_000_000n) / stake).toString(),
          payout: row.payout ?? "0",
          payoutGross: row.payoutGross ?? "0",
          player: row.player.toLowerCase() as Address,
          stake: row.stake ?? "0"
        }
      ];
    })
    .sort((a, b) => {
      const multiplierDelta = BigInt(b.multiplierPpm) - BigInt(a.multiplierPpm);
      if (multiplierDelta !== 0n) return multiplierDelta > 0n ? 1 : -1;
      const payoutDelta = BigInt(b.payout || "0") - BigInt(a.payout || "0");
      if (payoutDelta !== 0n) return payoutDelta > 0n ? 1 : -1;
      const aId = BigInt(a.betId);
      const bId = BigInt(b.betId);
      if (bId !== aId) return bId > aId ? 1 : -1;
      return a.player.localeCompare(b.player);
    })
    .slice(0, limit);
}

function gameVolumesFromRows({
  asset,
  rows
}: {
  asset: Address;
  rows: readonly BetRow[];
}): BetIndexGameVolume[] {
  const byGame = new Map<string, BetRow[]>();
  for (const row of rows) {
    if (!row.gameId) continue;
    const gameId = row.gameId.toLowerCase();
    byGame.set(gameId, [...(byGame.get(gameId) ?? []), row]);
  }

  return [...byGame.entries()]
    .map(([gameId, gameRows]) => {
      const stats = casinoStatsFromRows({ asset, rows: gameRows });
      return {
        asset: asset.toLowerCase() as Address,
        gameId: gameId as Hex,
        betCount: stats.betCount,
        settledCount: stats.settledCount,
        wonCount: stats.wonCount,
        uniquePlayers: stats.uniquePlayers,
        turnover: stats.turnover,
        payout: stats.payout,
        payoutGross: stats.payoutGross
      };
    })
    .sort((a, b) => {
      const turnoverDelta = BigInt(b.turnover || "0") - BigInt(a.turnover || "0");
      if (turnoverDelta !== 0n) return turnoverDelta > 0n ? 1 : -1;
      return a.gameId.localeCompare(b.gameId);
    });
}

function casinoTimeseriesFromRows({
  asset,
  days,
  rows
}: {
  asset: Address;
  days: number;
  rows: readonly BetRow[];
}): BetIndexCasinoTimeseriesPoint[] {
  const boundedDays = Math.max(1, Math.min(366, Math.trunc(days)));
  const cutoff = Date.now() - boundedDays * 24 * 60 * 60 * 1000;
  const byDate = new Map<string, BetRow[]>();
  for (const row of rows) {
    const timestamp = row.placedAt ?? row.updatedAt;
    if (timestamp < cutoff) continue;
    const date = new Date(timestamp).toISOString().slice(0, 10);
    byDate.set(date, [...(byDate.get(date) ?? []), row]);
  }

  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, dateRows]) => {
      const stats = casinoStatsFromRows({ asset, rows: dateRows });
      return {
        asset: asset.toLowerCase() as Address,
        betCount: stats.betCount,
        date,
        payout: stats.payout,
        payoutGross: stats.payoutGross,
        settledCount: stats.settledCount,
        turnover: stats.turnover,
        uniquePlayers: stats.uniquePlayers,
        wonCount: stats.wonCount
      };
    });
}

function addStringBigints(left: string, right: string | undefined) {
  return (BigInt(left || "0") + BigInt(right || "0")).toString();
}

/**
 * In-memory time-window guard. `since` is a unix-seconds lower bound on chain
 * placement time; rows older than it are excluded. Falls back to updatedAt when
 * placedAt is missing (mirrors the postgres `coalesce(placed_at, updated_at)`).
 */
function withinSince(row: BetRow, since?: number): boolean {
  if (since == null) return true;
  return (row.placedAt ?? row.updatedAt) >= since * 1000;
}

function eventTimestampMs(event: BetIndexEvent) {
  return event.blockTimestamp ?? Date.now();
}

function applyEventToBet(prev: BetRow | undefined, event: BetIndexEvent): BetRow {
  const betId = String(event.args.positionId ?? event.args.betId ?? event.args.id ?? "0");
  const timestamp = eventTimestampMs(event);
  const next: BetRow = prev
    ? { ...prev }
    : {
        betId,
        chainId: event.chainId,
        id: `${event.chainId}:${betId}`,
        lastEventName: event.eventName,
        lastTxHash: event.txHash,
        state: "placed",
        updatedAt: timestamp,
        updatedBlock: Number(event.blockNumber)
      };

  if (event.eventName === "BetPlaced") {
    if (event.args.gameId) next.gameId = event.args.gameId as BetRow["gameId"];
    if (event.args.asset) next.asset = event.args.asset as BetRow["asset"];
    if (event.args.player) next.player = event.args.player as BetRow["player"];
    if (event.args.user && !next.player) next.player = event.args.user as BetRow["player"];
    if (event.args.pricingAffiliate) {
      next.pricingAffiliate = event.args.pricingAffiliate as BetRow["pricingAffiliate"];
    }
    if (event.args.stake != null) next.stake = toBigintString(event.args.stake);
    if (event.args.requestId != null) next.requestId = toBigintString(event.args.requestId);
    next.placedBlock = Number(event.blockNumber);
    next.placedAt = timestamp;
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
  next.updatedAt = timestamp;
  return next;
}

function applyEventToSportsTicket(
  prev: SportsTicketRow | undefined,
  event: SportsTicketIndexEvent
): SportsTicketRow {
  const ticketId = String(event.args.ticketId ?? event.args.id ?? "0");
  const next: SportsTicketRow = prev
    ? { ...prev }
    : {
        chainId: event.chainId,
        id: `${event.chainId}:sports:${ticketId}`,
        lastEventName: event.eventName,
        lastTxHash: event.txHash,
        state: "held",
        ticketId,
        updatedAt: Date.now(),
        updatedBlock: Number(event.blockNumber)
      };

  if (event.eventName === "TicketPlaced") {
    if (event.args.positionId != null) next.positionId = toBigintString(event.args.positionId);
    if (event.args.marketId != null) next.marketId = toBigintString(event.args.marketId);
    if (event.args.eventId != null) next.eventId = toBigintString(event.args.eventId);
    if (event.args.poolId != null) next.poolId = toBigintString(event.args.poolId);
    if (event.args.outcomeId != null) next.outcomeId = Number(event.args.outcomeId);
    if (event.args.player) next.player = event.args.player as SportsTicketRow["player"];
    if (event.args.stake != null) next.stake = toBigintString(event.args.stake);
    if (event.args.payout != null) next.payout = toBigintString(event.args.payout);
    if (event.args.reserved != null) next.reserved = toBigintString(event.args.reserved);
    if (event.args.oddsSnapshotHash) {
      next.oddsSnapshotHash = event.args.oddsSnapshotHash as SportsTicketRow["oddsSnapshotHash"];
    }
    if (event.args.rulebookHash) {
      next.rulebookHash = event.args.rulebookHash as SportsTicketRow["rulebookHash"];
    }
    next.placedBlock = Number(event.blockNumber);
  }

  if (event.eventName === "TicketSettled") {
    if (event.args.positionId != null) next.positionId = toBigintString(event.args.positionId);
    if (event.args.payout != null) next.payout = toBigintString(event.args.payout);
    next.state = "settled";
    next.terminalTxHash = event.txHash;
    next.settledTxHash = event.txHash;
  }

  if (event.eventName === "TicketRefunded") {
    if (event.args.positionId != null) next.positionId = toBigintString(event.args.positionId);
    if (event.args.refundAmount != null) {
      next.refundAmount = toBigintString(event.args.refundAmount);
      next.payout = next.refundAmount;
    }
    next.state = "refunded";
    next.terminalTxHash = event.txHash;
    next.refundedTxHash = event.txHash;
  }

  if (event.eventName === "TicketVoided") {
    if (event.args.positionId != null) next.positionId = toBigintString(event.args.positionId);
    if (event.args.refundAmount != null) {
      next.refundAmount = toBigintString(event.args.refundAmount);
      next.payout = next.refundAmount;
    }
    next.state = "voided";
    next.terminalTxHash = event.txHash;
    next.voidedTxHash = event.txHash;
  }

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
    placedAt: optionalDateMs(row.placedAt),
    placedBlock: optionalNumber(row.placedBlock),
    player: optionalAddress(row.player),
    pricingAffiliate: optionalAddress(row.pricingAffiliate),
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

function optionalDateMs(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function sportsTicketRowFromDatabase(row: Record<string, unknown>): SportsTicketRow {
  return {
    chainId: Number(row.chainId),
    eventId: optionalString(row.eventId),
    id: `${Number(row.chainId)}:sports:${String(row.ticketId)}`,
    lastEventName: String(row.lastEventName),
    lastTxHash: String(row.lastTxHash) as Hex,
    marketId: optionalString(row.marketId),
    oddsSnapshotHash: optionalHex(row.oddsSnapshotHash),
    outcomeId: optionalNumber(row.outcomeId),
    payout: optionalString(row.payout),
    placedBlock: optionalNumber(row.placedBlock),
    player: optionalAddress(row.player),
    poolId: optionalString(row.poolId),
    positionId: optionalString(row.positionId),
    refundAmount: optionalString(row.refundAmount),
    refundedTxHash: optionalHex(row.refundedTxHash),
    reserved: optionalString(row.reserved),
    rulebookHash: optionalHex(row.rulebookHash),
    settledTxHash: optionalHex(row.settledTxHash),
    stake: optionalString(row.stake),
    state: normalizeSportsTicketState(row.state),
    terminalTxHash: optionalHex(row.terminalTxHash),
    ticketId: String(row.ticketId),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.getTime() : Date.now(),
    updatedBlock: Number(row.updatedBlock),
    voidedTxHash: optionalHex(row.voidedTxHash)
  };
}

function bankProviderLedgerRowFromDatabase(row: Record<string, unknown>): BankProviderLedgerRow {
  const chainId = Number(row.chainId);
  const txHash = String(row.txHash).toLowerCase() as Hex;
  const logIndex = Number(row.logIndex);
  return {
    action: normalizeBankProviderLedgerAction(row.action),
    asset: String(row.asset).toLowerCase() as Address,
    assets: optionalString(row.assetAmount),
    bank: String(row.bank).toLowerCase() as Address,
    blockNumber: Number(row.blockNumber),
    chainId,
    id: bankProviderLedgerId(chainId, txHash, logIndex),
    logIndex,
    owner: String(row.owner).toLowerCase() as Address,
    poolId: String(row.poolId),
    sharePrice: optionalString(row.sharePrice),
    shares: String(row.shareAmount ?? "0"),
    timestamp: optionalDateMs(row.timestamp),
    txHash,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.getTime() : Date.now()
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

function normalizeSportsTicketState(value: unknown): SportsTicketLifecycleState {
  if (value === "held" || value === "settled" || value === "refunded" || value === "voided") {
    return value;
  }
  return "held";
}

function normalizeBankProviderLedgerAction(value: unknown): BankProviderLedgerAction {
  return value === "withdraw" ? "withdraw" : "deposit";
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

function bankProviderLedgerId(chainId: number, txHash: Hex, logIndex: number) {
  return `${chainId}:bank-provider:${txHash.toLowerCase()}:${logIndex}`;
}
