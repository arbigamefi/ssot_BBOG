#!/usr/bin/env python3
"""Build SportsHub football 1X2 odds snapshots from a sports odds provider.

The first supported provider is The Odds API `/odds` endpoint. The script can
fetch live odds with THE_ODDS_API_KEY or run deterministically from a fixture.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_DOWN
from pathlib import Path
from typing import Any


PROVIDER_NAME = "the-odds-api"
PROVIDER_ENDPOINT = "https://api.the-odds-api.com/v4/sports/{sport}/odds/"
WAD = Decimal(10) ** 18


def fail(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(1)


def env(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name)
    if value is None or value == "":
        return default
    return value


def env_int(name: str, default: int | None = None) -> int | None:
    value = env(name)
    if value is None:
        return default
    try:
        return int(value, 0)
    except ValueError:
        fail(f"{name} must be an integer")


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True, ensure_ascii=True) + "\n", encoding="utf-8")


def keccak_text(value: str) -> str:
    try:
        result = subprocess.run(["cast", "keccak", value], check=True, capture_output=True, text=True)
    except FileNotFoundError:
        fail("missing command: cast")
    except subprocess.CalledProcessError as exc:
        fail(f"cast keccak failed: {exc.stderr.strip()}")
    return result.stdout.strip()


def sha256_json(value: Any) -> str:
    return "0x" + hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def parse_iso8601_seconds(value: str, field: str) -> int:
    try:
        normalized = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
    except ValueError:
        fail(f"{field} must be an ISO 8601 timestamp")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.astimezone(timezone.utc).timestamp())


def require_hex32(value: str, name: str) -> str:
    if not value.startswith("0x") or len(value) != 66:
        fail(f"{name} must be a 32-byte hex value")
    int(value[2:], 16)
    return value


def decimal_odds_to_wad(value: Any, label: str) -> int:
    try:
        price = Decimal(str(value))
    except InvalidOperation:
        fail(f"{label} price must be decimal odds")
    if price <= Decimal("1"):
        fail(f"{label} price must be greater than 1.0")
    return int((price * WAD).to_integral_value(rounding=ROUND_DOWN))


def payout_for_odds(stake_raw: int, odds_wad: int) -> int:
    return stake_raw * odds_wad // int(WAD)


def fetch_the_odds(args: argparse.Namespace) -> list[Any]:
    api_key = args.api_key or env("THE_ODDS_API_KEY")
    if not api_key:
        fail("missing THE_ODDS_API_KEY or --api-key")

    query = {
        "apiKey": api_key,
        "markets": args.market_key,
        "oddsFormat": "decimal",
        "dateFormat": "iso",
    }
    if args.bookmaker_key:
        query["bookmakers"] = args.bookmaker_key
    else:
        query["regions"] = args.regions
    if args.provider_event_id:
        query["eventIds"] = args.provider_event_id
    if args.commence_time_from:
        query["commenceTimeFrom"] = args.commence_time_from
    if args.commence_time_to:
        query["commenceTimeTo"] = args.commence_time_to

    url = PROVIDER_ENDPOINT.format(sport=urllib.parse.quote(args.sport_key, safe="")) + "?" + urllib.parse.urlencode(query)
    request = urllib.request.Request(url, headers={"User-Agent": "arbigamefi-sports-provider-odds/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=args.timeout) as response:
            body = response.read()
    except Exception as exc:  # urllib raises several concrete network exceptions.
        fail(f"provider odds request failed: {exc}")
    try:
        payload = json.loads(body.decode("utf-8"))
    except json.JSONDecodeError:
        fail("provider returned non-JSON odds response")
    if not isinstance(payload, list):
        fail("provider odds response must be a JSON array")
    return payload


def load_provider_payload(args: argparse.Namespace) -> list[Any]:
    if args.fixture:
        try:
            payload = json.loads(Path(args.fixture).read_text(encoding="utf-8"))
        except FileNotFoundError:
            fail(f"fixture not found: {args.fixture}")
        except json.JSONDecodeError as exc:
            fail(f"fixture is not valid JSON: {exc}")
        if not isinstance(payload, list):
            fail("fixture must contain a JSON array")
        return payload
    return fetch_the_odds(args)


def market_from_bookmaker(bookmaker: dict[str, Any], market_key: str) -> dict[str, Any] | None:
    markets = bookmaker.get("markets")
    if not isinstance(markets, list):
        return None
    for market in markets:
        if isinstance(market, dict) and market.get("key") == market_key:
            return market
    return None


def find_event_with_market(payload: list[Any], args: argparse.Namespace) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    candidates = [event for event in payload if isinstance(event, dict)]
    if args.provider_event_id:
        candidates = [event for event in candidates if str(event.get("id")) == args.provider_event_id]
        if not candidates:
            fail(f"provider event not found: {args.provider_event_id}")

    for event in candidates:
        bookmakers = event.get("bookmakers")
        if not isinstance(bookmakers, list):
            continue
        for bookmaker in bookmakers:
            if not isinstance(bookmaker, dict):
                continue
            if args.bookmaker_key and bookmaker.get("key") != args.bookmaker_key:
                continue
            market = market_from_bookmaker(bookmaker, args.market_key)
            if market is not None:
                return event, bookmaker, market

    if args.provider_event_id:
        fail(f"provider event {args.provider_event_id} has no {args.market_key} market")
    fail(f"no provider event with {args.market_key} odds found")


def extract_football_1x2(event: dict[str, Any], market: dict[str, Any], args: argparse.Namespace) -> dict[str, Any]:
    home_team = str(event.get("home_team") or "")
    away_team = str(event.get("away_team") or "")
    if not home_team or not away_team:
        fail("odds event is missing home_team or away_team")

    outcomes = market.get("outcomes")
    if not isinstance(outcomes, list):
        fail("odds market has no outcomes array")

    prices: dict[str, Any] = {}
    raw_outcomes: list[dict[str, Any]] = []
    for row in outcomes:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name") or "")
        if not name:
            continue
        prices[name] = row.get("price")
        raw_outcomes.append(row)

    if home_team not in prices:
        fail(f"missing home odds outcome: {home_team}")
    if away_team not in prices:
        fail(f"missing away odds outcome: {away_team}")
    draw_name = "Draw"
    if draw_name not in prices:
        fail("missing soccer draw odds outcome")

    return {
        "homeTeam": home_team,
        "awayTeam": away_team,
        "homeOutcomeId": args.home_outcome_id,
        "drawOutcomeId": args.draw_outcome_id,
        "awayOutcomeId": args.away_outcome_id,
        "homePrice": str(prices[home_team]),
        "drawPrice": str(prices[draw_name]),
        "awayPrice": str(prices[away_team]),
        "homeOddsWad": decimal_odds_to_wad(prices[home_team], "home"),
        "drawOddsWad": decimal_odds_to_wad(prices[draw_name], "draw"),
        "awayOddsWad": decimal_odds_to_wad(prices[away_team], "away"),
        "rawOutcomes": raw_outcomes,
    }


def build_snapshot(args: argparse.Namespace) -> dict[str, Any]:
    payload = load_provider_payload(args)
    event, bookmaker, market = find_event_with_market(payload, args)
    odds = extract_football_1x2(event, market, args)
    required_max_payout = max(
        payout_for_odds(args.stake_raw, odds["homeOddsWad"]),
        payout_for_odds(args.stake_raw, odds["drawOddsWad"]),
        payout_for_odds(args.stake_raw, odds["awayOddsWad"]),
    )
    if args.max_payout_raw < required_max_payout:
        fail(
            f"max payout too small for provider odds: {args.max_payout_raw} < required {required_max_payout}"
        )

    bookmaker_last_update = str(bookmaker.get("last_update") or "")
    market_last_update = str(market.get("last_update") or bookmaker_last_update)
    if not market_last_update:
        fail("odds market is missing last_update")
    odds_observed_at = parse_iso8601_seconds(market_last_update, "market last_update")
    generated_at = args.generated_at or int(time.time())
    expires_at = args.expires_at or generated_at + args.ttl_seconds
    if expires_at <= generated_at:
        fail("odds expiry must be after generatedAt")

    provider_event_id = str(event.get("id") or "")
    market_key_hash = args.market_key_hash or keccak_text(f"THE_ODDS_API:{args.sport_key}:{provider_event_id}:{args.market_key}")
    rulebook_hash = args.rulebook_hash or keccak_text("FOOTBALL_1X2_RULEBOOK_V1")
    raw_event_sha256 = sha256_json(event)

    endpoint_without_key = PROVIDER_ENDPOINT.format(sport=args.sport_key) + "?" + urllib.parse.urlencode(
        {
            "markets": args.market_key,
            "oddsFormat": "decimal",
            "dateFormat": "iso",
            "eventIds": provider_event_id,
            "bookmakers": str(bookmaker.get("key") or ""),
        }
    )

    source_bundle: dict[str, Any] = {
        "schemaVersion": "sportsbook.odds-source.the-odds-api.v1",
        "provider": {
            "name": PROVIDER_NAME,
            "endpoint": endpoint_without_key,
            "sportKey": args.sport_key,
            "providerEventId": provider_event_id,
        },
        "event": {
            "providerEventId": provider_event_id,
            "sportKey": event.get("sport_key"),
            "sportTitle": event.get("sport_title"),
            "commenceTime": event.get("commence_time"),
            "homeTeam": odds["homeTeam"],
            "awayTeam": odds["awayTeam"],
        },
        "bookmaker": {
            "key": bookmaker.get("key"),
            "title": bookmaker.get("title"),
            "lastUpdate": bookmaker_last_update,
        },
        "market": {
            "key": args.market_key,
            "lastUpdate": market_last_update,
            "homePrice": odds["homePrice"],
            "drawPrice": odds["drawPrice"],
            "awayPrice": odds["awayPrice"],
        },
        "outcomeMapping": {
            "homeOutcomeId": odds["homeOutcomeId"],
            "drawOutcomeId": odds["drawOutcomeId"],
            "awayOutcomeId": odds["awayOutcomeId"],
        },
        "rawProviderEventSha256": raw_event_sha256,
        "oddsObservedAt": odds_observed_at,
        "generatedAt": generated_at,
        "expiresAt": expires_at,
    }
    odds_source_hash = keccak_text(canonical_json(source_bundle))

    snapshot: dict[str, Any] = {
        "schemaVersion": "sportsbook.odds-snapshot.the-odds-api.v1",
        "chainId": args.chain_id,
        "sportsHub": args.sports_hub,
        "marketId": args.market_id,
        "eventId": args.event_id,
        "poolId": args.pool_id,
        "marketVersion": args.market_version,
        "marketKey": market_key_hash,
        "rulebookHash": rulebook_hash,
        "providerEventId": provider_event_id,
        "bookmakerKey": bookmaker.get("key"),
        "providerMarketKey": args.market_key,
        "oddsSourceHash": odds_source_hash,
        "oddsObservedAt": odds_observed_at,
        "generatedAt": generated_at,
        "expiresAt": expires_at,
        "outcomes": [
            {
                "outcomeId": odds["homeOutcomeId"],
                "side": "home",
                "name": odds["homeTeam"],
                "decimalPrice": odds["homePrice"],
                "oddsWad": str(odds["homeOddsWad"]),
            },
            {
                "outcomeId": odds["drawOutcomeId"],
                "side": "draw",
                "name": "Draw",
                "decimalPrice": odds["drawPrice"],
                "oddsWad": str(odds["drawOddsWad"]),
            },
            {
                "outcomeId": odds["awayOutcomeId"],
                "side": "away",
                "name": odds["awayTeam"],
                "decimalPrice": odds["awayPrice"],
                "oddsWad": str(odds["awayOddsWad"]),
            },
        ],
        "limits": {
            "stakeRaw": str(args.stake_raw),
            "maxPayoutRaw": str(args.max_payout_raw),
            "requiredMaxPayoutRaw": str(required_max_payout),
        },
        "approvals": {
            "operatorReview": args.operator_review,
            "incidentOrMarketRecord": args.incident_or_market_record,
        },
    }

    return {
        "rawResponse": payload,
        "rawEvent": event,
        "sourceBundle": source_bundle,
        "snapshot": snapshot,
        "summary": {
            "schemaVersion": "sportsbook.odds-proposal.the-odds-api.v1",
            "provider": PROVIDER_NAME,
            "sportKey": args.sport_key,
            "providerEventId": provider_event_id,
            "bookmakerKey": bookmaker.get("key"),
            "providerMarketKey": args.market_key,
            "marketId": args.market_id,
            "eventId": args.event_id,
            "poolId": args.pool_id,
            "marketKey": market_key_hash,
            "rulebookHash": rulebook_hash,
            "oddsSourceHash": odds_source_hash,
            "oddsObservedAt": odds_observed_at,
            "generatedAt": generated_at,
            "expiresAt": expires_at,
            "homeOddsWad": odds["homeOddsWad"],
            "drawOddsWad": odds["drawOddsWad"],
            "awayOddsWad": odds["awayOddsWad"],
            "requiredMaxPayoutRaw": required_max_payout,
            "maxPayoutRaw": args.max_payout_raw,
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate SportsHub football 1X2 odds from provider odds.")
    parser.add_argument("--provider", default=env("SPORTS_PROVIDER", PROVIDER_NAME), choices=[PROVIDER_NAME])
    parser.add_argument("--api-key", default=env("THE_ODDS_API_KEY"))
    parser.add_argument("--fixture", default=env("SPORTS_ODDS_PROVIDER_FIXTURE"))
    parser.add_argument("--sport-key", default=env("SPORTS_PROVIDER_SPORT_KEY", "soccer_fifa_world_cup"))
    parser.add_argument("--provider-event-id", default=env("SPORTS_PROVIDER_EVENT_ID"))
    parser.add_argument("--bookmaker-key", default=env("SPORTS_BOOKMAKER_KEY"))
    parser.add_argument("--regions", default=env("THE_ODDS_API_REGIONS", "us,uk,eu,au"))
    parser.add_argument("--market-key", default=env("THE_ODDS_API_MARKET_KEY", "h2h"))
    parser.add_argument("--commence-time-from", default=env("THE_ODDS_API_COMMENCE_TIME_FROM"))
    parser.add_argument("--commence-time-to", default=env("THE_ODDS_API_COMMENCE_TIME_TO"))
    parser.add_argument("--timeout", type=float, default=float(env("SPORTS_PROVIDER_TIMEOUT_SECONDS", "10")))
    parser.add_argument("--out-dir", default=env("SPORTS_ODDS_SNAPSHOT_DIR", "tmp/sports-provider-odds"))
    parser.add_argument("--chain-id", type=int, default=env_int("CHAIN_ID", 84532))
    parser.add_argument("--sports-hub", default=env("SPORTS_HUB", "0x0000000000000000000000000000000000000000"))
    parser.add_argument("--market-id", type=int, default=env_int("FOOTBALL_MARKET_ID", 1))
    parser.add_argument("--event-id", type=int, default=env_int("FOOTBALL_EVENT_ID", 2026061101))
    parser.add_argument("--pool-id", type=int, default=env_int("FOOTBALL_POOL_ID", 2))
    parser.add_argument("--market-version", type=int, default=env_int("FOOTBALL_MARKET_VERSION", 1))
    parser.add_argument("--market-key-hash", default=env("FOOTBALL_MARKET_KEY"))
    parser.add_argument("--rulebook-hash", default=env("FOOTBALL_RULEBOOK_HASH"))
    parser.add_argument("--home-outcome-id", type=int, default=env_int("SPORTS_HOME_OUTCOME_ID", 0))
    parser.add_argument("--draw-outcome-id", type=int, default=env_int("SPORTS_DRAW_OUTCOME_ID", 1))
    parser.add_argument("--away-outcome-id", type=int, default=env_int("SPORTS_AWAY_OUTCOME_ID", 2))
    parser.add_argument("--stake-raw", type=int, default=env_int("FOOTBALL_STAKE", 100_000))
    parser.add_argument("--max-payout-raw", type=int, default=env_int("FOOTBALL_MAX_PAYOUT", 300_000))
    parser.add_argument("--ttl-seconds", type=int, default=env_int("SPORTS_ODDS_TTL_SECONDS", 120))
    parser.add_argument("--expires-at", type=int, default=env_int("FOOTBALL_ODDS_EXPIRES_AT"))
    parser.add_argument("--generated-at", type=int, default=env_int("SPORTS_ODDS_GENERATED_AT"))
    parser.add_argument("--operator-review", default=env("SPORTS_OPERATOR_REVIEW", "TBD"))
    parser.add_argument("--incident-or-market-record", default=env("SPORTS_INCIDENT_OR_MARKET_RECORD", "TBD"))
    args = parser.parse_args()

    if args.provider != PROVIDER_NAME:
        fail(f"unsupported provider: {args.provider}")
    if args.market_key != "h2h":
        fail("football 1X2 odds ingestion currently supports only h2h")
    if args.ttl_seconds <= 0:
        fail("--ttl-seconds must be positive")
    if args.generated_at is not None and args.generated_at <= 0:
        fail("--generated-at must be positive")
    if args.market_key_hash:
        args.market_key_hash = require_hex32(args.market_key_hash, "marketKey")
    if args.rulebook_hash:
        args.rulebook_hash = require_hex32(args.rulebook_hash, "rulebookHash")
    if len({args.home_outcome_id, args.draw_outcome_id, args.away_outcome_id}) != 3:
        fail("home/draw/away outcome ids must be distinct")
    return args


def main() -> None:
    args = parse_args()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    bundle = build_snapshot(args)
    write_json(out_dir / "raw-odds-response.json", bundle["rawResponse"])
    write_json(out_dir / "raw-odds-event.json", bundle["rawEvent"])
    write_json(out_dir / "odds-source.json", bundle["sourceBundle"])
    write_json(out_dir / "odds-snapshot.json", bundle["snapshot"])
    write_json(out_dir / "odds-proposal.json", bundle["summary"])

    summary = bundle["summary"]
    env_lines = [
        f"SPORTS_PROVIDER_EVENT_ID={summary['providerEventId']}",
        f"SPORTS_BOOKMAKER_KEY={summary['bookmakerKey']}",
        f"FOOTBALL_EVENT_ID={summary['eventId']}",
        f"FOOTBALL_MARKET_KEY={summary['marketKey']}",
        f"FOOTBALL_RULEBOOK_HASH={summary['rulebookHash']}",
        f"FOOTBALL_ODDS_EXPIRES_AT={summary['expiresAt']}",
        f"FOOTBALL_HOME_ODDS_WAD={summary['homeOddsWad']}",
        f"FOOTBALL_DRAW_ODDS_WAD={summary['drawOddsWad']}",
        f"FOOTBALL_AWAY_ODDS_WAD={summary['awayOddsWad']}",
        f"FOOTBALL_MAX_PAYOUT={summary['maxPayoutRaw']}",
        f"FOOTBALL_REQUIRED_MAX_PAYOUT={summary['requiredMaxPayoutRaw']}",
        f"FOOTBALL_ODDS_SOURCE_HASH={summary['oddsSourceHash']}",
    ]
    (out_dir / "odds-snapshot.env").write_text("\n".join(env_lines) + "\n", encoding="utf-8")

    print("sports provider odds generated:")
    print(f"  provider: {summary['provider']}")
    print(f"  sportKey: {summary['sportKey']}")
    print(f"  providerEventId: {summary['providerEventId']}")
    print(f"  bookmakerKey: {summary['bookmakerKey']}")
    print(f"  marketId: {summary['marketId']}")
    print(f"  eventId: {summary['eventId']}")
    print(f"  marketKey: {summary['marketKey']}")
    print(f"  rulebookHash: {summary['rulebookHash']}")
    print(f"  homeOddsWad: {summary['homeOddsWad']}")
    print(f"  drawOddsWad: {summary['drawOddsWad']}")
    print(f"  awayOddsWad: {summary['awayOddsWad']}")
    print(f"  requiredMaxPayoutRaw: {summary['requiredMaxPayoutRaw']}")
    print(f"  maxPayoutRaw: {summary['maxPayoutRaw']}")
    print(f"  oddsObservedAt: {summary['oddsObservedAt']}")
    print(f"  expiresAt: {summary['expiresAt']}")
    print(f"  oddsSourceHash: {summary['oddsSourceHash']}")
    print(f"  outDir: {out_dir}")


if __name__ == "__main__":
    main()
