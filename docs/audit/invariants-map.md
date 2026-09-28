# Invariant enforcement map

The [current executable specification](../constitution/ExecutableSSOT.v1.6.md) is the authoritative
obligation and test map. This index identifies the code boundaries without repeating its formulas.

| Boundary | Code | Main checks |
| --- | --- | --- |
| NAV, reserves and debt ownership | Bank, AccountingLib | BankAsyncRedemption, BankObservability, StatefulSystemDiff |
| LP request, cutoff, pricing and claims | Bank | BankAsyncRedemption |
| Pool and Hub isolation; allocation cap | PoolRegistry, SettlementRouter | SettlementRouter, SettlementRouterInvariants |
| Casino terminal paths and gas limits | GameHub, game modules | GameHubE2E; `make test-casino-admission` |
| Pricing snapshots and referral allocation | GameHub, DefaultReferralEngine | HouseEdgeAllocationV16, StatefulSystemDiff |
| Randomness and native fee/credit handling | VRFHub, ChainlinkV2PlusWrapperAdapter | adapter unit/invariant and StatefulSystemDiffAdapter |
| Sports market/ticket state | SportsHub, SportsRiskEngine | SportsHubLifecycle, SportsHubInvariants |
| Actual cash receipts, replay and recovery | SDK, bet-index, keeper | package tests and opt-in PostgreSQL/Anvil suites |

Passing local tests does not substitute for final audit or deployed-network acceptance.
