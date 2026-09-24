> Historical reference: this document includes pre-v1.5 deployment observations or commands. Those tools/artifacts were retired from the working tree. Use the [current deployment workflow](../../deploy/v15-release.md) for operations; retrieve historical files from Git at `a5d7d3fa50d4457f1476de0ac7fc3bd83ca49273`.

# Runbook: Retune `minPlayerTurnoverForUnlock` and sweep locked referral XP

This runbook covers changing a Bank's referral unlock threshold and recovering
awards that a previous threshold left stuck in the locked bucket.

It exists because of a live Base mainnet misconfiguration: the USDC casino Bank
was deployed with the 18-decimal literal `20000000000000000000` for a 6-decimal
asset, making the threshold 20,000,000,000,000 USDC instead of 20 USDC.

---

## Scope

**In-scope**

- `Bank.setMinPlayerTurnoverForUnlock` (onlyGov) on a deployed v1.4 Bank
- Sweeping already-locked awards with `Bank.unlockXPLocked` (permissionless)
- Verifying the result on chain and in the release snapshot

**Out-of-scope**

- Holdback vesting (bounded in-contract to `(0, 365 days]`; see
  [Bank solvency](bank-solvency.md))
- Governance transfer itself (see [Pause + config drift](pause-config-drift.md))

---

## Why this parameter is the fragile one

Every other per-pool Bank knob is bounded by the contract: `riskReserveBps` and
`withdrawalBufferBps` are rejected above `10_000`, `holdbackVestingSeconds` is
rejected outside `(0, 365 days]`. `minPlayerTurnoverForUnlock` is the only pool
parameter that is both **denominated in raw asset units** and **unbounded**, so
it is the only one where a cross-decimals copy/paste lands silently.

Consequences of an unreachable threshold:

- `DefaultReferralEngine._splitAmounts` routes every non-holdback referral share
  to `locked` instead of `immediate`.
- `Bank.unlockXPLocked` refuses to release those awards.
- The amounts stay in `xpLockedTotal`, which is part of `XP` liabilities, so
  `NAV = B - PF - XP` stays depressed for LPs for as long as the threshold holds.

There is no theft path — this is the realized form of audit finding
`AGF-07` in `docs/audit/DeltaAudit-2026-06-10.md`.

---

## Prerequisites

### Addresses

Read from the **chain-specific** snapshot, not the `latest-*` pointer:

- Base mainnet v1.4: `deployments/snapshots/deploy-8453-46970755-v14.json`
- Base Sepolia v1.4: `deployments/latest-v14.json`

`deployments/latest-v14.json` points at Base Sepolia while
`deployments/latest-v13.json` points at Base mainnet. Always pass
`SNAPSHOT_PATH` explicitly for mainnet work.

### Tools

- `forge` for the governance script
- `cast` for reads and the locked-award sweep
- `jq`

### Authority

`PRIVATE_KEY` must be the Bank's current `governance()`. The script refuses to
broadcast otherwise instead of burning gas on a reverting call.

---

## Step 1 — Read the current state

```bash
BANK=0x597266Ba243455f1A9145bA0Cdc0408AaE532c77   # Base mainnet USDC casino Bank
cast call "$BANK" "minPlayerTurnoverForUnlock()(uint256)" --rpc-url "$RPC_URL"
cast call "$BANK" "xpLockedTotal()(uint256)"            --rpc-url "$RPC_URL"
cast call "$BANK" "decimals()(uint8)"                   --rpc-url "$RPC_URL"
```

Divide the threshold by `10 ** decimals` to get whole asset units. Do **not** do
this in shell arithmetic: raw 18-decimal amounts exceed 2^63 and bash truncates
them while still printing a plausible number.

## Step 2 — Dry run the change

```bash
SNAPSHOT_PATH=deployments/snapshots/deploy-8453-46970755-v14.json \
MIN_TURNOVER_POOL_ID=1 \
MIN_TURNOVER_VALUE=20000000 \
RPC_URL=<base-mainnet-rpc> \
make casino-set-min-turnover-dryrun-v14
```

`MIN_TURNOVER_VALUE` is in raw asset units: 20 USDC is `20000000`, 20 WETH is
`20000000000000000000`. The script's preflight proves `asset.decimals()` on
chain, checks `Bank.asset()` and the registry wiring, requires the broadcaster
to be governance, and rejects values whose scaled magnitude exceeds
`MIN_TURNOVER_MAX_UNITS` (default 1,000,000 units) so the same class of literal
cannot be written twice.

