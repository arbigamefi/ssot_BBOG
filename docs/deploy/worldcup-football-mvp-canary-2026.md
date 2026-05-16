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

The canary uses the existing `SportsHub` result reporter path as the MVP fact oracle. The first real
provider ingestion path is documented in `docs/ops/sportsbook-provider-the-odds-api.md`; it feeds the
same `resultSourceHash`, `evidenceHash`, and `observedAt` fields.

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

When base RPC/governance values and role keys are split across files, pass the base env as `ENV_FILE`
and the role-key env as `ROLE_ENV_FILE`:

```bash
ENV_FILE=.env ROLE_ENV_FILE=.env.sports-roles.local make sports-football-canary-v13
```

Football-specific role variables override existing canary variables, but the script also accepts the
existing `CANARY_PLAYER_PRIVATE_KEY`, `CANARY_ODDS_SIGNER_PRIVATE_KEY`, and
`CANARY_RESULT_REPORTER_PRIVATE_KEY` names.

Default mode is `FOOTBALL_CANARY_MODE=local-resolve`, which is simulation-only and uses `vm.warp` to
run the full lifecycle in one pass. Do not use `local-resolve` with `BROADCAST=1`.

Use `FOOTBALL_CANARY_MODE=open-market` when the goal is to test the frontend/provider ticket path. This
mode only creates and opens the 3-outcome market; it does not place tickets and does not lock the
market. Record the printed `FOOTBALL_MARKET_ID`, then use `/sportsbook/[marketId]` to fetch a signed
odds snapshot and place the canary ticket through the frontend SDK path.

## Public Testnet Flow

For Base Sepolia, use two or three broadcasts because real time must pass for start and finality.

0. Optional frontend ticket-placement setup: create/open the market without placing tickets:

```bash
FOOTBALL_CANARY_MODE=open-market BROADCAST=1 ENV_FILE=.env ROLE_ENV_FILE=.env.sports-roles.local make sports-football-canary-v13
```

Record the printed:

- `FOOTBALL_MARKET_ID`
- `lockTime`
- `startsAt`

Then configure the frontend server-only odds route with `THE_ODDS_API_KEY`,
`CANARY_ODDS_SIGNER_PRIVATE_KEY`, `SPORTS_ODDS_SIGNER`, `RPC_URL`, and the selected provider event
metadata. The market must remain open while the frontend route signs and the wallet broadcasts
`SportsHub.placeTicket(...)`.

1. Create/open/lock the 3-outcome market and place tickets:

```bash
FOOTBALL_CANARY_MODE=setup BROADCAST=1 ENV_FILE=.env.v13-sports.local make sports-football-canary-v13
```

Record the printed:

- `FOOTBALL_MARKET_ID`
- `FOOTBALL_FIRST_TICKET_ID`
- `FOOTBALL_TICKET_COUNT`
- `startsAt`

2. After `startsAt`, generate or load provider evidence.

For a deterministic local check of the provider adapter:

```bash
make sports-provider-odds-v13
make sports-provider-evidence-v13
```

For a provider-driven local rehearsal against the current deployment snapshot, run:

```bash
ENV_FILE=.env ROLE_ENV_FILE=.env.sports-roles.local make sports-provider-e2e-v13
```

This generates odds and result evidence from deterministic fixtures, reads the current SportsHub
`nextMarketId` and reporter-set hash, then injects both generated env files into the football canary's
simulation-only `local-resolve` mode. Before it runs the canary, it validates provider event, market,
rulebook, outcome mapping, reporter set, and payout-cap consistency across the generated evidence
files.

For a live provider odds run, use `script/ops/sports_provider_odds.py` with `THE_ODDS_API_KEY`,
`SPORTS_PROVIDER_EVENT_ID`, `SPORTS_HUB`, and the target market context. Review the generated JSON
files, then source the generated odds env:

```bash
set -a
source tmp/sports-provider-odds-live/odds-snapshot.env
set +a
```

For a live provider result run, use `script/ops/sports_provider_evidence.py` with `THE_ODDS_API_KEY`,
`SPORTS_PROVIDER_EVENT_ID`, `SPORTS_HUB`, `FOOTBALL_MARKET_ID`, and the current rulebook/reporter-set
hashes. Review the generated JSON files, then source the generated result env:

```bash
set -a
source tmp/sports-provider-evidence-live/result-proposal.env
set +a
```

3. Propose the reporter result:

```bash
FOOTBALL_CANARY_MODE=settle \
FOOTBALL_MARKET_ID=<market-id> \
FOOTBALL_FIRST_TICKET_ID=<first-ticket-id> \
FOOTBALL_TICKET_COUNT=<ticket-count> \
BROADCAST=1 ENV_FILE=.env.v13-sports.local make sports-football-canary-v13
```

