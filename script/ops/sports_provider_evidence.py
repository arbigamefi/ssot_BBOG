#!/usr/bin/env python3
"""Build SportsHub result evidence from a real sports data provider.

The first supported provider is The Odds API scores endpoint. The script can
fetch live provider data with THE_ODDS_API_KEY or run deterministically from a
fixture for CI.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROVIDER_NAME = "the-odds-api"
PROVIDER_ENDPOINT = "https://api.the-odds-api.com/v4/sports/{sport}/scores/"


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
        result = subprocess.run(
            ["cast", "keccak", value],
            check=True,
            capture_output=True,
            text=True,
        )
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


def require_address(value: str, name: str) -> str:
    if not value.startswith("0x") or len(value) != 42:
        fail(f"{name} must be an EVM address")
    int(value[2:], 16)
    return value


def fetch_the_odds_scores(api_key: str, sport_key: str, days_from: int, event_id: str, timeout: float) -> list[Any]:
    query = {
        "apiKey": api_key,
        "daysFrom": str(days_from),
        "dateFormat": "iso",
        "eventIds": event_id,
    }
    url = PROVIDER_ENDPOINT.format(sport=urllib.parse.quote(sport_key, safe="")) + "?" + urllib.parse.urlencode(query)
    request = urllib.request.Request(url, headers={"User-Agent": "arbigamefi-sports-provider-evidence/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read()
    except Exception as exc:  # urllib raises several concrete network exceptions.
        fail(f"provider request failed: {exc}")
    try:
        payload = json.loads(body.decode("utf-8"))
    except json.JSONDecodeError:
        fail("provider returned non-JSON response")
    if not isinstance(payload, list):
        fail("provider scores response must be a JSON array")
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

    api_key = args.api_key or env("THE_ODDS_API_KEY")
    if not api_key:
        fail("missing THE_ODDS_API_KEY or --api-key")
    return fetch_the_odds_scores(api_key, args.sport_key, args.days_from, args.provider_event_id, args.timeout)


def find_event(payload: list[Any], event_id: str) -> dict[str, Any]:
    matches = [event for event in payload if isinstance(event, dict) and str(event.get("id")) == event_id]
    if len(matches) != 1:
        fail(f"expected exactly one provider event for id {event_id}, got {len(matches)}")
    return matches[0]


def parse_score(raw_score: Any, team: str) -> int:
    try:
        return int(str(raw_score))
    except ValueError:
        fail(f"score for {team} must be an integer")


def derive_winner(event: dict[str, Any], home_outcome_id: int, draw_outcome_id: int, away_outcome_id: int) -> dict[str, Any]:
    if event.get("completed") is not True:
        fail("provider event is not completed")
    scores = event.get("scores")
    if not isinstance(scores, list):
        fail("provider event has no scores array")

    home_team = str(event.get("home_team") or "")
    away_team = str(event.get("away_team") or "")
    if not home_team or not away_team:
        fail("provider event is missing home_team or away_team")

    score_by_name: dict[str, int] = {}
    for row in scores:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name") or "")
        if name:
            score_by_name[name] = parse_score(row.get("score"), name)

    if home_team not in score_by_name or away_team not in score_by_name:
        fail("scores do not include both home and away teams")

    home_score = score_by_name[home_team]
    away_score = score_by_name[away_team]
    if home_score > away_score:
        return {"winningSide": "home", "winningOutcomeId": home_outcome_id, "homeScore": home_score, "awayScore": away_score}
    if home_score < away_score:
        return {"winningSide": "away", "winningOutcomeId": away_outcome_id, "homeScore": home_score, "awayScore": away_score}
    return {"winningSide": "draw", "winningOutcomeId": draw_outcome_id, "homeScore": home_score, "awayScore": away_score}


def optional_result_payload_hash(args: argparse.Namespace, result_source_hash: str, evidence_hash: str, observed_at: int) -> str | None:
    if not args.rpc_url or not args.sports_hub:
        return None
    try:
        result = subprocess.run(
            [
                "cast",
                "call",
                args.sports_hub,
                "hashResultPayload(uint64,uint32,bytes32,bytes32,uint64)(bytes32)",
                str(args.market_id),
                str(args.winning_outcome_id),
                result_source_hash,
                evidence_hash,
                str(observed_at),
                "--rpc-url",
                args.rpc_url,
            ],
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        fail("missing command: cast")
    except subprocess.CalledProcessError as exc:
        fail(f"cast call hashResultPayload failed: {exc.stderr.strip()}")
    return result.stdout.strip()


def build_evidence(args: argparse.Namespace) -> dict[str, Any]:
    payload = load_provider_payload(args)
    event = find_event(payload, args.provider_event_id)
    winner = derive_winner(event, args.home_outcome_id, args.draw_outcome_id, args.away_outcome_id)
    args.winning_outcome_id = int(winner["winningOutcomeId"])

    last_update = event.get("last_update") or event.get("completed_at") or event.get("commence_time")
    if not isinstance(last_update, str) or not last_update:
        fail("provider event is missing last_update/completed_at/commence_time")
    observed_at = parse_iso8601_seconds(last_update, "provider last_update")

    endpoint_without_key = PROVIDER_ENDPOINT.format(sport=args.sport_key) + "?" + urllib.parse.urlencode(
        {
            "daysFrom": str(args.days_from),
            "dateFormat": "iso",
            "eventIds": args.provider_event_id,
        }
    )
    raw_event_sha256 = sha256_json(event)

    source_bundle: dict[str, Any] = {
        "schemaVersion": "sportsbook.result-source.the-odds-api.v1",
        "provider": {
            "name": PROVIDER_NAME,
            "endpoint": endpoint_without_key,
            "sportKey": args.sport_key,
            "providerEventId": args.provider_event_id,
        },
        "event": {
            "providerEventId": args.provider_event_id,
            "sportKey": event.get("sport_key"),
            "sportTitle": event.get("sport_title"),
            "commenceTime": event.get("commence_time"),
            "completed": event.get("completed"),
            "homeTeam": event.get("home_team"),
            "awayTeam": event.get("away_team"),
            "lastUpdate": last_update,
            "homeScore": winner["homeScore"],
            "awayScore": winner["awayScore"],
        },
        "outcomeMapping": {
            "homeOutcomeId": args.home_outcome_id,
            "drawOutcomeId": args.draw_outcome_id,
            "awayOutcomeId": args.away_outcome_id,
            "winningSide": winner["winningSide"],
            "winningOutcomeId": args.winning_outcome_id,
        },
        "observedAt": observed_at,
        "rawProviderEventSha256": raw_event_sha256,
    }
    result_source_hash = keccak_text(canonical_json(source_bundle))

    evidence_bundle: dict[str, Any] = {
        "schemaVersion": "sportsbook.result-evidence.the-odds-api.v1",
        "chainId": args.chain_id,
        "sportsHub": args.sports_hub,
        "marketId": args.market_id,
        "eventId": args.event_id,
        "poolId": args.pool_id,
        "marketVersion": args.market_version,
        "marketKey": args.market_key,
        "rulebookHash": args.rulebook_hash,
        "winningOutcomeId": args.winning_outcome_id,
        "observedAt": observed_at,
        "providers": [
            {
                "name": PROVIDER_NAME,
                "feedId": args.sport_key,
                "providerEventId": args.provider_event_id,
                "observedStatus": "final",
                "observedScore": {
                    "home": winner["homeScore"],
                    "away": winner["awayScore"],
                },
                "payloadSha256": raw_event_sha256,
                "archiveUri": "file://raw-provider-event.json",
                "sourceBundleHash": result_source_hash,
            }
        ],
        "reporter": {
            "reporterSetHash": args.reporter_set_hash,
            "threshold": args.reporter_threshold,
            "signers": args.reporter_signers,
        },
        "hashes": {
            "resultSourceHash": result_source_hash,
        },
        "approvals": {
            "operatorReview": args.operator_review,
            "incidentOrMarketRecord": args.incident_or_market_record,
        },
    }
    evidence_hash = keccak_text(canonical_json(evidence_bundle))
    result_payload_hash = optional_result_payload_hash(args, result_source_hash, evidence_hash, observed_at)

    return {
        "rawResponse": payload,
        "rawEvent": event,
        "sourceBundle": source_bundle,
        "evidenceBundle": evidence_bundle,
        "summary": {
            "schemaVersion": "sportsbook.result-proposal.the-odds-api.v1",
            "provider": PROVIDER_NAME,
            "sportKey": args.sport_key,
            "providerEventId": args.provider_event_id,
            "marketId": args.market_id,
            "eventId": args.event_id,
            "poolId": args.pool_id,
            "winningOutcomeId": args.winning_outcome_id,
            "observedAt": observed_at,
            "resultSourceHash": result_source_hash,
            "evidenceHash": evidence_hash,
            "resultPayloadHash": result_payload_hash,
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate SportsHub result evidence from provider scores.")
    parser.add_argument("--provider", default=env("SPORTS_PROVIDER", PROVIDER_NAME), choices=[PROVIDER_NAME])
    parser.add_argument("--api-key", default=env("THE_ODDS_API_KEY"))
    parser.add_argument("--fixture", default=env("SPORTS_PROVIDER_FIXTURE"))
    parser.add_argument("--sport-key", default=env("SPORTS_PROVIDER_SPORT_KEY", "soccer_fifa_world_cup"))
    parser.add_argument("--provider-event-id", default=env("SPORTS_PROVIDER_EVENT_ID"))
    parser.add_argument("--days-from", type=int, default=env_int("THE_ODDS_API_DAYS_FROM", 3))
    parser.add_argument("--timeout", type=float, default=float(env("SPORTS_PROVIDER_TIMEOUT_SECONDS", "10")))
    parser.add_argument("--out-dir", default=env("SPORTS_PROVIDER_EVIDENCE_DIR", "tmp/sports-provider-evidence"))
    parser.add_argument("--chain-id", type=int, default=env_int("CHAIN_ID", 84532))
    parser.add_argument("--sports-hub", default=env("SPORTS_HUB"))
    parser.add_argument("--market-id", type=int, default=env_int("FOOTBALL_MARKET_ID", 0))
    parser.add_argument("--event-id", type=int, default=env_int("FOOTBALL_EVENT_ID", 2026061101))
    parser.add_argument("--pool-id", type=int, default=env_int("FOOTBALL_POOL_ID", 2))
    parser.add_argument("--market-version", type=int, default=env_int("FOOTBALL_MARKET_VERSION", 1))
    parser.add_argument("--market-key", default=env("FOOTBALL_MARKET_KEY", "FIFA_WORLD_CUP_2026_MEXICO_SOUTH_AFRICA_1X2"))
    parser.add_argument("--rulebook-hash", default=env("FOOTBALL_RULEBOOK_HASH"))
    parser.add_argument("--reporter-set-hash", default=env("SPORTS_RESULT_REPORTER_SET_HASH"))
    parser.add_argument("--reporter-threshold", type=int, default=env_int("SPORTS_RESULT_REPORTER_THRESHOLD", 1))
    parser.add_argument("--reporter-signer", action="append", dest="reporter_signers", default=None)
    parser.add_argument("--home-outcome-id", type=int, default=env_int("SPORTS_HOME_OUTCOME_ID", 0))
    parser.add_argument("--draw-outcome-id", type=int, default=env_int("SPORTS_DRAW_OUTCOME_ID", 1))
    parser.add_argument("--away-outcome-id", type=int, default=env_int("SPORTS_AWAY_OUTCOME_ID", 2))
    parser.add_argument("--operator-review", default=env("SPORTS_OPERATOR_REVIEW", "TBD"))
    parser.add_argument("--incident-or-market-record", default=env("SPORTS_INCIDENT_OR_MARKET_RECORD", "TBD"))
    parser.add_argument("--rpc-url", default=env("RPC_URL"))
    args = parser.parse_args()

    if args.provider != PROVIDER_NAME:
        fail(f"unsupported provider: {args.provider}")
    if not args.provider_event_id:
        fail("missing SPORTS_PROVIDER_EVENT_ID or --provider-event-id")
    if args.days_from < 1 or args.days_from > 3:
        fail("--days-from must be between 1 and 3")
    if args.market_id <= 0:
        fail("missing FOOTBALL_MARKET_ID or --market-id")
    if not args.sports_hub:
        fail("missing SPORTS_HUB or --sports-hub")
    args.sports_hub = require_address(args.sports_hub, "sportsHub")
    if not args.rulebook_hash:
        fail("missing FOOTBALL_RULEBOOK_HASH or --rulebook-hash")
    args.rulebook_hash = require_hex32(args.rulebook_hash, "rulebookHash")
    if not args.reporter_set_hash:
        fail("missing SPORTS_RESULT_REPORTER_SET_HASH or --reporter-set-hash")
    args.reporter_set_hash = require_hex32(args.reporter_set_hash, "reporterSetHash")
    if args.reporter_threshold <= 0:
        fail("reporter threshold must be positive")
    args.reporter_signers = args.reporter_signers or [env("SPORTS_RESULT_REPORTER", "0x0000000000000000000000000000000000000000")]
    args.reporter_signers = [require_address(signer, "reporter signer") for signer in args.reporter_signers]
    return args


def main() -> None:
    args = parse_args()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    bundle = build_evidence(args)
    write_json(out_dir / "raw-provider-response.json", bundle["rawResponse"])
    write_json(out_dir / "raw-provider-event.json", bundle["rawEvent"])
    write_json(out_dir / "result-source.json", bundle["sourceBundle"])
    write_json(out_dir / "result-evidence.json", bundle["evidenceBundle"])
    write_json(out_dir / "result-proposal.json", bundle["summary"])

    summary = bundle["summary"]
    env_lines = [
        f"FOOTBALL_WINNING_OUTCOME_ID={summary['winningOutcomeId']}",
        f"FOOTBALL_RESULT_OBSERVED_AT={summary['observedAt']}",
        f"FOOTBALL_RESULT_SOURCE_HASH={summary['resultSourceHash']}",
        f"FOOTBALL_EVIDENCE_HASH={summary['evidenceHash']}",
    ]
    if summary["resultPayloadHash"]:
        env_lines.append(f"FOOTBALL_RESULT_PAYLOAD_HASH={summary['resultPayloadHash']}")
    (out_dir / "result-proposal.env").write_text("\n".join(env_lines) + "\n", encoding="utf-8")

    print("sports provider evidence generated:")
    print(f"  provider: {summary['provider']}")
    print(f"  sportKey: {summary['sportKey']}")
    print(f"  providerEventId: {summary['providerEventId']}")
    print(f"  marketId: {summary['marketId']}")
    print(f"  winningOutcomeId: {summary['winningOutcomeId']}")
    print(f"  observedAt: {summary['observedAt']}")
    print(f"  resultSourceHash: {summary['resultSourceHash']}")
    print(f"  evidenceHash: {summary['evidenceHash']}")
    if summary["resultPayloadHash"]:
        print(f"  resultPayloadHash: {summary['resultPayloadHash']}")
    print(f"  outDir: {out_dir}")


if __name__ == "__main__":
    main()
