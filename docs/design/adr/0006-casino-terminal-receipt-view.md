# ADR-0006 · Casino Terminal Receipt View

| Status | Accepted |
| Date | 2026-05-17 |
| Owner | Protocol Lead + Frontend Lead |
| Reviewers | Eng team |
| Supersedes | — |
| Superseded by | — |
| Affects | `src/core/GameHub.sol`, `src/core/interfaces/IGameHub.sol`, `src/core/interfaces/SSOTTypes.sol`, `frontend/packages/ssot/src/sdk/**`, `frontend/apps/web/src/features/casino/room/**` |

## 1. Context

Casino settlement UX needs distinct facts after a bet becomes terminal:

1. whether the bet settled or refunded;
2. the final economic amount (`payoutNet + refundAmount` for a settlement,
   `refundAmount` for a full refund);
3. whether that amount was transferred or recorded as a player payable;
4. proof metadata such as transaction hash and event block.

`GameHub.getBet(betId)` exposes lifecycle state, request id, random hash,
stake, and timestamps, but it does not expose terminal financial outputs.
The separate terminal receipt supplies those economic outputs. Transaction
receipts establish payment delivery; terminal state alone does not prove that
assets reached the player's wallet.

## 2. Decision

`GameHub` stores a terminal receipt for each finalized or refunded casino bet
and exposes it through:

```solidity
function getBetTerminal(uint256 betId)
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

Frontend result rendering uses this view as the source of terminal amounts.
The SDK reads it before searching a bounded log window for the terminal
transaction. Logs locate the transaction for payment evidence and explorer
links; they do not replace a missing `getBetTerminal` implementation.

For a known successful terminal transaction, payment evidence uses its complete,
ordered receipt logs and the bet's Bank, asset, and player identity. The shared
payment parser matches the bet's reserve release and terminal event, then checks
the intervening asset `Transfer` or `PlayerPayableCreated` event and exact amount:

- `transferred`: the full amount was transferred from that Bank to that player.
- `payable`: the Bank recorded the full amount as a player payable.
- `none`: the economic amount is explicitly zero.
- `unknown`: transaction, identity, ordering, or amount evidence is missing or
  inconsistent. A current aggregate claim balance cannot establish the historical
  payment status of one bet.

A nonterminal receipt returns no terminal proof. Missing financial fields remain
unavailable rather than becoming zero. Failure to enrich an existing terminal
receipt preserves its economic amounts and leaves payment status `unknown`.

## 3. Rationale

- **Economic amounts have a direct read.** `getBetTerminal` supplies the recorded
  outcome without requiring a terminal event scan.
- **Lifecycle and result are different concerns.** `Bet` remains the lifecycle
  record; `BetTerminal` records final financial outputs.
- **Events remain useful.** They still power analytics, recent feeds, tx links,
  and audit trails, but they are no longer required for the immediate result UI.
- **Payment evidence is explicit.** Economic settlement, a wallet transfer, and
  a recorded player payable are different facts.

## 4. Alternatives Considered

| Alternative | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep client log scanning | No contract churn | Slow RPC path, bad UX, fragile | Rejected |
| Use keeper/Postgres as the only result source | Fast when infra is healthy | Adds off-chain dependency to core outcome display | Rejected as primary, allowed as cache/proof layer |
| Add payout/refund fields directly to `Bet` | Single `getBet` call | Bloats lifecycle struct and every consumer | Rejected |
| Add `BetTerminal` mapping + view | Direct on-chain result read with narrow surface | Adds one mapping write at terminalization | Accepted |

## 5. Consequences

Positive:

- Result amounts remain available when transaction-proof enrichment fails.
- Public RPC log range limits do not erase the on-chain economic receipt.
- The UI model becomes simpler: `getBet()` for state, `getBetTerminal()` for
  economic outcome, transaction receipts for payment evidence.

Negative:

- Contract and SDK ABI must both include `getBetTerminal`.
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
- [ ] Frontend SDK reads `getBetTerminal` before transaction-proof enrichment;
      missing terminal storage or read errors do not select a compatibility path.
- [ ] Receipt evidence distinguishes `transferred`, `payable`, `none`, and
      `unknown`; missing financial amounts are never silently zero-filled.
- [ ] Contract tests cover normal settle, refund, and fallback refund receipts.

## 7. Implementation References

- [GameHub terminal storage](../../../src/core/GameHub.sol)
- [SDK terminal proof and receipt enrichment](../../../frontend/packages/ssot/src/sdk/create.ts)
- [Shared payment evidence parser](../../../frontend/packages/bet-index/src/player-payment.ts)
- [Casino receipt model](../../../frontend/apps/web/src/features/casino/receipt/view-model.ts)
