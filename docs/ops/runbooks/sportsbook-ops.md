# Runbook: SportsHub odds, result finality, and exposure caps

This runbook covers SportsHub incidents in the v1.3 `SettlementRouter -> SportsHub` topology.

SportsHub has three operationally sensitive surfaces:
- odds acceptance, controlled by signed odds snapshots and `oddsSignerSetHash`;
- result finality, controlled by allowlisted result reporters and an explicit challenge window;
- exposure caps, enforced on-chain by `SportsRiskEngine` before `SettlementRouter.openPosition`.

---

## Scope

**In-scope symptoms**
- `placeTicket` failures spike with `BadOddsSignature`, `OddsExpired`, `BadOddsSnapshot`, or risk cap errors.
- Operators detect stale odds, compromised odds signing, or a mismatch between the off-chain signer set and `oddsSignerSetHash`.
- A result is late, disputed, or finalized with unexpected payload data.
- Sports exposure approaches the configured market/outcome/event caps.
- A Sports market must be suspended or voided without blocking debt-out for already valid tickets.

**Out-of-scope**
- Casino VRF backlog and refundCredit incidents. Use [VRF + refundCredit](vrf-refundcredit.md).
- Bank NAV or reserve anomalies that are not Sports-specific. Use [Bank solvency](bank-solvency.md).
- Governance compromise or broad config drift. Use [Pause + config drift](pause-config-drift.md).

---

## Prerequisites

### Addresses

Use `deployments/latest-v13.json` or the signed release snapshot as the source of truth:

```bash
export SNAPSHOT=deployments/latest-v13.json
export SPORTS_HUB=$(jq -r .sportsHub "$SNAPSHOT")
export SPORTS_RISK_ENGINE=$(jq -r .sportsRiskEngine "$SNAPSHOT")
export POOL_REGISTRY=$(jq -r .poolRegistry "$SNAPSHOT")
export SETTLEMENT_ROUTER=$(jq -r .settlementRouter "$SNAPSHOT")
```

For a Sports pool:

```bash
export SPORTS_POOL_ID=...
export SPORTS_BANK=...
export SPORTS_ASSET=...
```

Record the release digest from `deployments/release-latest-v13.json` in every incident.

### Key state reads

```bash
cast call $SPORTS_HUB "oddsSignerSetHash()(bytes32)" --rpc-url $RPC
cast call $SPORTS_HUB "resultReporterSetHash()(bytes32)" --rpc-url $RPC
cast call $SPORTS_HUB "resultReporterThreshold()(uint8)" --rpc-url $RPC
cast call $SPORTS_HUB "resultChallenger(address)(bool)" $CHALLENGER --rpc-url $RPC
cast call $SPORTS_HUB "resultArbitrator(address)(bool)" $ARBITRATOR --rpc-url $RPC
cast call $SPORTS_HUB "MIN_RESULT_FINALITY_SECONDS()(uint64)" --rpc-url $RPC
cast call $SPORTS_RISK_ENGINE "limitsForPool(uint64)(uint256,uint256,uint256,uint256,uint256)" $SPORTS_POOL_ID --rpc-url $RPC
cast call $SPORTS_RISK_ENGINE "currentRiskHashForPool(uint64)(bytes32)" $SPORTS_POOL_ID --rpc-url $RPC
```

Market and exposure reads:

```bash
cast call $SPORTS_HUB "getMarket(uint64)((uint64,uint64,uint64,uint32,uint64,uint64,uint64,uint64,bytes32,bytes32,uint8))" $MARKET_ID --rpc-url $RPC
cast call $SPORTS_HUB "getResult(uint64)((uint64,uint64,uint64,uint32,uint64,bytes32,bytes32,bytes32,bytes32,bytes32,uint8,uint8,address,uint64,uint64,uint64,bool,bytes32,address,uint64,uint8,bytes32,address,uint64))" $MARKET_ID --rpc-url $RPC
cast call $SPORTS_HUB "marketReserved(uint64)(uint256)" $MARKET_ID --rpc-url $RPC
cast call $SPORTS_HUB "marketOutcomeReserved(uint64,uint32)(uint256)" $MARKET_ID $OUTCOME_ID --rpc-url $RPC
cast call $SPORTS_HUB "poolEventReserved(uint64,uint64)(uint256)" $SPORTS_POOL_ID $EVENT_ID --rpc-url $RPC
cast call $SPORTS_HUB "eventReserved(uint64)(uint256)" $EVENT_ID --rpc-url $RPC # aggregate only
```

