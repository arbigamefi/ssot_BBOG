import { randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";
import { afterEach, describe, expect, it } from "vitest";
import { createPostgresBetIndexStoreFromSql, type BetIndexEvent } from "./index.js";

// Explicit local-only opt in. Every test owns a separate disposable schema.
const url = process.env.KEEPER_TEST_POSTGRES_URL;
if (url && !["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname)) {
  throw new Error("KEEPER_TEST_POSTGRES_URL must target a local disposable PostgreSQL instance");
}

const chainId = 84532;
const v15Hub = "0x00000000000000000000000000000000000000a5" as const;
const v16Hub = "0x00000000000000000000000000000000000000a6" as const;

// The tables as they were before bets were keyed by GameHub.
const LEGACY_SCHEMA = `
create table gamehub_events (
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
create table bets (
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
`;

function placed(gameHub: `0x${string}`, betId: bigint, block: bigint, tx: string): BetIndexEvent {
  return {
    chainId,
    gameHub,
    blockNumber: block,
    txHash: `0x${tx.repeat(32)}`,
    logIndex: 0,
    eventName: "BetPlaced",
    args: { positionId: betId, player: "0x0000000000000000000000000000000000000077", stake: 1_000n }
  };
}

describe.skipIf(!url)("PostgreSQL bet identity across GameHub deployments", () => {
  const opened: Sql[] = [];
  const schemas: string[] = [];

  async function freshSchema(legacy: string) {
    const schema = `bet_identity_${randomUUID().replaceAll("-", "")}`;
    const admin = postgres(url!, { onnotice: () => undefined });
    opened.push(admin);
    await admin.unsafe(`create schema "${schema}"`);
    schemas.push(schema);
    const sql = postgres(url!, {
      transform: postgres.camel,
      onnotice: () => undefined,
      connection: { search_path: schema },
      max: 2
    });
    opened.push(sql);
    await sql.unsafe(legacy);
    return { admin, sql, store: createPostgresBetIndexStoreFromSql(sql) };
  }

  afterEach(async () => {
    const admin = opened[0];
    for (const schema of schemas.splice(0)) {
      await admin?.unsafe(`drop schema if exists "${schema}" cascade`);
    }
    await Promise.allSettled(opened.splice(0).map((sql) => sql.end()));
  });

  it("migrates a table keyed by (chain_id, bet_id) and keeps bet 1 of both deployments", async () => {
    const { sql, store } = await freshSchema(LEGACY_SCHEMA);
    await sql.unsafe(`
      insert into gamehub_events (chain_id, game_hub, block_number, tx_hash, log_index, event_name, args_json)
      values (${chainId}, '${v15Hub}', 10, '0x${"aa".repeat(32)}', 0, 'BetPlaced', '{"positionId": "1"}');
      insert into bets (chain_id, bet_id, state, updated_block, last_tx_hash, last_event_name)
      values (${chainId}, '1', 'placed', 10, '0x${"aa".repeat(32)}', 'BetPlaced');
    `);

    await store.migrate();
    await store.migrate(); // idempotent once migrated

    const primaryKey = await sql`
      select a.attname as column_name from pg_index i
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
      where i.indrelid = 'bets'::regclass and i.indisprimary
      order by array_position(i.indkey, a.attnum)
    `;
    expect(primaryKey.map((row) => row.columnName)).toEqual(["chain_id", "game_hub", "bet_id"]);
    expect(await store.getBet({ chainId, gameHub: v15Hub, betId: 1n })).toMatchObject({
      gameHub: v15Hub,
      betId: "1",
      state: "placed"
    });

    // The v1.6 hub also starts at bet 1; before the key included the hub, this overwrote the v1.5 row.
    await store.writeGameHubEvents([placed(v16Hub, 1n, 20n, "bb")]);
    expect(await store.getBet({ chainId, gameHub: v15Hub, betId: 1n })).toMatchObject({
      placedBlock: undefined,
      updatedBlock: 10
    });
    expect(await store.getBet({ chainId, gameHub: v16Hub, betId: 1n })).toMatchObject({
      placedBlock: 20,
      stake: "1000"
    });
    expect(await store.getRecentBets({ chainId, limit: 10 })).toHaveLength(2);
    expect(await store.getRecentBets({ chainId, gameHub: v16Hub, limit: 10 })).toHaveLength(1);
  });

  it("refuses to migrate a bet whose GameHub no indexed event names", async () => {
    const { sql, store } = await freshSchema(LEGACY_SCHEMA);
    await sql.unsafe(`
      insert into bets (chain_id, bet_id, state, updated_block, last_tx_hash, last_event_name)
      values (${chainId}, '9', 'placed', 10, '0x${"cc".repeat(32)}', 'BetPlaced');
    `);

    await expect(store.migrate()).rejects.toThrow(/1 rows whose GameHub no indexed event names/);
  });

  it("creates the keyed table directly on an empty database", async () => {
    const { sql, store } = await freshSchema("select 1");
    await store.migrate();
    await store.writeGameHubEvents([placed(v15Hub, 1n, 10n, "dd"), placed(v16Hub, 1n, 11n, "ee")]);
    const rows = await sql`select game_hub from bets order by game_hub`;
    expect(rows.map((row) => row.gameHub)).toEqual([v15Hub, v16Hub]);
  });
});
