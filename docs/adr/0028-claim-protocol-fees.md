# ADR-0028: Protocol Fee Withdrawal (`claimProtocolFees`)

## Status

Accepted

## Context

SSOT Constitution v1.1 Section 2.3 defines protocol fee withdrawals/distributions
of `PF[a]` as **optional outflows** for each asset, subject to the A4 safety domain.
ExecutableSSOT v1.1 Section A4 (line 55-58) explicitly includes "fee-withdraw" in
the list of operations that must satisfy:

> NAV_after[a] - R_after[a] >= MinLiq[a](NAV_after[a])

Bank.sol tracks `protocolFeesPayable` (state variable, line 26) and increments it
during `settleBet()` via `protocolFeeAccrual` (line 524).  However, **no function
exists to claim or withdraw accumulated fees**.

This means:
- PF grows unbounded with every settled bet that accrues a protocol fee.
- `NAV = B - PF - XP` shrinks proportionally, reducing LP share value.
- Governance has no mechanism to extract earned fees, creating a permanent drag
  on LP returns with no compensation path.

## Decision

Add `claimProtocolFees(uint256 amount, address receiver)` to `Bank.sol`:

| Aspect | Design |
|--------|--------|
| **Access** | `onlyGov` — protocol fees belong to the protocol; only governance may claim |
| **Pause gate** | Blocked by `riskInPaused` — same as all optional outflows (SSOT v1.1 §2.3) |
| **A4 domain** | Calls `_checkOptionalOutflowDomain(amount, amount, 0)` — `pfDecrease = amount` |
| **Accounting** | Decrements `protocolFeesPayable`; B decreases via `safeTransfer` |
| **Pattern** | Mirrors `claimXPAcrued()` (Bank.sol lines 331-348) with governance auth |
| **Event** | `ProtocolFeesClaimed(address indexed receiver, uint256 amount)` |

The function signature in `IBank.sol`:
```solidity
function claimProtocolFees(uint256 amount, address receiver) external returns (uint256 claimed);
```

## Consequences

- Governance can drain accumulated PF without violating SSOT invariants.
- A4 domain check prevents PF claims that would breach solvency (`NAV >= R`)
  or minimum liquidity (`NAV - R >= MinLiq`).
- New invariant action `action_claimProtocolFees` added to the fuzz handler,
  asserting A4 post-conditions on every successful call.
- ABI change: new function selector and event topic.
- No changes to the accounting identity `NAV = B - PF - XP` or existing invariants.

## Alternatives Considered

1. **Automatic fee sweep on each settlement** — Rejected. Adds gas overhead to
   every `settleBet()` call and introduces complexity in determining the sweep
   destination during settlement.

2. **Time-locked withdrawal with delay** — Rejected. The existing pause mechanism
   and A4 domain check provide sufficient safeguards. An additional time-lock
   would delay legitimate fee collection without meaningful security benefit.

3. **Separate treasury contract** — Rejected for v1.0. Can be layered on top by
   having governance set `receiver` to a treasury address.
