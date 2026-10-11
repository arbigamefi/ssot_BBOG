# ADR-0022: VRF native fee and refund-credit invariants

- **Status:** Accepted. Core fee accounting and application interfaces implemented and locally verified; release qualification pending. Current status: [release notes](../release/README.md).
- **Date:** 2026-10-04

## Context

Players provide a native-token budget with a casino bet. VRFHub pays the wrapper's actual native
request charge and returns the excess. A receiver that rejects native transfers must retain its
refund entitlement. This fee accounting is separate from Bank's ERC20 player stakes and LiquidityVault's LP capital.

## Decision

There is one direct consumer flow, defined by [ADR-0021](0021-chainlink-vrf-wrapper-consumer.md):

1. GameHub forwards the supplied budget and the authenticated position's payer to VRFHub.
2. The wrapper's price at request execution determines `feeCharged`; VRFHub sends exactly that charge.
3. If the budget is insufficient, the entire acceptance transaction reverts, including stake transfer,
   position creation and request bookkeeping.
4. Excess budget is returned to the original payer. A failed return creates that payer's refund credit.
5. A later `claimRefund` clears the credit only if payment succeeds; a rejecting receiver leaves the
   full credit intact. The claim is not restricted by casino or Bank pause.

There is no privileged sweep of player credits or oracle fees. A bettor cannot choose a different
payer through untrusted request metadata. A bounded refund attempt must preserve enough gas to book
credit; if the transaction cannot finish its required state changes, it reverts atomically.

## Accounting invariants

For each successfully accepted request:

```text
budget supplied = wrapper charge + excess returned + credit created
```

For protocol-controlled flows, GameHub retains none of the provided native budget. VRFHub retains
refund credits rather than earned fees. In a closed test environment without unrelated native
transfers, its balance equals aggregate outstanding credit. On chain, unsolicited or forced native
transfers can make the balance larger; the general solvency assertion is
`VRFHub native balance >= aggregate outstanding credit`, not unconditional equality.

A wrapper's global live balance is not proof of this protocol's accumulated payments, because the
provider serves other consumers and may withdraw its funds. Track the charge paid per accepted
request; a controlled mock can additionally reconcile its own retained balance.

Credits are monotonically created by failed excess returns and reduced by successful claims only.
A failed claim must neither lose credit nor double-pay. Claiming does not change the original bet,
randomness, Bank/Vault accounting or recorded request charge.

## Required acceptance evidence

- Exact payment, deliberate overpayment and insufficient payment.
- Receiver rejection and gas exhaustion during excess return; successful later credit claim.
- Rejected claims preserve entitlement, and reentrant attempts cannot claim twice.
- Pause does not block credit claims; receiver behavior may still prevent cash delivery.
- Request/position binding cannot redirect a refund to an arbitrary payer.
- Stateful tests reconcile accepted fees, returned excess and credits on the single MockWrapper path.
- Forced native transfers do not falsify the general credit-solvency assertion or become LP assets.
- A rejected bet/request leaves no stake, reserve, fee-credit or request-state residue.

These are acceptance requirements, not newly completed test results. The
[implementation plan](../design/lp-accounting-and-callback-implementation.md) defines integration
and release evidence.
