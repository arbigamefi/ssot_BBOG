import { describe, expect, it } from "vitest";

import { BET_INDEX_SCHEMA_SQL } from "./index";

describe("bet index schema", () => {
  it("declares the durable event, bet, and cursor tables", () => {
    expect(BET_INDEX_SCHEMA_SQL).toContain("create table if not exists gamehub_events");
    expect(BET_INDEX_SCHEMA_SQL).toContain("create table if not exists bets");
    expect(BET_INDEX_SCHEMA_SQL).toContain("create table if not exists sport_tickets");
    expect(BET_INDEX_SCHEMA_SQL).toContain("create table if not exists bank_provider_ledger");
    expect(BET_INDEX_SCHEMA_SQL).toContain("create table if not exists indexer_cursors");
    expect(BET_INDEX_SCHEMA_SQL).toContain("pricing_affiliate text");
    expect(BET_INDEX_SCHEMA_SQL).toContain("bets_affiliate_idx");
    expect(BET_INDEX_SCHEMA_SQL).toContain("sport_tickets_player_idx");
    expect(BET_INDEX_SCHEMA_SQL).toContain("sport_tickets_market_state_idx");
    expect(BET_INDEX_SCHEMA_SQL).toContain("bank_provider_ledger_owner_idx");
    expect(BET_INDEX_SCHEMA_SQL).toContain("primary key (chain_id, tx_hash, log_index)");
    expect(BET_INDEX_SCHEMA_SQL).toContain("primary key (chain_id, bet_id)");
    expect(BET_INDEX_SCHEMA_SQL).toContain("primary key (chain_id, ticket_id)");
  });
});
