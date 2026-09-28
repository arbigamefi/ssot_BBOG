# The Odds API integration

The current web application exposes `GET /api/sportsbook/provider-odds` through
[provider-odds.ts](../../frontend/apps/web/src/server/sportsbook/provider-odds.ts).
It fetches `h2h` decimal odds from the provider's `/v4/sports/{sportKey}/odds/` endpoint.
It does not ingest final scores, generate evidence bundles, sign reporter proposals or submit them.

## Configuration

`NEXT_PUBLIC_SPORTSBOOK_ENABLED=true` enables the application route; `THE_ODDS_API_KEY` is a
server-only secret. Configure the intended provider event and bookmaker explicitly.

| Variable | Use |
| --- | --- |
| `SPORTS_PROVIDER_SPORT_KEY` | Provider sport identifier; source default is `soccer_fifa_world_cup` |
| `SPORTS_PROVIDER_EVENT_ID` | Provider event to select |
| `SPORTS_BOOKMAKER_KEY` | Bookmaker to select |
| `THE_ODDS_API_REGIONS` | Region filter when a bookmaker is not specified; defaults to `us` |

The first three variables support a `_<marketId>` suffix. Corresponding query parameters can select
sport, event, bookmaker and regions; they do not establish that the selection matches an on-chain
market. Without an event/bookmaker filter the implementation chooses the first matching `h2h`
selection. Operators must verify event identity before using a quote.

The returned football outcome mapping is home `0`, draw `1`, away `2`. All three prices and both team
names must exist. The response includes provider event/bookmaker identity and update time; it remains
external source data. The ticket-signing path must separately enforce the intended on-chain market,
expiry, player/stake binding and current signer/risk/rulebook hashes.

## Failure handling

The server rejects disabled access, missing credentials, provider HTTP errors and incomplete source
payloads. Check the route's rate limits and the provider account's usage limits before enabling it.
Keep API keys and credential-bearing request URLs out of logs. Preserve source payloads and their
identity when investigating an incorrect quote, without treating a successful HTTP fetch as approval
to place a ticket.

Provider commercial access and market/rulebook suitability remain deployment decisions. Result
reporters follow the separate [evidence policy](sportsbook-provider-evidence-policy.md).
