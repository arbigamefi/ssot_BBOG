import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import type { Address } from "viem";

export type SportsRecoveryScope = { chainId: number; sportsHub: Address };
export type SportsMarketWork = SportsRecoveryScope & {
  marketId: bigint;
  requiredBlock: bigint;
  ticketCursor: bigint;
  coverageStartBlock: bigint;
  availableAt: number;
  attempts: number;
  revision: string;
};
export type SportsRecoveryStore = {
  enqueue: (
    work: SportsRecoveryScope & {
      marketId: bigint;
      requiredBlock: bigint;
      coverageStartBlock?: bigint;
      availableAt: number;
    }
  ) => Promise<void>;
  due: (scope: SportsRecoveryScope, now: number, limit: number) => Promise<SportsMarketWork[]>;
  checkpoint: (
    work: SportsMarketWork,
    update: {
      complete?: boolean;
      ticketCursor: bigint;
      availableAt: number;
      attempts: number;
    }
  ) => Promise<void>;
  writeTickets: (
    scope: SportsRecoveryScope,
    tickets: readonly {
      marketId: bigint;
      ticketId: bigint;
    }[]
  ) => Promise<void>;
  ticketPage: (
    scope: SportsRecoveryScope,
    marketId: bigint,
    after: bigint,
    limit: number
  ) => Promise<bigint[]>;
};

export const SPORTS_RECOVERY_SCHEMA_SQL = `
create table if not exists keeper_sports_work (
  chain_id integer not null,
  sports_hub text not null,
  market_id numeric(78,0) not null,
  required_block bigint not null,
  ticket_cursor numeric(78,0) not null default 0,
  coverage_start_block bigint not null default 0,
  available_at bigint not null,
  attempts integer not null default 0,
  revision text not null,
  primary key (chain_id, sports_hub, market_id)
);
create index if not exists keeper_sports_work_due_idx
  on keeper_sports_work (chain_id, sports_hub, available_at);
create table if not exists keeper_sports_tickets (
  chain_id integer not null,
  sports_hub text not null,
  market_id numeric(78,0) not null,
  ticket_id numeric(78,0) not null,
  primary key (chain_id, sports_hub, market_id, ticket_id)
);
`;

const scopeKey = (s: SportsRecoveryScope) => `${s.chainId}:${s.sportsHub.toLowerCase()}`;

export function createMemorySportsRecoveryStore(): SportsRecoveryStore {
  const pending = new Map<string, SportsMarketWork>();
  const tickets = new Map<string, Set<bigint>>();
  return {
    async enqueue(work) {
      const key = `${scopeKey(work)}:${work.marketId}`;
      const previous = pending.get(key);
      pending.set(
        key,
        previous
          ? {
              ...previous,
              requiredBlock:
                work.requiredBlock > previous.requiredBlock
                  ? work.requiredBlock
                  : previous.requiredBlock,
              coverageStartBlock:
                (work.coverageStartBlock ?? 0n) < previous.coverageStartBlock
                  ? (work.coverageStartBlock ?? 0n)
                  : previous.coverageStartBlock,
              ticketCursor:
                (work.coverageStartBlock ?? 0n) < previous.coverageStartBlock
                  ? 0n
                  : previous.ticketCursor,
              availableAt: Math.min(work.availableAt, previous.availableAt),
              revision: randomUUID()
            }
          : {
              ...work,
              coverageStartBlock: work.coverageStartBlock ?? 0n,
              ticketCursor: 0n,
              attempts: 0,
              revision: randomUUID()
            }
      );
    },
    async due(scope, now, limit) {
      return [...pending.values()]
        .filter((work) => scopeKey(work) === scopeKey(scope) && work.availableAt <= now)
        .sort((a, b) => a.availableAt - b.availableAt || (a.marketId < b.marketId ? -1 : 1))
        .slice(0, limit)
        .map((work) => ({ ...work }));
    },
    async checkpoint(work, update) {
      const key = `${scopeKey(work)}:${work.marketId}`;
      if (pending.get(key)?.revision !== work.revision) return;
      if (update.complete) pending.delete(key);
      else pending.set(key, { ...work, ...update, revision: randomUUID() });
    },
    async writeTickets(scope, input) {
      for (const ticket of input) {
        const key = `${scopeKey(scope)}:${ticket.marketId}`;
        const ids = tickets.get(key) ?? new Set<bigint>();
        ids.add(ticket.ticketId);
        tickets.set(key, ids);
      }
    },
    async ticketPage(scope, marketId, after, limit) {
      return [...(tickets.get(`${scopeKey(scope)}:${marketId}`) ?? [])]
        .filter((id) => id > after)
        .sort((a, b) => (a < b ? -1 : 1))
        .slice(0, limit);
    }
  };
}

