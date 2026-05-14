# The Odds API Provider Ingestion

Status: candidate SportsHub result provider integration. This file documents how to turn a real
provider score response into the hashes accepted by `SportsHub.proposeResult(...)`. It does not approve
mainnet sportsbook risk-in by itself.

## Scope

The first integration is deliberately narrow:

- provider: The Odds API scores endpoint;
- market type: pre-match football 1X2;
- result state: completed/final scores only;
- output: `FOOTBALL_WINNING_OUTCOME_ID`, `FOOTBALL_RESULT_OBSERVED_AT`,
  `FOOTBALL_RESULT_SOURCE_HASH`, and `FOOTBALL_EVIDENCE_HASH`;
- submission path: existing allowlisted SportsHub result reporter.

The Odds API documents a v4 scores endpoint under `/v4/sports/{sport}/scores/`. The production
operator must verify account terms, sport coverage, rate limits, and allowed commercial use before a
public market uses this feed.

## Architecture

```text
The Odds API scores
    |
    v
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

Run:

```bash
make sports-provider-evidence-v13
```

This uses `test/fixtures/sports/the-odds-api-football-completed-score.json` and proves the adapter
logic without a provider API key. The fixture resolves Mexico 2-1 South Africa to outcome `0`.

## Live Smoke Evidence

The first live provider smoke is recorded in
`docs/deploy/the-odds-api-football-smoke-2026-05-14.md`. It used a completed MLS event from The Odds
API and generated the `resultSourceHash`, `evidenceHash`, and `FOOTBALL_RESULT_OBSERVED_AT` values
needed by the SportsHub football canary.

## Live Provider Run

Set the provider and SportsHub context:

```bash
export THE_ODDS_API_KEY=<secret>
export SPORTS_PROVIDER_SPORT_KEY=soccer_fifa_world_cup
export SPORTS_PROVIDER_EVENT_ID=<the-odds-api-event-id>
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

After the provider tool writes `result-proposal.env`, review the generated JSON files and load the env:

```bash
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
- `result-source.json` or `result-evidence.json` is not archived;
- the generated env file is edited by hand without regenerating hashes;
- provider terms, commercial use, or coverage for the sport/league are not approved.

## Future Upgrade Path

This first pass keeps the provider integration off-chain and uses the existing reporter quorum. If the
project later wants a more on-chain oracle path, Chainlink Functions is the likely candidate for
HTTP/API-backed data retrieval, but it should still write into a narrow oracle/reporter adapter instead
of giving an external provider direct custody or settlement authority.