`getResult` returns `marketId`, `eventId`, `poolId`, `winningOutcomeId`, `marketVersion`,
`resultPayloadHash`, `resultSourceHash`, `evidenceHash`, `rulebookHash`, `reporterSetHash`,
`reporterThreshold`, `reporterCount`, `proposer`, `observedAt`, `proposedAt`, `finalizesAt`, and
`challenged`, followed by challenge/arbitration evidence: `challengeReasonHash`, `challenger`,
`challengedAt`, `challengeDecision`, `arbitrationDecisionHash`, `arbitrator`, and `arbitratedAt`.

Challenge decision values:
- `0=None`
- `1=UpholdResult`
- `2=ReopenResult`
- `3=VoidMarket`

Sports market state values:
- `0=None`
- `1=Draft`
- `2=Open`
- `3=Locked`
- `4=Suspended`
- `5=ResultProposed`
- `6=Challenged`
- `7=Resolved`
- `8=Voided`

---

## Quick triage checklist (5 minutes)

### 1) Is this odds acceptance, result finality, or exposure?

Classify the incident from the first failing surface:
- odds: failed `placeTicket` transactions revert before router position creation;
- result: market is locked/result-proposed but not finalizing, or a dispute exists;
- exposure: accepted tickets are near cap and new tickets revert with risk cap errors.

### 2) Is the affected market still accepting new risk?

If there is uncertainty about odds correctness, result data, or cap sizing, suspend the affected market first:

```bash
cast send $SPORTS_HUB "suspendMarket(uint64,bool)" $MARKET_ID true --rpc-url $RPC --private-key $GOV_PK
```

Suspension blocks new tickets. It does not block valid later settlement/refund paths.

If the market must be voided before a challenged-result arbitration path exists, publish a non-zero
reason hash and include the underlying incident/data-room link in the incident record:

```bash
export VOID_REASON_HASH=0x...
cast send $SPORTS_HUB "voidMarket(uint64,bytes32)" $MARKET_ID $VOID_REASON_HASH --rpc-url $RPC --private-key $GOV_PK
```

### 3) Is this isolated to one market/event or systemic?

Compare:
- failed tx revert reasons by market id;
- current `oddsSignerSetHash`, `resultReporterSetHash`, `resultReporterThreshold`, and
  `currentRiskHashForPool(poolId)`;
- exposure reads for the affected market/outcome/pool-event;
- latest `OddsSignerSet`, `ResultReporterSet`, `ResultChallengerSet`, `ResultArbitratorSet`,
  `RiskLimitsSet` / `PoolRiskLimitsSet`, and `MarketStateSet` events.

If multiple active markets fail with the same signer/hash/risk mismatch, treat as systemic and suspend all affected markets.

---

## Incident playbooks

### Playbook A — Odds signer or odds snapshot failure

**Trigger**
- `BadOddsSignature`, `OddsExpired`, `BadOddsSnapshot`, or `riskHash` mismatch spikes.
- Off-chain odds service signs with a stale key set or stale risk hash.
- An odds signer key is suspected compromised.

**Goal**
- Stop accepting incorrect odds.
- Preserve settlement rights for already accepted tickets.
- Restore signer/hash alignment with a release-quality audit trail.

**Steps**
1) **Suspend affected markets.**
   - Use `suspendMarket(marketId, true)` for each affected market.
   - Do not void markets until you know accepted tickets cannot be fairly resolved.
2) **Compare on-chain and off-chain hashes.**
   - Read `SportsHub.oddsSignerSetHash()`.
   - Read `SportsRiskEngine.currentRiskHashForPool(poolId)` for every affected Sports pool.
   - Confirm the odds service signs the EIP-712 digest returned by `hashOddsTicket(...)`, binding the
     current signer set, player, stake, market fields, rulebook hash, and risk hash.
3) **Remove a compromised signer if needed.**
   ```bash
   cast send $SPORTS_HUB "setOddsSigner(address,bool)" $SIGNER false --rpc-url $RPC --private-key $GOV_PK
   ```
