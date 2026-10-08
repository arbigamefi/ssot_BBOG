# ADR-0021: Direct Chainlink wrapper consumer with native payment

- **Status:** Accepted. Direct consumer implemented and locally verified; release qualification pending. See the [current evidence](../audit/nft-core-integration-review.md).
- **Date:** 2026-10-04

## Context

The wrapper calls the address that requested randomness. VRFHub can be that consumer directly; an
additional forwarding contract is unnecessary. A single consumer also gives
[ADR-0006](0006-vrf-callback-settlement.md) one place to persist a result before fallible game work.

## Decision

VRFHub inherits the vendored `VRFV2PlusWrapperConsumerBase` from
`lib/chainlink-brownie-contracts/contracts/src/v0.8/vrf/dev/VRFV2PlusWrapperConsumerBase.sol`.
The dependency remains pinned to `CHAINLINK_BROWNIE_CONTRACTS=1.3.0` in `deps.lock`.
Use the dependency's authenticated callback entry and native-payment helper instead of recreating
wrapper authentication or native-price arithmetic.

The only production route is:

```text
GameHub -> VRFHub -> Chainlink wrapper
                         |
                         v
              VRFHub authenticated callback
                         |
                         v
              durable receipt + bounded GameHub attempt
```

VRFHub uses the immutable wrapper address required by the consumer base. The inherited raw callback
rejects non-wrapper callers; it is not overridden to bypass authentication. Binding each request to
its Router position, preserving results, retry and terminal acknowledgment follow ADR-0006.

Remove the independent adapter contract, its production interface/wiring, adapter selector and
internal synthetic-provider mode. This is one fresh-deployment implementation, with no compatibility
route. Local tests use `MockVRFV2PlusWrapper` through the same consumer path; the mock supplies the
wrapper methods used by the base, including `link()` during construction. Tests cannot manufacture
production callbacks through an unguarded VRFHub entry.

UI quotes call the wrapper's `estimateRequestPriceNative` with an explicit gas-price budget.
Request execution uses `requestRandomnessPayInNative`, whose wrapper price calculation uses the
transaction's actual gas price and forwards the exact charge. Native-payment extra arguments use
the locked dependency's encoding. Underpayment reverts the entire bet acceptance; overpayment and
credit handling follow [ADR-0022](0022-vrf-native-fee-credit-invariants.md).

## Gas boundary and deployment checks

At Base Sepolia block **47,638,466**, coordinator
`0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE` reported `maxGasLimit = 2,500,000`.
The deployment manifest's wrapper was `0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed`.
These are read-only observations, not a claim that the proposed contracts are deployed or qualified.

The wrapper adds EIP-150 and its configured wrapper overhead to the requested consumer gas when
requesting the coordinator callback. Thus the consumer cannot treat the coordinator's whole 2.5m
limit as an unrestricted settlement budget. Deployment qualification must read the actual wrapper
and coordinator configuration at a pinned block, exercise a real wrapper request on a fork, and
measure the complete new callback path, including the 40-level LiquidityTree, its prefix-fallback
branches, Bank/Vault asset movement and net-lock release. Reusing the current 2m callback cap or a keeper's separate
3m finalization budget is insufficient evidence.

Snapshot gas configuration and the accepted workload limits with release metadata. Reject requests
whose configured envelope is unsupported. Recheck after provider configuration changes and before
releasing additional module/round/referral combinations. Do not reproduce provider fee formulas to
work around the limits.

## Required acceptance evidence

- Deployment and ABI generation describe one wrapper consumer and no adapter/provider-mode switch.
- Mock and fork tests reach the inherited wrapper authentication, native request helper and real receipt flow.
- Spoofed callbacks fail authentication; duplicate responses do not change a stored word.
- The qualified consumer gas plus wrapper overhead fits the observed coordinator configuration.
- Accepted maximum workloads, including tree distribution and dual-custody accounting, finish the
  normal callback path with measured failure-handling margin. No previous 100-round admission is assumed.
- Actual charge, overpayment refund and retained credit reconcile through all request outcomes.

The direct consumer, real core callback and single-round deployed-wrapper fork are implemented and
locally verified in the [core review](../audit/nft-core-integration-review.md). Maximum-complexity
callback gas remains open. Product consumers have [local integration evidence](../audit/nft-consumer-integration-review.md).
See the [implementation plan](../design/lp-accounting-and-callback-implementation.md).

## Sources

- [Locked dependency](../../deps.lock) and its vendored consumer base.
- [Chainlink supported networks](https://docs.chain.link/vrf/v2-5/supported-networks).
- [Chainlink wrapper source](https://github.com/smartcontractkit/chainlink-evm/blob/develop/contracts/src/v0.8/vrf/VRFV2PlusWrapper.sol)
  for the request-overhead structure; release qualification must match the actual deployed wrapper.
