# The Odds API Football Provider Smoke - 2026-05-14

This smoke test proves the first real sports data provider ingestion path without broadcasting any
chain transaction.

## Scope

- Provider: The Odds API.
- Endpoint family: v4 sports scores.
- Sport key: `soccer_usa_mls`.
- Provider event ID: `223fa752adac8af3a550e54fae743672`.
- Chain action: none. This was provider ingestion only.
- Evidence output: `tmp/sports-provider-evidence-live-smoke/`.

## Selected Event

The provider returned a completed MLS event:

- Home: Charlotte FC.
- Away: New York City FC.
- Provider commence time: `2026-05-13T23:25:00Z`.
- Provider last update: `2026-05-14T02:54:11Z`.
- Score: Charlotte FC `0`, New York City FC `1`.

Using the SportsHub football 1X2 convention `0=home`, `1=draw`, `2=away`, the provider payload maps
to winning outcome `2`.

## Generated Proposal Values

The provider ingestion script generated:

```bash
FOOTBALL_WINNING_OUTCOME_ID=2
FOOTBALL_RESULT_OBSERVED_AT=1778727314
FOOTBALL_RESULT_SOURCE_HASH=0x38db2057f94468da1d9fa21eaedfb11bedb29885a81e2cab50aea198bc5e59b7
FOOTBALL_EVIDENCE_HASH=0xbb7c2d882e6d67262b59e06fe68ce00454c7a00ed08fdcb1b0eb267945c2268e
```

The preserved provider payload hash was:

```text
0x60b78718ea4ac1141bc558501389ab75cb5d97c3aa4785a61c4cde677aad2460
```

## Command Shape

The smoke used `.env` for `THE_ODDS_API_KEY` and Base Sepolia RPC values, but did not print secrets.
The SportsHub address and reporter-set hash came from the current v1.3 deployment/readback.

The generated files were:

- `raw-provider-response.json`
- `raw-provider-event.json`
- `result-source.json`
- `result-evidence.json`
- `result-proposal.json`
- `result-proposal.env`

## Result

The real provider ingestion path is working for a completed football/soccer event:

1. fetch provider scores;
2. select the exact provider event id;
3. verify `completed=true` and scores are present;
4. map home/draw/away to SportsHub outcome ids;
5. produce canonical `resultSourceHash` and `evidenceHash`;
6. emit an env file that can be sourced by the SportsHub football canary.

This does not prove on-chain settlement for this MLS event, because no matching SportsHub market was
created for it. The next end-to-end provider-driven canary should create a short-lived test market for
a real completed or mock-window event, then submit the provider-generated env through
`WorldCupFootballCanaryV13`.
