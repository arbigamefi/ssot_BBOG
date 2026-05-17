# ADR-0006 · Casino Terminal Receipt View

| Status | Accepted |
| Date | 2026-05-17 |
| Owner | Protocol Lead + Frontend Lead |
| Reviewers | Eng team |
| Supersedes | — |
| Superseded by | — |
| Affects | `src/core/GameHub.sol`, `src/core/interfaces/IGameHub.sol`, `src/core/interfaces/SSOTTypes.sol`, `frontend/packages/ssot/src/sdk/**`, `frontend/apps/web/src/features/casino/room/**` |

## 1. Context

Casino settlement UX currently needs three facts after a bet becomes terminal:

1. whether the bet settled or refunded;
2. the final player amount (`payoutNet` or `refundAmount`);
3. optional proof metadata such as tx hash and event block.

`GameHub.getBet(positionId)` exposes lifecycle state, request id, random hash,
stake, and timestamps, but it does not expose terminal financial outputs.
Those outputs are only present in `BetFinalized` / `BetRefunded` logs.

This forced the frontend to scan logs after `getBet()` already reported a
terminal state. On public RPCs this is slow and fragile. It also puts proof
retrieval on the critical path for showing a player whether they won or lost.

## 2. Decision

`GameHub` stores a terminal receipt for each finalized or refunded casino bet
and exposes it through:

```solidity
function getBetTerminal(uint256 positionId)
    external
    view
    returns (SSOTTypes.BetTerminal memory);
```

`SSOTTypes.BetTerminal` contains:

- terminal `BetState` (`None`, `Settled`, or `Refunded`);
- `payoutGross`;
- `payoutNet`;
- `feeOnPayout`;
- `protocolFeeAccrual`;
- `refundAmount`.

Frontend result rendering uses this view as the primary source of result
amounts. Event scans, durable indexes, and explorer links are proof enrichment,
not the gate for showing the result.

## 3. Rationale

- **Result reads should be one `eth_call`.** Once a keeper has finalized a bet,
  the user should not wait on log indexing to see the outcome.
- **Lifecycle and result are different concerns.** `Bet` remains the lifecycle
  record; `BetTerminal` records final financial outputs.
- **Events remain useful.** They still power analytics, recent feeds, tx links,
  and audit trails, but they are no longer required for the immediate result UI.
- **The project is pre-mainnet.** A clean ABI break is acceptable now and cheaper
  than carrying a log-scan workaround into production.

## 4. Alternatives Considered

| Alternative | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep client log scanning | No contract churn | Slow RPC path, bad UX, fragile | Rejected |
| Use keeper/Postgres as the only result source | Fast when infra is healthy | Adds off-chain dependency to core outcome display | Rejected as primary, allowed as cache/proof layer |
| Add payout/refund fields directly to `Bet` | Single `getBet` call | Bloats lifecycle struct and every consumer | Rejected |
| Add `BetTerminal` mapping + view | Direct on-chain result read with narrow surface | Adds one mapping write at terminalization | Accepted |

## 5. Consequences

Positive:

- Result modal can display win/loss as soon as terminal state is readable.
- Public RPC log range limits no longer block the player outcome.
- The UI model becomes simpler: `getBet()` for state, `getBetTerminal()` for
  outcome, events for proof enrichment.

Negative:

- Fresh deployments and frontend release bundles must include the new ABI.
- Terminalization writes one additional storage record.

Neutral:

- Existing `BetFinalized` and `BetRefunded` event ABIs remain unchanged.
- Keeper behavior remains unchanged.

## 6. Acceptance Criteria

- [ ] `GameHub.finalize` writes a `Settled` terminal receipt before emitting
      `BetFinalized`.
- [ ] `GameHub.refund` writes a `Refunded` terminal receipt before emitting
      `BetRefunded`.
- [ ] Over-refund fallback in `finalize` writes a full-stake `Refunded`
      terminal receipt.
- [ ] Frontend SDK tries `getBetTerminal` before any log scan.
- [ ] Log scanning remains only as backward-compatible fallback for older dev
      deployments.
- [ ] Contract tests cover normal settle, refund, and fallback refund receipts.

