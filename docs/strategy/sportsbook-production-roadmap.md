# Sportsbook Production Roadmap

| Owner | Product + Protocol Lead |
| Status | Active |
| Last Updated | 2026-05-19 |
| Depends on | `docs/strategy/fullstack-product-architecture.md`, `docs/ops/sportsbook-phase2-gonogo-2026-05-14.md`, `docs/ops/runbooks/sportsbook-ops.md` |
| Supersedes | Chat-only sportsbook readiness discussion |

## 1. Target

The sportsbook target is a public mainnet, single-brand, B2C fixed-odds product:

```text
Market discovery -> market detail -> signed odds -> place ticket
  -> ticket tracker -> result proof -> automatic terminalization -> receipt
```

The first public version remains narrow by design:

- pre-match fixed-odds singles only;
- one chain and one Sports Bank;
- one approved asset;
- low supervised limits;
- football 1X2 first, then adjacent pre-match markets;
- no live betting, parlays, props, futures, or shared casino/sports bankroll.

## 2. Current Verdict

The current codebase is a correct MVP foundation, not yet a public mainnet
sportsbook.

Strong surfaces:

- `SportsHub` owns fixed-odds ticket lifecycle, result evidence, challenge,
  void, and ticket debt-out.
- `SportsRiskEngine` enforces exposure and payout caps.
- signed odds snapshots keep provider odds, risk hash, expiry, nonce, and
  market version bound to the player's ticket.
- the web app has lobby, market detail, bet slip, ticket detail, player tickets,
  provider odds APIs, and ops separation.
- the keeper has opt-in SportsHub terminalization.
- Postgres bet-index is the right MVP read-model; no subgraph is needed.

Open gaps:

- public player journey still needs product-grade ticket tracking after
  placement;
- market discovery needs real tabs and empty states, not a raw recent-market
  list;
- ticket proof should be player-readable by default and detailed hashes should
  live behind an advanced drawer;
- sports keeper needs production deployment evidence and canary logs;
- no-go memos for custody, provider/evidence, jurisdiction/access, bankroll,
  risk caps, monitoring, and final release artifacts remain unapproved.

## 3. Production Gates

### Gate A - Player UX Complete

Acceptance:

- `/sportsbook` supports Open, Live, Today, Upcoming, and Settled scanning.
- `/sportsbook/[marketId]` lets a player pick one outcome, enter stake, place a
  ticket, then immediately see a ticket tracker without waiting for index lag.
- `/portfolio/tickets/[ticketId]` defaults to receipt, lifecycle, and result;
  raw proof hashes are hidden behind an advanced proof drawer.
- normal players are not sent to `/ops/sportsbook` from primary CTAs.
- all user-facing text is localized in `en` and `zh-Hans`.

### Gate B - Terminalization Complete

Acceptance:

- primary and backup sports terminalizers are deployed with independent RPCs;
- a canary proves `ResultProposed -> finalizeResult -> settleTicket/refundTicket`
  with tx hashes and final readbacks;
- operator docs name the owner for each alert and escalation window;
- player UI treats manual settle/refund as fallback, not the normal path.

### Gate C - Provider And Evidence Approved

Acceptance:

- provider/evidence memo is approved and passes the repo check;
- result source and evidence storage procedure are reproducible;
- odds signing keys and result reporter keys have custody approvals;
- rulebook templates are finalized for the first public market class.

### Gate D - Public Risk-In Approved

Acceptance:

- jurisdiction/frontend access memo is approved;
- bankroll and risk-cap memo is approved;
- mainnet release artifacts, golden vectors, ABI export, strict release check,
  and fork tests exist for the target commit;
- fresh mainnet/staging canary is recorded after final parameters.

## 4. Implementation Order

1. **Close player UX:** market tabs, ticket tracker, receipt-first ticket detail,
   and proof drawer.
2. **Close terminalizer ops:** primary/backup deployment docs and a fresh sports
   terminalizer canary.
3. **Close provider/evidence:** final provider memo, evidence bundle path, and
   result reporter procedure.
4. **Close public risk-in:** access policy, bankroll/risk caps, final artifacts,
   and fresh canary.
5. **Expand markets:** add more football pre-match markets only after the first
   market class is stable.

## 5. Stop List

Do not add these before Gate A-D pass:

- The Graph subgraph;
- live betting;
- parlays;
- props/futures;
- cross-chain market discovery;
- white-label sportsbook screens;
- higher bankroll limits;
- new market classes without approved rulebook/evidence procedures.

## 6. How To Enforce

Required checks for sportsbook PRs:

```bash
pnpm -C frontend/apps/web test -- 'src/app/(product)/sportsbook/pageClient.test.tsx' 'src/app/(product)/sportsbook/[marketId]/pageClient.test.tsx' 'src/app/(product)/portfolio/tickets/[ticketId]/pageClient.test.tsx' 'src/app/api/sportsbook/odds-snapshot/route.test.ts' 'src/app/api/sportsbook/provider-odds/route.test.ts' 'src/app/api/sportsbook/tickets/player/[address]/route.test.ts' 'src/features/sportsbook/provider-odds.test.ts'
pnpm -C frontend/apps/keeper test -- sports-terminalizer.test.ts
forge test --match-contract 'SportsHub.*|SportsRisk.*'
```

Before public risk-in, the Phase 2 go/no-go packet must change from NO-GO to GO
with explicit evidence links. Code changes cannot bypass that packet.