export function createPostgresSportsRecoveryStore(sql: Sql): SportsRecoveryStore {
  return {
    async enqueue(work) {
      await sql`
        insert into keeper_sports_work (chain_id, sports_hub, market_id, required_block, available_at, revision, coverage_start_block)
        values (${work.chainId}, ${work.sportsHub.toLowerCase()}, ${String(work.marketId)}, ${String(work.requiredBlock)}, ${work.availableAt}, ${randomUUID()}, ${String(work.coverageStartBlock ?? 0n)})
        on conflict (chain_id, sports_hub, market_id) do update set
          required_block = greatest(keeper_sports_work.required_block, excluded.required_block),
          ticket_cursor = case when excluded.coverage_start_block < keeper_sports_work.coverage_start_block then 0 else keeper_sports_work.ticket_cursor end,
          coverage_start_block = least(keeper_sports_work.coverage_start_block, excluded.coverage_start_block),
          available_at = least(keeper_sports_work.available_at, excluded.available_at),
          revision = excluded.revision
      `;
    },
    async due(scope, now, limit) {
      const rows = await sql`
        select * from keeper_sports_work
        where chain_id = ${scope.chainId} and sports_hub = ${scope.sportsHub.toLowerCase()}
          and available_at <= ${now}
        order by available_at, market_id limit ${limit}
      `;
      return rows.map((row) => ({
        ...scope,
        marketId: BigInt(row.marketId),
        requiredBlock: BigInt(row.requiredBlock),
        ticketCursor: BigInt(row.ticketCursor),
        coverageStartBlock: BigInt(row.coverageStartBlock),
        availableAt: Number(row.availableAt),
        attempts: Number(row.attempts),
        revision: String(row.revision)
      }));
    },
    async checkpoint(work, update) {
      if (update.complete) {
        await sql`
          delete from keeper_sports_work
          where chain_id = ${work.chainId} and sports_hub = ${work.sportsHub.toLowerCase()}
            and market_id = ${String(work.marketId)} and revision = ${work.revision}
        `;
      } else {
        await sql`
          update keeper_sports_work set ticket_cursor = ${String(update.ticketCursor)},
            available_at = ${update.availableAt}, attempts = ${update.attempts}, revision = ${randomUUID()}
          where chain_id = ${work.chainId} and sports_hub = ${work.sportsHub.toLowerCase()}
            and market_id = ${String(work.marketId)} and revision = ${work.revision}
        `;
      }
    },
    async writeTickets(scope, tickets) {
      await sql.begin(async (tx) => {
        // Stable lock order across scanners; a failed batch is safe to replay.
        for (const ticket of [...tickets].sort((a, b) =>
          a.marketId < b.marketId
            ? -1
            : a.marketId > b.marketId
              ? 1
              : a.ticketId < b.ticketId
                ? -1
                : 1
        )) {
          await tx`
            insert into keeper_sports_tickets (chain_id, sports_hub, market_id, ticket_id)
            values (${scope.chainId}, ${scope.sportsHub.toLowerCase()}, ${String(ticket.marketId)}, ${String(ticket.ticketId)})
            on conflict do nothing
          `;
        }
      });
    },
    async ticketPage(scope, marketId, after, limit) {
      const rows = await sql`
        select ticket_id from keeper_sports_tickets
        where chain_id = ${scope.chainId} and sports_hub = ${scope.sportsHub.toLowerCase()}
          and market_id = ${String(marketId)} and ticket_id > ${String(after)}
        order by ticket_id limit ${limit}
      `;
      return rows.map((row) => BigInt(row.ticketId));
    }
  };
}
