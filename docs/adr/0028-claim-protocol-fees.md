# ADR-0028: Protocol fee claims

Status: Accepted; implemented in `Bank.sol`.

## Decision

`claimProtocolFees(amount, receiver)` lets governance claim accrued protocol fees.
It rejects a zero receiver, paused operation, a positive claim above a nonzero
fee balance and any outflow that fails the Bank's withdrawal-buffer or solvency checks.

For an external receiver, a successful claim reduces `protocolFeesPayable` and the Bank's cash by the same
amount, preserving LP NAV:

```text
active NAV = balance − protocolFeesPayable − xpLiabilityTotal − exitPayable − playerPayableTotal − recoveryBacking
```

The claim emits `ProtocolFeesClaimed`. A claim to the Bank itself leaves cash in the Bank and increases NAV instead. A failed token transfer reverts the entire
operation, preserving the fee liability. The existing reentrancy guard applies.

Protocol fee claims are optional outflows. They cannot consume player payables,
priced LP exit liabilities, historical recovery backing or active reserves. The withdrawal buffer applies
to these claims; it does not apply to player-payable, priced LP exit or historical recovery claims.

## Rationale and verification

Governance selects when and where to collect fees. Automatically transferring fees
on every settlement would add transfer work and a failure dependency to the bet
lifecycle. A separate treasury can receive claims without changing the Bank.

`test/unit/BankObservability.t.sol` and the Bank invariant handler exercise fee
claims together with deposits, settlements, reserves and asynchronous redemptions.
See [SSOT v1.6](../constitution/SSOT.v1.6.md) for the shared accounting rules.
