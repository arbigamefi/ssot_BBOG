# ADR-0008: Skyline Pricing and Delta Referral Budgets

- **Status:** Accepted
- **Date:** 2026-01-08

## Context

Affiliates may opt into a higher house edge and should receive rewards tied to the
**incremental price** they introduce.

The mechanism MUST be:

- deterministic and publicly recomputable
- gas-bounded
- non-retroactive for accepted bets (pricing snapshots)

## Decision

### Affiliate house edge

Each affiliate may set an explicit `houseEdgeBps` within bounds:

- `houseEdgeBps >= defaultHouseEdgeBps`
- `houseEdgeBps <= defaultHouseEdgeBps + maxAffiliateDeltaBps` (or `<= 10_000` when `maxAffiliateDeltaBps == 0`)

### Skyline construction (bounded)

At `placeBet(gameId, asset, params, stake, affiliate, maxHouseEdgeBps)`, the Hub computes a pricing snapshot:

1. Determine `pricingAffiliate`:
   - prefer the player's bound referrer;
   - if unbound and an `affiliate` hint is provided, the Hub attempts `bindFor(player, affiliate)` (best-effort);
   - fallback to the provided `affiliate` hint.

2. Walk the referral chain from `pricingAffiliate` for up to **6 hops**.
   Maintain `curMax = baseHouseEdgeBps`.
   When a node has an explicit house edge greater than `curMax`, record a skyline segment:

   - `payee = node`
   - `incBps = houseEdgeBps[node] - curMax`
   - update `curMax = houseEdgeBps[node]`

3. Set `effectiveHouseEdgeBps = curMax`.

The skyline is encoded as packed bytes:

- segment = `address(20 bytes) || uint16 incBps (2 bytes)`
- at most 6 segments
- total length is `22 * segments`

By construction: `sum(incBps) == effectiveHouseEdgeBps - baseHouseEdgeBps`.

The Hub MUST enforce user protection:

- revert if `effectiveHouseEdgeBps > maxHouseEdgeBps`

The bet snapshots and stores:

- `pricingAffiliate`, `baseHouseEdgeBps`, `effectiveHouseEdgeBps`
- `deltaSkylineHash = keccak256(deltaSkylineBytes)`
- `referralConfigId` (snapshot)

### Delta budget

At `finalize`, using bet snapshots:

- `usedTurnover = stake - refundAmount`
- `deltaHE = effectiveHouseEdgeBps - baseHouseEdgeBps`
- `deltaHEAmt = usedTurnover * deltaHE / 10_000`
- `deltaBudget = deltaHEAmt * deltaBudgetBps / 10_000`

`deltaBudget` is distributed by `splitDelta(skyline, policy)`:

- proportional to each segment's `incBps`
- remainder is added to the last non-zero segment
- each share is split into (immediate vs locked) under the eligibility rule plus holdback

Unallocated delta budget is returned as `sink` and accrued as protocol fees.

## Consequences

- Pricing is deterministic and bounded (≤ 6 segments).
- No retroactive changes: the bet snapshots the skyline and house edges.
- Delta referral rewards are mechanically verifiable.
- Settlement remains live: referral outputs accrue as liabilities (XP buckets), not transfers.

## Links

- Constitution: `docs/constitution/SSOT.v1.0.md` (§3.2.1, §3.3.2)
- Current implementation after ADR-0029: `src/core/GameHub.sol`,
  `src/engines/referral/DefaultReferralEngine.sol`