4) **Publish a new signer-set hash if membership changed.**
   ```bash
   cast send $SPORTS_HUB "setOddsSignerSetHash(bytes32)" $NEW_SIGNER_SET_HASH --rpc-url $RPC --private-key $GOV_PK
   ```
5) **Allowlist replacement signer addresses only after the new hash is documented.**
   ```bash
   cast send $SPORTS_HUB "setOddsSigner(address,bool)" $NEW_SIGNER true --rpc-url $RPC --private-key $GOV_PK
   ```
6) **Resume only after canary tickets succeed on a non-critical market.**
   - Confirm `TicketPlaced` is emitted.
   - Confirm `SettlementRouter.getPosition(ticket.positionId)` owner hub equals `SportsHub`.
   - Resume affected markets with `suspendMarket(marketId, false)` if still before lock time.

**Do not**
- Reuse the old signer-set hash after membership changes.
- Change `SportsRiskEngine` caps without also rotating odds snapshots that embed the old `riskHash`.
- Void accepted tickets solely because new ticket acceptance failed.

---

### Playbook B — Result reporter delay, bad result, or dispute

**Trigger**
- A locked market remains unresolved beyond the operational SLA.
- `ResultProposed` payload does not match the rulebook/data provider.
- `ResultFinalityPending` persists after expected finality, or a result is challenged.

**Goal**
- Prevent bad finalization.
- Keep settlement deterministic and tied to the published rulebook.
- Preserve a public challenge/audit trail.

**Steps**
1) **Read market and result state.**
   ```bash
   cast call $SPORTS_HUB "getMarket(uint64)((uint64,uint64,uint64,uint32,uint64,uint64,uint64,uint64,bytes32,bytes32,uint8))" $MARKET_ID --rpc-url $RPC
   cast call $SPORTS_HUB "getResult(uint64)((uint64,uint64,uint64,uint32,uint64,bytes32,bytes32,bytes32,bytes32,bytes32,uint8,uint8,address,uint64,uint64,uint64,bool,bytes32,address,uint64,uint8,bytes32,address,uint64))" $MARKET_ID --rpc-url $RPC
   ```
   Recompute `resultPayloadHash` with `hashResultPayload(marketId, winningOutcomeId, resultSourceHash,
   evidenceHash, observedAt)` and compare it with the stored result.
   Confirm `reporterCount >= reporterThreshold`, and confirm `reporterThreshold` matches the approved
   reporter-set policy for the incident window.
2) **If the proposed result is wrong or untrusted, challenge it before finality.**
   ```bash
   cast send $SPORTS_HUB "challengeResult(uint64,bytes32)" $MARKET_ID $REASON_HASH --rpc-url $RPC --private-key $SPORTS_CHALLENGER_PK
   ```
   The caller must be governance or an allowlisted `resultChallenger`. The challenge window closes at
   `finalizesAt`; after that, `finalizeResult` is the expected path.
3) **Resolve the challenge with an auditable arbitration decision.**
   - Use `1=UpholdResult` only when the original result is confirmed correct; this finalizes the market.
   - Use `2=ReopenResult` when the original payload is rejected but reporters can propose a corrected result.
   - Use `3=VoidMarket` when no trustworthy result path remains; tickets can then be refunded.
   ```bash
   export DECISION_HASH=0x... # hash of the signed arbitration note / incident ticket / data-room bundle
   cast send $SPORTS_HUB "resolveResultChallenge(uint64,uint8,bytes32)" $MARKET_ID 2 $DECISION_HASH --rpc-url $RPC --private-key $SPORTS_ARBITRATOR_PK
   ```
   The caller must be governance or an allowlisted `resultArbitrator`. A challenged market cannot be
   silently voided through `voidMarket`; use decision `3=VoidMarket` so the decision hash is public.
4) **If the result is valid and finality has elapsed without a challenge, finalize.**
   ```bash
   cast send $SPORTS_HUB "finalizeResult(uint64)" $MARKET_ID --rpc-url $RPC --private-key $KEEPER_PK
   ```
5) **After finalization, monitor terminalization.**
   - `TicketSettled` should progress for held tickets.
   - Losing tickets settle with zero payout.
   - Winning tickets settle through `SettlementRouter`; no direct Bank calls are allowed.

**Do not**
- Finalize a result whose `resultPayloadHash` cannot be reproduced from the structured source/evidence
  fields and the rulebook.
