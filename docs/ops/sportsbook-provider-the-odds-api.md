# The Odds API Provider Ingestion

Status: candidate SportsHub odds and result provider integration. This file documents how to turn real
provider odds and score responses into the values accepted by `SportsHub.placeTicket(...)` and
`SportsHub.proposeResult(...)`. It does not approve mainnet sportsbook risk-in by itself.

## Scope

The first integration is deliberately narrow:

- provider: The Odds API odds and scores endpoints;
- market type: pre-match football 1X2;
- odds state: provider `h2h` prices before market lock;
- result state: completed/final scores only;
- odds output: `FOOTBALL_HOME_ODDS_WAD`, `FOOTBALL_DRAW_ODDS_WAD`,
  `FOOTBALL_AWAY_ODDS_WAD`, `FOOTBALL_ODDS_EXPIRES_AT`, and `FOOTBALL_ODDS_SOURCE_HASH`;
- result output: `FOOTBALL_WINNING_OUTCOME_ID`, `FOOTBALL_RESULT_OBSERVED_AT`,
  `FOOTBALL_RESULT_SOURCE_HASH`, and `FOOTBALL_EVIDENCE_HASH`;
- submission path: existing allowlisted SportsHub result reporter.

The Odds API documents v4 odds and scores endpoints under `/v4/sports/{sport}/odds/` and
`/v4/sports/{sport}/scores/`. The production operator must verify account terms, sport coverage, rate
limits, and allowed commercial use before a public market uses this feed.

## Architecture

```text
The Odds API odds + scores
    |
    v
script/ops/sports_provider_odds.py
    |
    +-- raw-odds-response.json
    +-- raw-odds-event.json
    +-- odds-source.json       -> oddsSourceHash
    +-- odds-snapshot.json     -> home/draw/away oddsWad
    +-- odds-snapshot.env      -> SportsHub canary odds env
    |
    v
odds signer -> SportsHub.placeTicket

script/ops/sports_provider_evidence.py
    |
    +-- raw-provider-response.json
    +-- raw-provider-event.json
    +-- result-source.json      -> resultSourceHash
    +-- result-evidence.json    -> evidenceHash
    +-- result-proposal.env     -> SportsHub canary env
    |
    v
WorldCupFootballCanaryV13 / SportsHub.proposeResult
```

The tool hashes canonical JSON with `cast keccak`, matching the repo policy in
`docs/ops/sportsbook-provider-evidence-policy.md`.

## Deterministic Fixture Check

Run both provider fixture checks:

```bash
make sports-provider-odds-v13
make sports-provider-evidence-v13
```

`make sports-provider-odds-v13` uses
`test/fixtures/sports/the-odds-api-football-h2h-odds.json` and proves that provider `h2h` prices map
to SportsHub `home/draw/away` outcome odds. `make sports-provider-evidence-v13` uses
`test/fixtures/sports/the-odds-api-football-completed-score.json` and proves result evidence
generation. The score fixture resolves Mexico 2-1 South Africa to outcome `0`.

To prove the fixtures through the SportsHub canary on a fork of the current deployment, run:

```bash
ENV_FILE=.env ROLE_ENV_FILE=.env.sports-roles.local make sports-provider-e2e-v13
```

This is still simulation-only: it generates provider odds and result evidence, sources the generated
env files, validates that the odds and result packages agree on provider event, market, rulebook,
outcome mapping, reporter set, and payout cap, then completes one local football 1X2 market through
`WorldCupFootballCanaryV13`. The rehearsal writes a combined
`provider-e2e-manifest.json` under the temporary evidence directory for debugging and archival review.

## Odds Ingestion

For football 1X2, The Odds API `h2h` market maps to:

- home team -> SportsHub outcome `0`;
- draw -> SportsHub outcome `1`;
- away team -> SportsHub outcome `2`.

The generated odds env includes:

