# ADR-0032: Fixed LP share; operator-funded referrals

Status: Accepted. The current implementation uses one house edge and L0/L1/L2 only.
The simplification requires fresh source-bound regression and release checks; earlier gas measurements
and network evidence do not qualify this source automatically.

## Decision

### 1. One house edge and one allocation base

Each accepted casino bet snapshots `houseEdgeBps = h`, its referral configuration version and its
L1/L2 payees. For `U = stake − refundAmount`:

```text
E = floor(U × h / 10000)
O = floor(E × (10000 − LP_SHARE_BPS) / 10000)
LP retained edge = E − O
```

`LP_SHARE_BPS = 5000` and `MAX_HOUSE_EDGE_BPS = 500` are release constants. There is no separate
agent price, multi-hop price traversal or additional referral budget. `maxHouseEdgeBps` remains the
player's maximum accepted price. Pure refunds allocate nothing.

Bank keeps player stakes and fixed liabilities separate from LiquidityVault's NFT capital. The net
position result uses its opening deposit-ID cutoff and the original tree fallback under
[ADR-0034](0034-nft-liquidity-deposits.md). Profit with an empty tree becomes separately identified
protocol capital; it is not additional turnover edge. Direct token surpluses are not allocated.

### 2. Three rewards, funded from the operator share

Rates are basis points of `E`, not of stake:

| Level | Payee               | Condition at acceptance         | Initial rate |
| ----- | ------------------- | ------------------------------- | -----------: |
| L0    | Player rakeback     | The player has a bound referrer |         1000 |
| L1    | Direct referrer     | The snapshotted payee exists    |         2000 |
| L2    | Referrer's referrer | The snapshotted payee exists    |          500 |

`l0 + l1 + l2 ≤ MAX_REFERRAL_BPS = 3500`. Each amount is independently rounded down:
`Rk = floor(E × lk / 10000)` when its condition holds, otherwise zero.
The engine returns at most three nonempty awards and:

```text
PF_new = O − R0 − R1 − R2
XP_new = R0 + R1 + R2
LP retained edge + PF_new + XP_new = E
```

Missing payees and rounding remainders go to PF. No reward is paid beyond L2. A failed affiliate hint
creates no reward or price change; the hint only attempts a first-touch referral binding.
The registry rejects self-binding, rebinding, cycles and traversals that cannot establish an empty root
within its bounded check. This proof limit is not a promise that every relationship graph has a global
maximum depth: an existing root can later bind a previously unrelated referrer.

L0 is accrued XP. L1/L2 follow turnover eligibility and holdback rules. Reward rates and holdbackBps
are snapshotted, but Bank's current unlock threshold and vesting duration remain live configuration:
settlement reads the current threshold and a newly started vesting schedule reads the current duration.
Changing the duration does not extend an already active schedule.

### 3. Independent settlement enforcement

Router snapshots `h` and enforces `PF_new + XP_new ≤ floor(floor(U × h / 10000) / 2)` independently of
the hub. Bank separately checks the full terminal cost and cash backing. Neither check can be removed
because the reference engine currently returns three awards.

### 4. Governance

- The Safe queues the single `defaultHouseEdgeBps` through the governance timelock (72 hours, ADR-0037);
  anyone may activate it `EDGE_CHANGE_DELAY = 7 days` after it is queued. Governance or the sentinel (the
  Safe) may cancel a pending change. Both increases and decreases use this delay.
- The interfaces are `pendingEdgeChange()`, `queueEdgeChange(uint16)`, `activateEdgeChange()` and
  `cancelEdgeChange()`. There is one pending record and no parameter selector.
- Referral schedules are immutable versions. Activating a new version affects new bets only.
- LP share, maximum referral rate and maximum house edge are constants. The guardian cannot change any
  allocation parameter.
- This release has one hub, GameHub; another domain needs its own allocation decision.

## Consequences

With 100 USDC used turnover, a 2% house edge and all default payees present: E=2, O=1, LP retained
edge=1, L0=0.2, L1=0.4, L2=0.1 and PF=0.3 USDC. Without a referrer PF=1 and XP=0. These are allocation
amounts; LPs still bear actual game-result variance, and accrued XP is not a wallet transfer.

The single-price model removes extra pricing permissions, traversal, duplicate per-bet price fields and
additional reward branches. Exact gas savings require measurements of identical inputs. A fixed VRF
callback gas limit does not automatically become cheaper because execution uses fewer instructions.

## Verification

Bind allocation, request authentication, terminal atomicity, NFT accounting and three-recipient
callback tests to the new source. Verify missing payees, integer rounding, immutable accepted rates,
Bank's live XP configuration, governance delay, failed first-touch binding, and the Router's independent cap.
Rebuild ABI, event consumers, signed release snapshots, manifests and negative release checks as one schema.
No removed field or interface is retained for compatibility.

## References

- [SSOT v1.6](../constitution/SSOT.v1.6.md)
- [Executable SSOT v1.6](../constitution/ExecutableSSOT.v1.6.md)
- [Implementation plan](../design/lp-accounting-and-callback-implementation.md)
- `test/unit/HouseEdgeAllocationV16.t.sol`, `test/unit/SettlementRouter.t.sol`, `test/unit/GameHubE2E.t.sol`