- Finalize a result below the approved reporter threshold for the market's reporter-set policy.
- Reopen or void a challenged result without a public `arbitrationDecisionHash`.
- Void a market directly without a non-zero public reason hash.
- Use governance to pick arbitrary winning tickets.
- Block user-triggered `settleTicket`, `refundTicket`, or `voidTicket` once market state permits debt-out.

---

### Playbook C — Exposure cap pressure or risk limit misconfiguration

**Trigger**
- New tickets revert with `StakeTooLarge`, `PayoutTooLarge`, `MarketExposureExceeded`,
  `OutcomeExposureExceeded`, or `EventExposureExceeded`.
- `marketReserved`, `marketOutcomeReserved`, or `poolEventReserved` approaches configured caps.
- Odds service quotes higher limits than `SportsRiskEngine` permits.

**Goal**
- Stop additional risk before cap pressure turns into user-facing churn.
- Decide whether to reduce odds/off-chain limits, add bankroll, or deliberately adjust caps.

**Steps**
1) **Read caps and current exposure.**
   ```bash
   cast call $SPORTS_RISK_ENGINE "limitsForPool(uint64)(uint256,uint256,uint256,uint256,uint256)" $SPORTS_POOL_ID --rpc-url $RPC
   cast call $SPORTS_HUB "marketReserved(uint64)(uint256)" $MARKET_ID --rpc-url $RPC
   cast call $SPORTS_HUB "marketOutcomeReserved(uint64,uint32)(uint256)" $MARKET_ID $OUTCOME_ID --rpc-url $RPC
   cast call $SPORTS_HUB "poolEventReserved(uint64,uint64)(uint256)" $SPORTS_POOL_ID $EVENT_ID --rpc-url $RPC
   ```
2) **If exposure is near cap, suspend the market while odds/risk is recalibrated.**
3) **Prefer lowering off-chain quote limits before raising on-chain caps.**
   - Update odds snapshots with lower `maxStake` / `maxPayout`.
   - Confirm new snapshots include the current `riskHash`.
4) **If governance deliberately changes caps, rotate risk hash and odds snapshots.**
   ```bash
   cast send $SPORTS_RISK_ENGINE \
     "setPoolLimits(uint64,uint256,uint256,uint256,uint256,uint256)" \
     $SPORTS_POOL_ID \
     $MAX_STAKE $MAX_PAYOUT $MAX_MARKET_RESERVED $MAX_OUTCOME_RESERVED $MAX_EVENT_RESERVED \
     --rpc-url $RPC --private-key $GOV_PK
   ```
   Then read `currentRiskHashForPool($SPORTS_POOL_ID)` and require the odds service to sign only snapshots with the new hash.
5) **Resume market only after exposure and quote limits align.**

**Do not**
- Raise caps just to make failed tickets pass unless bankroll, liquidity, and business approval are recorded.
- Reduce caps without rotating odds snapshots; stale snapshots should fail closed.
- Reuse a Sports cap profile across assets with different decimals without converting raw units.

---

## Recovery criteria

An incident can move to monitoring when:
- affected markets are either resumed, resolved, or voided;
- odds service signs with current `oddsSignerSetHash` and `currentRiskHashForPool(poolId)`;
- result finality state is not stuck for open incidents;
- exposure reads are below operator thresholds;
- all governance transactions are recorded with tx hashes and rationale.

---

## Evidence collection template

Capture:
- chainId, block range, release digest, snapshot path;
- `sportsHub`, `sportsRiskEngine`, `settlementRouter`, affected pool/bank;
- affected `marketId`, `eventId`, `outcomeId`, `ticketId` samples;
- current `oddsSignerSetHash`, `resultReporterSetHash`, `currentRiskHashForPool(poolId)`;
- current `resultReporterThreshold`;
- `SportsRiskEngine.limitsForPool(poolId)` and exposure reads;
- relevant events: `MarketStateSet`, `TicketPlaced`, `ResultProposed`, `ResultChallenged`,
  `ResultChallengeResolved`, `ResultFinalized`, `TicketSettled`, `TicketRefunded`, `TicketVoided`, `RiskLimitsSet`,
  `PoolRiskLimitsSet`;
- governance or keeper tx hashes and signers.