```bash
FOOTBALL_MARKET_KEY=0x...
FOOTBALL_RULEBOOK_HASH=0x...
FOOTBALL_ODDS_EXPIRES_AT=<unix-seconds>
FOOTBALL_HOME_ODDS_WAD=<decimal-odds * 1e18>
FOOTBALL_DRAW_ODDS_WAD=<decimal-odds * 1e18>
FOOTBALL_AWAY_ODDS_WAD=<decimal-odds * 1e18>
FOOTBALL_MAX_PAYOUT=<approved payout cap for these odds>
FOOTBALL_REQUIRED_MAX_PAYOUT=<minimum payout cap required by the provider odds>
FOOTBALL_ODDS_SOURCE_HASH=0x...
```

`WorldCupFootballCanaryV13` accepts the per-outcome odds env and signs each ticket with the odds for
that ticket's selected outcome. This keeps the market odds dynamic before lock while preserving fixed
odds for every accepted ticket.

For deterministic replay, set `SPORTS_ODDS_GENERATED_AT` or pass `--generated-at` when regenerating a
fixture or archived market snapshot. Live runs can omit it and use the local generation timestamp.

The odds tool fails if `FOOTBALL_MAX_PAYOUT` / `--max-payout-raw` is below the payout implied by the
highest provider odds for the configured stake. Operators must raise the cap explicitly from an
approved bankroll/risk memo rather than silently accepting provider prices that exceed risk limits.

## Frontend Signed Odds Route

The frontend exposes a server-side helper for operator/canary ticket placement:

```text
POST /api/sportsbook/odds-snapshot
```

The route is deliberately narrow. It reads the embedded v1.3 release, fetches The Odds API `h2h`
prices, maps football 1X2 outcomes to SportsHub outcome ids, checks the selected stake against the
Sports pool `sportsRisk` caps, asks SportsHub for the canonical `hashOddsTicket(...)`, signs that hash
with the configured odds signer, and returns the complete `SportsOddsSnapshot` payload plus signature.

Required server-only environment:

```bash
NEXT_PUBLIC_SPORTSBOOK_ENABLED=true
THE_ODDS_API_KEY=<secret>
SPORTS_ODDS_SIGNER_PRIVATE_KEY=<32-byte-private-key>
RPC_URL=<chain-rpc-url>
```

Optional controls:

```bash
SPORTS_ODDS_SIGNER=<expected-signer-address>
SPORTS_PROVIDER_SPORT_KEY=soccer_fifa_world_cup
SPORTS_PROVIDER_EVENT_ID=<the-odds-api-event-id>
SPORTS_BOOKMAKER_KEY=<optional-bookmaker-key>
THE_ODDS_API_REGIONS=us,uk,eu,au
SPORTS_ODDS_TTL_SECONDS=120
```

Request body:

```json
{
  "chainId": 84532,
  "marketId": "7",
  "outcomeId": 0,
  "player": "0x1111111111111111111111111111111111111111",
  "stake": "1000000",
  "providerEventId": "optional-provider-event-id",
  "bookmakerKey": "optional-bookmaker-key",
  "sportKey": "soccer_fifa_world_cup"
}
```

The response schema is `sportsbook.signed-odds-ticket.v1`. The `/sportsbook/[marketId]` UI consumes it
to fill `oddsWad`, `maxStake`, `maxPayout`, `expiresAt`, `nonce`, `riskHash`, and `signature` before
calling the SDK planner.

Do not expose the signer private key to the browser, use a long-lived snapshot, or accept a snapshot
whose `riskHash` no longer matches the active Sports pool risk metadata.

## Live Smoke Evidence

The first live provider odds smoke is recorded in
`docs/deploy/the-odds-api-football-odds-smoke-2026-05-14.md`. It used an upcoming MLS event from The
Odds API and generated the per-outcome `FOOTBALL_*_ODDS_WAD`, `FOOTBALL_ODDS_EXPIRES_AT`, and
`FOOTBALL_ODDS_SOURCE_HASH` values needed by the SportsHub football canary.

