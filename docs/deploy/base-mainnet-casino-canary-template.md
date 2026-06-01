# Base Mainnet Casino Canary Template

Status: **Template — copy for each mainnet release canary**

Copy this file to `docs/deploy/base-mainnet-casino-canary-YYYY-MM-DD.md` after
the Base mainnet deployment and frontend release sync are complete. Do not
record secrets. Do not run this canary until the readiness packet says the
release, frontend, keeper, and bet-index gates are ready.

## Scope

This canary proves the public casino path with real Base mainnet contracts:

- player approves USDC when needed;
- player broadcasts `GameHub.placeBet`;
- Chainlink VRF fulfills the request and moves the bet to `RandomReady`;
- the primary keeper observes the bet and calls permissionless
  `GameHub.finalize`;
- the frontend terminal receipt reads final payout/refund fields from chain;
- the player does not manually sign settlement on the normal path.

SportsHub public risk-in remains out of scope unless a separate Phase 2 GO
packet is approved.

## Release

| Field | Value |
| --- | --- |
| Chain | Base mainnet (`8453`) |
| Release block | `TBD` |
| Release digest | `TBD` |
| Release package | `dist/ssot-release-chain-8453-<block>-<digest>.tar.gz` |
| Embedded frontend release | `frontend/packages/ssot/src/release/embedded/chain-8453.json` |
| GameHub | `TBD` |
| SettlementRouter | `TBD` |
| VRFHub | `TBD` |
| Casino Bank | `TBD` |
| Asset | Base mainnet USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Keeper primary | `TBD` |
| Keeper backup | `TBD` |

## Preconditions

- [ ] `ENV_FILE=.env.base-mainnet-v13-casino make casino-mainnet-preflight-v13`
      passed before broadcast.
- [ ] `STRICT=1 make release-check` passed after deployment.
- [ ] `pnpm -C frontend ssot:sync -- --from dist/ssot-release-chain-8453-<block>-<digest>.tar.gz`
      completed.
- [ ] `pnpm -C frontend check:mainnet-release` passed.
- [ ] `pnpm -C frontend smoke:release-readonly -- --chain-id 8453` passed.
- [ ] Primary and backup keeper units are running on different hosts or
      regions.
- [ ] Managed Postgres backfill, backup, and restore drill are recorded.
- [ ] Casino bank has the approved initial liquidity.
- [ ] Canary player has the approved smallest public stake amount, enough ETH
      for gas and VRF fee buffer, and no governance/deployer key reuse.

## Commands

Simulation:

```bash
CANARY_STAKE=10000 \
CANARY_BET_COUNT=1 \
CANARY_DICE_CAP=50 \
SNAPSHOT_PATH=deployments/latest-v13.json \
ENV_FILE=.env.base-mainnet-v13-casino \
make gamehub-canary-v13
```

Broadcast:

```bash
BROADCAST=1 \
CANARY_STAKE=10000 \
CANARY_BET_COUNT=1 \
CANARY_DICE_CAP=50 \
SNAPSHOT_PATH=deployments/latest-v13.json \
ENV_FILE=.env.base-mainnet-v13-casino \
make gamehub-canary-v13
```

Status readback:

```bash
CANARY_MODE=status \
CANARY_POSITION_ID=<bet-id> \
SNAPSHOT_PATH=deployments/latest-v13.json \
ENV_FILE=.env.base-mainnet-v13-casino \
make gamehub-canary-v13
```

Manual fallback only if both keepers fail:

```bash
CANARY_MODE=finalize \
CANARY_POSITION_ID=<bet-id> \
SNAPSHOT_PATH=deployments/latest-v13.json \
ENV_FILE=.env.base-mainnet-v13-casino \
make gamehub-canary-v13
```

## Evidence

### Place

| Field | Value |
| --- | --- |
| Approve tx | `TBD` |
| Place tx | `TBD` |
| Place block | `TBD` |
| Position / bet id | `TBD` |
| Request id | `TBD` |
| Stake | `TBD` |
| Reserved | `TBD` |
| Quoted VRF fee | `TBD` |
| Paid VRF fee with buffer | `TBD` |
| Initial state | `PendingVRF` |

### VRF

| Field | Value |
| --- | --- |
| Fulfill tx | `TBD` |
| Fulfill block | `TBD` |
| `BetRandomReady` observed | `TBD` |
| Random hash | `TBD` |
| Charged VRF fee | `TBD` |

### Keeper Settlement

| Field | Value |
| --- | --- |
| Finalize tx | `TBD` |
| Finalize block | `TBD` |
| Final state | `Settled` or `Refunded` |
| Payout gross / net | `TBD` |
| Refund amount | `TBD` |
| Protocol fee accrual | `TBD` |
| Primary health snapshot age | `TBD` |
| Backup health snapshot age | `TBD` |

Keeper log excerpt:

```text
TBD
```

### Frontend Terminal Receipt

| Field | Value |
| --- | --- |
| Route tested | `/casino/dice` and `/portfolio/activity/<bet-id>` |
| Result modal shown after terminal state | `TBD` |
| Win/loss shown | `TBD` |
| Drawn outcome shown | `TBD` |
| Payout/refund shown | `TBD` |
| Explorer links shown | `TBD` |
| Console errors | `TBD` |

### Bet Index

| Field | Value |
| --- | --- |
| `gamehub_events` rows for canary | `TBD` |
| `bets` row state | `TBD` |
| `/api/bets/recent` includes canary | `TBD` |
| `/portfolio/activity/<bet-id>` loads from direct chain or index fallback | `TBD` |

## Acceptance

- [ ] Place tx status is `1`.
- [ ] VRF fulfill tx status is `1`.
- [ ] Finalize tx status is `1`, unless the canary is intentionally proving a
      refund path.
- [ ] Final state is terminal.
- [ ] Player did not need to click manual settlement on the normal path.
- [ ] Frontend terminal receipt matches direct chain readback.
- [ ] Keeper primary and backup health snapshots are fresh.
- [ ] Bet-index row is present or documented as a recoverable lag with a
      backfill plan.
- [ ] No raw revert, unknown error, or layout-breaking receipt was shown to the
      player.

## Conclusion

`TBD: Passed / Failed / Follow-up required`