Record the printed `finalizesAt`.

4. After `finalizesAt`, rerun the same command to finalize and settle tickets.

## Useful Overrides

```bash
FOOTBALL_WINNING_OUTCOME_ID=0
FOOTBALL_LOSING_OUTCOME_ID=1
FOOTBALL_STAKE=100000
FOOTBALL_HOME_ODDS_WAD=1800000000000000000
FOOTBALL_DRAW_ODDS_WAD=3400000000000000000
FOOTBALL_AWAY_ODDS_WAD=4500000000000000000
FOOTBALL_ODDS_EXPIRES_AT=1781193720
FOOTBALL_MAX_PAYOUT=300000
FOOTBALL_RESULT_SOURCE_HASH=0x...
FOOTBALL_EVIDENCE_HASH=0x...
FOOTBALL_RESULT_OBSERVED_AT=1781211600
```

Keep the MVP narrow: the canary is proving football 1X2 settlement, not a full sportsbook launch.

## Base Sepolia Evidence - 2026-05-14

The football MVP canary was broadcast on Base Sepolia against the v1.3 deployment snapshot:

- Chain ID: `84532`
- SportsHub: `0x2DB4Ba326C2C3e5830b0da10F0C52B4097f9fa4b`
- Sports Bank: `0x3686664d8D92FEAb8C4c9Ac0baaEb07c8BDDbc85`
- Sports asset: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- Market ID: `4`
- Event ID: `2026061101`
- First ticket ID: `10`
- Ticket count: `2`
- Winning outcome ID: `0`
- Result payload hash: `0xeb945039fdfe6fc5f2cf25c6ced0fa5a5d4ddb2421ce69cbd6ab23610aa0fe51`
- Result source hash: `0x62c337d20a198e88b610bb8ac55374f0d49d704a4a828f6e0644328f92d0b46e`
- Evidence hash: `0x18496841a3d487a1113a3070c866c182ea7d068a69631349cf54274602d372ae`

Setup transactions:

- `0xc1074248a543078721a6f5e436de60517d0aba2bf92ba61c5464190f3f2e10c2`
- `0x04716a19a0b1c024dcaea8b162199df0d360cdbf1195dcf076012cc1feba008a`
- `0xd29544bc806fd175e1953348baa28776d29c6cbbbeb7e4e906865736d3db1bd7`
- `0x3fef408bf9c524ca4887996219d912cead390b09094fc6fde385f11798accf24`
- `0xab0589d67a842fe858cadde46eab836893872d0032fce36ca359d194857e4e1b`
- `0x3325aaf8675bea82b92e1168e2982e71af4a8ba6ec0127cc0890c74b3172d1a1`

Result proposal transaction:

- `0xba12194a341f13c8989d9579a30d9f518af2ec65f5f1ac88acea2fcaa1010f92`

Finalize and settlement transactions:

- `0xe3972bd1593a34a8f3279d6a2da265a73b3152b103017845d7a8802bed733f14`
- `0xd0759f64a27879537754c730cf57f3d18d127203402c3771ca79be3e015e9314`

Final chain readbacks:

- `getMarket(4).state = 7` (`Resolved`)
- `getResult(4).winningOutcomeId = 0`
- `getTicket(10).state = 2` (`Settled`)
- `getTicket(11).state = 2` (`Settled`)
- `marketReserved(4) = 0`
- `poolEventReserved(2, 2026061101) = 0`
- Sports Bank `totalReserved() = 0`

This completes the football 1X2 MVP product loop on Base Sepolia: create/open/lock market, place two
tickets, report the result, wait through finality, finalize, batch settle, and release all reserved
liability.

## Base Sepolia Frontend Ticket Placement Evidence - 2026-05-15

This run exercised the frontend/provider ticket path added for the Sportsbook MVP:

- create/open a 3-outcome SportsHub market without script-side tickets;
- fetch The Odds API `h2h` prices through `POST /api/sportsbook/odds-snapshot`;
- sign the canonical `SportsHub.hashOddsTicket(...)` hash with the allowlisted odds signer;
- approve the Sports Bank for the selected stake;
- broadcast `SportsHub.placeTicket(...)` with the signed provider-backed snapshot.

Provider snapshot:

- Provider: The Odds API
- Sport key: `soccer_usa_mls`
- Provider event id: `f2d025aa026e63ee4460ffc28c3386e4`
- Bookmaker: `unibet`
- Provider event: `CF Montreal` vs `Chicago Fire`
- Selected outcome: `0` / home / `CF Montreal`
- Decimal odds: `2.8`
- Odds WAD: `2800000000000000000`

