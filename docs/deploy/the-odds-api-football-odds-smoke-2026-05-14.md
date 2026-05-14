# The Odds API Football Odds Smoke - 2026-05-14

This smoke test proves the first real sports odds provider ingestion path without broadcasting any
chain transaction.

## Scope

- Provider: The Odds API.
- Endpoint family: v4 sports odds.
- Sport key: `soccer_usa_mls`.
- Provider market key: `h2h`.
- Bookmaker: `unibet`.
- Provider event ID: `f2d025aa026e63ee4460ffc28c3386e4`.
- Chain action: none. This was provider ingestion only.
- Evidence output: `tmp/sports-provider-odds-live-smoke/`.

## Selected Event

The provider returned an upcoming MLS event:

- Home: CF Montreal.
- Away: Chicago Fire.
- Provider commence time: `2026-05-16T20:30:00Z`.
- Provider market last update: `2026-05-14T04:01:35Z`.
- Outcome mapping: `0=home`, `1=draw`, `2=away`.

## Generated Odds Values

The provider ingestion script generated:

```bash
SPORTS_PROVIDER_EVENT_ID=f2d025aa026e63ee4460ffc28c3386e4
SPORTS_BOOKMAKER_KEY=unibet
FOOTBALL_EVENT_ID=2026051401
FOOTBALL_MARKET_KEY=0xb5e20ff3e78aa2c3529489964eb875ed9a106d105671f234d515ed90424241cc
FOOTBALL_RULEBOOK_HASH=0x109f97e7311fa79b5dba674dbd17587e15ba1d685a6432ee81ba72376efe8939
FOOTBALL_ODDS_EXPIRES_AT=1778731452
FOOTBALL_HOME_ODDS_WAD=2800000000000000000
FOOTBALL_DRAW_ODDS_WAD=3600000000000000000
FOOTBALL_AWAY_ODDS_WAD=2320000000000000000
FOOTBALL_MAX_PAYOUT=400000
FOOTBALL_REQUIRED_MAX_PAYOUT=360000
FOOTBALL_ODDS_SOURCE_HASH=0x1149665c145399ccf8cc2cbd99d6baf51f76a3a0a0120537023dcac25aab08b3
```

The preserved provider event payload hash was:

```text
0x3d3f3ac7e62a5e9acf4c9ec2a8b111091f701bb8d8a3aedeaad3fdb36ad0d1a1
```

## Command Shape

The smoke used `.env` for `THE_ODDS_API_KEY` and Base Sepolia context, but did not print secrets.
The SportsHub address came from the current v1.3 deployment/readback.

The generated files were:

- `raw-odds-response.json`
- `raw-odds-event.json`
- `odds-source.json`
- `odds-snapshot.json`
- `odds-proposal.json`
- `odds-snapshot.env`

## Result

The real provider odds ingestion path is working for a football/soccer 1X2 market:

1. fetch provider odds;
2. select the exact provider event id and bookmaker;
3. map home/draw/away to SportsHub outcome ids;
4. convert decimal odds to WAD odds;
5. reject odds when the configured max payout is below the provider-implied payout;
6. produce canonical `oddsSourceHash`;
7. emit an env file that can be sourced by the SportsHub football canary.

This does not prove on-chain placement for this MLS event, because no matching SportsHub market was
created for it. The next end-to-end provider-driven canary should create a short-lived test market
from a provider odds snapshot, place signed tickets with those odds, then settle with provider result
evidence after the event completes.
