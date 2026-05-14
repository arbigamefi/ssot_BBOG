# World Cup Football MVP Canary

This canary brings the SportsHub MVP back to its narrow product goal: one pre-match football
fixed-odds single, settled by an allowlisted result reporter.

## Market Shape

- Event: 2026 World Cup opening-match shape, Mexico vs South Africa.
- Market: 1X2 / moneyline.
- Contract outcome ids are zero-based:
  - `0`: Mexico
  - `1`: Draw
  - `2`: South Africa
- Scope: no live betting, no parlays, no player props, no futures.

The canary uses the existing `SportsHub` result reporter path as the MVP fact oracle. A real provider
adapter can later feed the same `resultSourceHash` and `evidenceHash` fields.

## Local Contract Proof

Run the focused unit test:

```bash
forge test --match-path test/unit/SportsHubFootballMVP.t.sol -vv
```

The test covers:

- 3-outcome market creation;
- signed odds tickets for a winning and losing football outcome;
- reporter result proposal;
- finality;
- batch settlement through `SettlementRouter`;
- cleared SportsHub and Bank reserved exposure.

## Canary Script

The script entrypoint is:

```bash
make sports-football-canary-v13
```

It accepts the same env-file pattern as other v1.3 canaries:

```bash
ENV_FILE=.env.v13-sports.local make sports-football-canary-v13
```

Default mode is `FOOTBALL_CANARY_MODE=local-resolve`, which is simulation-only and uses `vm.warp` to
run the full lifecycle in one pass. Do not use `local-resolve` with `BROADCAST=1`.

## Public Testnet Flow

For Base Sepolia, use two or three broadcasts because real time must pass for start and finality.

1. Create/open/lock the 3-outcome market and place tickets:

```bash
FOOTBALL_CANARY_MODE=setup BROADCAST=1 ENV_FILE=.env.v13-sports.local make sports-football-canary-v13
```

Record the printed:

- `FOOTBALL_MARKET_ID`
- `FOOTBALL_FIRST_TICKET_ID`
- `FOOTBALL_TICKET_COUNT`
- `startsAt`

2. After `startsAt`, propose the reporter result:

```bash
FOOTBALL_CANARY_MODE=settle \
FOOTBALL_MARKET_ID=<market-id> \
FOOTBALL_FIRST_TICKET_ID=<first-ticket-id> \
FOOTBALL_TICKET_COUNT=<ticket-count> \
BROADCAST=1 ENV_FILE=.env.v13-sports.local make sports-football-canary-v13
```

Record the printed `finalizesAt`.

3. After `finalizesAt`, rerun the same command to finalize and settle tickets.

## Useful Overrides

```bash
FOOTBALL_WINNING_OUTCOME_ID=0
FOOTBALL_LOSING_OUTCOME_ID=1
FOOTBALL_STAKE=100000
FOOTBALL_ODDS_WAD=1800000000000000000
FOOTBALL_MAX_PAYOUT=300000
FOOTBALL_RESULT_SOURCE_HASH=0x...
FOOTBALL_EVIDENCE_HASH=0x...
```

Keep the MVP narrow: the canary is proving football 1X2 settlement, not a full sportsbook launch.