Market and ticket:

- Chain ID: `84532`
- SportsHub: `0x2DB4Ba326C2C3e5830b0da10F0C52B4097f9fa4b`
- Market ID: `6`
- Event ID: `2026061101`
- Market state after placement: `Open`
- Market version: `2`
- Lock time: `1778856182`
- Starts at: `1778856242`
- Ticket ID: `12`
- Ticket state: `Held`
- Player: `0xc8eC9920d573893E888db5D30b2B3B3824B1b684`
- Stake: `50000`
- Payout / reserved: `140000`
- Odds ticket hash: `0xfe606290004fcdfc5eb3a88a5e2041e25ddffaa22030976c584e0307709cbf7d`

Transactions:

- Market 6 create: `0x60959341b72ad8bbe0fa0832df2c4568f2813747e299b9d3fa6515e292dab21c`
- Market 6 open: `0xf845b9bd95698144b76697332181340c1e59e774fe8f78e715ea00697f2cb3c6`
- Player approve: `0xa87432c86e6500f836ce37e7c275ea8cea02dec9e668d80f8ab0c4f851ad2d58`
- Place ticket: `0xec18a35daaa2e81f77c1787fbd60b058389b050fca5b2b5a845aaaf06c4a6a64`

Final readbacks after placement:

- `getMarket(6).state = Open`
- `getTicket(12).state = Held`
- `getTicket(12).stake = 50000`
- `getTicket(12).payout = 140000`
- `marketReserved(6) = 140000`
- `marketOutcomeReserved(6, 0) = 140000`
- `eventReserved(2026061101) = 140000`
- `poolEventReserved(2, 2026061101) = 140000`
- Sports Bank `totalReserved() = 140000`
- Player allowance to Sports Bank after placement: `0`

Cleanup:

- Market ID `5` was created with the default short open window during the first rehearsal. The
  subsequent ticket placement was rejected during gas estimation as `MarketLocked(5)` and no
  `placeTicket` transaction was broadcast for market `5`.
- Market `5` was then voided with reason hash
  `0x5c44170ad48b2743bec52e355c772fa7a2a39225b57d5fcdd834d2beb401a0a7`.
- Market 5 create: `0x7145d00c841e7a7df4196b26c0afec98e9b6aca38892591ae3374dbaac6dc7c6`
- Market 5 open: `0x670da98f4e87b8f360b85e6395223c887da6cfd635a0808fdd5bd4f3b2a30a4d`
- Market 5 void: `0x9080cc87b8fe2c22a176c918ae726ac47db6311c8d2d98d68907b77c953aa306`

This proves the MVP's live risk-in path: a provider-backed signed odds snapshot can be generated by the
frontend route and accepted by `SportsHub.placeTicket(...)`, with the resulting reserve reflected in
SportsHub exposure counters and the Sports Bank.

### Settlement closeout for market 6

Market `6` was then closed through the normal reporter finality path:

- Lock transaction: `0x1f0505e1607d6fb819e59218a7c1a85fe2baa753d4c1e3657b4a2589f24e0a17`
- Result proposal transaction: `0x781ea6f61232132c50953745f6b63b83e7bbca6c1b2dda8607ba34a9cb06cfa1`
- Finalize transaction: `0xadf1ea90e9e689dd01821c2886209e285d45866a787a00517e285afda516152e`
- Settlement transaction: `0xed0ee8067e919ba88e61763b45a657fb494154e8d92ade7808f432ddd2b5956c`

Result readback after proposal:

- `getResult(6).winningOutcomeId = 0`
- `getResult(6).resultPayloadHash =
  0xd8b1d1411cb14964f7d585f76e3c0999aa64e0a4b3261afa16040135f43c40f4`
- `getResult(6).resultSourceHash =
  0x62c337d20a198e88b610bb8ac55374f0d49d704a4a828f6e0644328f92d0b46e`
- `getResult(6).evidenceHash =
  0x18496841a3d487a1113a3070c866c182ea7d068a69631349cf54274602d372ae`
- `getResult(6).finalizesAt = 1778857400`

Final readbacks after settlement:

- `getMarket(6).state = Resolved`
- `getTicket(12).state = Settled`
- `getTicket(12).stake = 50000`
- `getTicket(12).payout = 140000`
- `marketReserved(6) = 0`
- `marketOutcomeReserved(6, 0) = 0`
- `eventReserved(2026061101) = 0`
- `poolEventReserved(2, 2026061101) = 0`
- Sports Bank `totalReserved() = 0`

This closes the live provider-backed MVP loop for one football single: provider odds snapshot, signed
ticket placement, result proposal, finality, finalization, ticket settlement, and reserved-liability
release.