The first live provider result smoke is recorded in
`docs/deploy/the-odds-api-football-smoke-2026-05-14.md`. It used a completed MLS event from The Odds
API and generated the `resultSourceHash`, `evidenceHash`, and `FOOTBALL_RESULT_OBSERVED_AT` values
needed by the SportsHub football canary.

## Live Provider Run

Set the provider and SportsHub context for odds:

```bash
export THE_ODDS_API_KEY=<secret>
export SPORTS_PROVIDER_SPORT_KEY=soccer_fifa_world_cup
export SPORTS_PROVIDER_EVENT_ID=<the-odds-api-event-id>
export SPORTS_ODDS_SNAPSHOT_DIR=tmp/sports-provider-odds-live
export SPORTS_BOOKMAKER_KEY=<optional-bookmaker-key>

export CHAIN_ID=84532
export SPORTS_HUB=<sports-hub-address>
export FOOTBALL_MARKET_ID=<sports-hub-market-id>
export FOOTBALL_EVENT_ID=<sports-hub-event-id>
export FOOTBALL_POOL_ID=<sports-pool-id>
```

Then run:

```bash
python3 script/ops/sports_provider_odds.py
```

Set the provider and SportsHub context for final score/result evidence:

```bash
export SPORTS_PROVIDER_EVIDENCE_DIR=tmp/sports-provider-evidence-live

export CHAIN_ID=84532
export SPORTS_HUB=<sports-hub-address>
export FOOTBALL_MARKET_ID=<sports-hub-market-id>
export FOOTBALL_EVENT_ID=<sports-hub-event-id>
export FOOTBALL_POOL_ID=<sports-pool-id>
export FOOTBALL_MARKET_VERSION=1
export FOOTBALL_RULEBOOK_HASH=<market-rulebook-hash>
export SPORTS_RESULT_REPORTER_SET_HASH=<current-reporter-set-hash>
export SPORTS_RESULT_REPORTER=<reporter-address>
```

Then run:

```bash
python3 script/ops/sports_provider_evidence.py
```

Optional: set `RPC_URL` and `SPORTS_HUB` to let the tool call
`SportsHub.hashResultPayload(...)` and include `FOOTBALL_RESULT_PAYLOAD_HASH` in the generated env
file.

## Submitting The Result

After the provider tools write their env files, review the generated JSON files and load the env:

```bash
set -a
source tmp/sports-provider-odds-live/odds-snapshot.env
set +a

set -a
source tmp/sports-provider-evidence-live/result-proposal.env
set +a
```

Then submit through the existing reporter canary path:

```bash
FOOTBALL_CANARY_MODE=settle \
FOOTBALL_MARKET_ID=<sports-hub-market-id> \
FOOTBALL_FIRST_TICKET_ID=<first-ticket-id> \
FOOTBALL_TICKET_COUNT=<ticket-count> \
BROADCAST=1 ENV_FILE=.env ROLE_ENV_FILE=.env.sports-roles.local make sports-football-canary-v13
```

`WorldCupFootballCanaryV13` now accepts `FOOTBALL_RESULT_OBSERVED_AT`. The value must be between the
market `startsAt` and the current block timestamp.

## No-Go Conditions

Do not submit a public-money result if:

- the provider event is not completed;
- the provider event id does not map to the SportsHub market rulebook;
- home/draw/away outcome ids differ from the market rulebook;
- provider `h2h` odds do not contain home, draw, and away outcomes;
- `result-source.json` or `result-evidence.json` is not archived;
- the generated env file is edited by hand without regenerating hashes;
- provider terms, commercial use, or coverage for the sport/league are not approved.

## Future Upgrade Path

This first pass keeps the provider integration off-chain and uses the existing reporter quorum. If the
project later wants a more on-chain oracle path, Chainlink Functions is the likely candidate for
HTTP/API-backed data retrieval, but it should still write into a narrow oracle/reporter adapter instead
of giving an external provider direct custody or settlement authority.