Confirm the logged `chainId`, `bank`, `assetSymbol`, `currentMinTurnoverUnits`
and `newMinTurnoverUnits` before continuing.

## Step 3 — Broadcast

```bash
SNAPSHOT_PATH=deployments/snapshots/deploy-8453-46970755-v14.json \
MIN_TURNOVER_POOL_ID=1 \
MIN_TURNOVER_VALUE=20000000 \
RPC_URL=<base-mainnet-rpc> \
make casino-set-min-turnover-v14
```

The script reads the value back after broadcast and reverts the run if it did
not apply.

## Step 4 — Sweep the awards that were locked under the old threshold

Lowering the threshold is retroactive: `unlockXPLocked` is permissionless and
reads the **current** value, so previously locked awards become releasable with
no further governance action. They are not released automatically — each
`(payee, sourcePlayer)` pair needs one call.

Enumerate the pairs from `XPAwarded`, whose `payee` and `sourcePlayer` are both
indexed. Filter to awards that carried a non-zero `locked` amount:

```bash
cast logs \
  --rpc-url "$RPC_URL" \
  --from-block 46970755 \
  --address "$BANK" \
  'XPAwarded(uint256,address,address,uint256,uint256,uint256,bytes32)'
```

`--from-block` is the block that created **this** Bank, not just any v1.4 block.
Base mainnet has two v1.4 deploys — 46970560 and 46970755 — with disjoint
contract sets; only 46970755 is referenced by the embedded release, and
`0x597266Ba…` was created there, so nothing can predate it. If you are sweeping
a different Bank, take the block from its own snapshot rather than reusing this
number.

For each distinct pair, confirm there is something to release and then release it:

```bash
cast call "$BANK" "xpLockedBySource(address,address)(uint256)" \
  "$PAYEE" "$SOURCE_PLAYER" --rpc-url "$RPC_URL"

cast send "$BANK" "unlockXPLocked(address,address)(uint256)" \
  "$PAYEE" "$SOURCE_PLAYER" --rpc-url "$RPC_URL" --private-key "$SWEEPER_KEY"
```

The sweeper does not need to be governance and does not need to be the payee.
`unlockXPLocked` moves the amount from the payee's locked bucket to their
accrued bucket; the payee then withdraws with `claimXPAccrued`. Calls for
ineligible or empty pairs return `0` without reverting, so an over-broad sweep
is safe apart from gas.

## Step 5 — Verify

```bash
# Threshold now sane, and locked total has drained by the swept amount.
cast call "$BANK" "minPlayerTurnoverForUnlock()(uint256)" --rpc-url "$RPC_URL"
cast call "$BANK" "xpLockedTotal()(uint256)"              --rpc-url "$RPC_URL"

# Decimals + threshold plausibility guard across every pool in the snapshot.
SNAPSHOT_PATH=deployments/snapshots/deploy-8453-46970755-v14.json \
RPC_URL=<base-mainnet-rpc> \
make casino-bank-decimals-check-v14
```

`casino-bank-decimals-check-v14` fails while any pool's threshold is still
implausible for its decimals, and names the suspected 18-decimal literal in the
error. Treat a green run as the exit condition for this runbook.

It will also print a drift **warning**, because the deployment snapshot still
records the value that was set at deploy time. That is expected after a retune
and does not fail the check — see step 6.

## Step 6 — What not to reconcile

A deployment snapshot is a historical record of what was deployed at that block,
so after a governance retune it legitimately disagrees with current chain state.
Do **not** hand-edit it to match: at block 46970755 the value really was
`20000000000000000000`, and generated deployment artifacts are not editable by
policy. The drift warning in step 5 is the intended end state.

No release re-sync is needed either. The frontend's embedded release
(`frontend/packages/ssot/src/release/embedded/chain-<id>.json`) carries
addresses, games, assets, `refundTimeoutSeconds` and `defaultHouseEdgeBps` — it
does **not** carry `minPlayerTurnoverForUnlock`, and no frontend code reads that
value. A retune therefore has no effect on the release digest, the frontend
manifest, or golden vectors.

---

## Notes for the next release line

`Bank.setMinPlayerTurnoverForUnlock` has no upper bound. Adding one is the fix
recommended by `AGF-07`, but **it cannot be applied to the current source tree**:
`deployments/verify-latest-v14.sh` verifies the deployed mainnet and Sepolia
bytecode against `src/core/Bank.sol` as it stands, so editing the contract now
would break verification for two live deployments. Carry the bound into the next
deployed release line (a v15 Bank) together with its own redeploy and release
artifacts.

Until then, the guard in `script/ci/v14_bank_decimals_check.sh` is the
compensating control.
