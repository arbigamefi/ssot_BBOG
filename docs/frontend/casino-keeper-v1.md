# Casino Keeper v1

| Owner | Frontend Lead + SRE |
| Status | Draft v1 |
| Last Updated | 2026-05-16 |
| Depends-on | `../design/casino-placebet-ux.md`, `25-observability.md`, `30-build-and-release.md` |
| Supersedes | manual-by-default casino finalize operations |

This document specifies the first production keeper for casino settlement.
It is an off-chain service that calls `GameHub.finalize(betId)` for bets that
have reached `RandomReady`.

## 1. Goal

The player signs only approval and `placeBet` on the normal path. The keeper
settles `RandomReady` bets automatically so the frontend can render a continuous
casino round.

## 2. Non-goals

- No change to `GameHub.onRandomWords`.
- No private settlement authority. `finalize` remains permissionless.
- No finalizer bounty in v1. Bounty requires a protocol ADR and contract minor
  version because it touches payout accounting.

## 3. Runtime

| Dimension | v1 decision |
| --- | --- |
| Language | Node.js + TypeScript |
| Chain client | `viem` |
| Transport | WebSocket for events, HTTP fallback scan |
| Wallet | dedicated keeper EOA with bounded native balance |
| Deployment | one primary instance, one backup instance after canary |
| Secrets | env vars only, never committed |

## 4. Inputs

Required environment:

```bash
KEEPER_PRIVATE_KEY=
KEEPER_CHAIN_ID=84532
KEEPER_RPC_HTTP=
KEEPER_RPC_WS=
KEEPER_RELEASE_PATH=frontend/packages/ssot/src/release/embedded/chain-84532.json
KEEPER_START_BLOCK=
KEEPER_BACKUP_DELAY_SECONDS=0
KEEPER_POLL_INTERVAL_SECONDS=15
```

Backup keeper uses `KEEPER_BACKUP_DELAY_SECONDS=5`.

## 5. Event Triggers

The keeper listens to:

- `GameHub.BetRandomReady(uint256 betId, uint256 requestId, bytes32 randomHash)`
- `VRFHub.Fulfilled(uint256 requestId, address hub, uint256 betId, bytes32 randomHash)`

Either event schedules the same idempotent action:

```text
read getBet(betId)
if state != RandomReady: stop
simulate finalize(betId)
write finalize(betId)
wait receipt
read getBet(betId)
record outcome
```

## 6. Fallback Scan

Every `KEEPER_POLL_INTERVAL_SECONDS`, scan the event window from
`lastScannedBlock` to `latestBlock` for `BetRandomReady` and enqueue any missed
bet. This protects against WebSocket disconnects.

The keeper does not need a full indexer in v1. It only needs the latest scanned
block persisted to a small JSON file or durable KV.

## 7. Queue Semantics

- One in-flight finalize per `betId`.
- Duplicate events collapse into the same queue item.
- Before broadcast, re-read `getBet`. If already `Settled` or `Refunded`, mark
  as raced success.
- Retry transient RPC failures with exponential backoff: 2s, 5s, 10s, 30s.
- Stop retrying after 10 minutes and raise an alert if the bet remains
  `RandomReady`.

## 8. Observability

Emit structured logs:

```json
{
  "event": "casino.finalize.mined",
  "chainId": 84532,
  "betId": "14",
  "requestId": "8890...",
  "txHash": "0x...",
  "latencyMs": 4210,
  "keeper": "primary"
}
```

Required metrics:

| Metric | Target | Alert |
| --- | --- | --- |
| `random_ready_to_settled_ms.p50` | < 5s | p95 > 15s |
| `casino_keeper_finalize_success_rate` | > 99.5% | < 99% |
| `casino_keeper_last_success_age_seconds` | < 60s | > 300s |
| `casino_keeper_random_ready_stuck_count` | 0 | > 0 |

## 9. Don'ts

- Do not settle bets that are not `RandomReady`.
- Do not use the player's wallet.
- Do not send a transaction without simulation.
- Do not depend solely on WebSocket events.
- Do not hide reverted finalize attempts; they are operational incidents.

## 10. How To Enforce

Keeper implementation must include tests for:

- duplicate `BetRandomReady` events
- already-settled race
- simulation failure
- RPC timeout and retry
- backup delay

Code search before merge:

```bash
rg -n "finalize\\(" scripts apps frontend | rg -v "manual|keeper|test"
rg -n "KEEPER_PRIVATE_KEY|KEEPER_RPC" .
```
