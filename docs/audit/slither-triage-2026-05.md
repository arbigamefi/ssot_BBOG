# Slither Triage - 2026-05-12

> **Historical baseline notice (2026-05-13)**: this triage was written against the pre-v1.3 Hub
> codebase. References to `src/core/Hub.sol` are retained as historical detector evidence. Current
> casino lifecycle code lives in `src/core/GameHub.sol` and settles through `src/core/SettlementRouter.sol`.

Scope: post-audit security-fix working tree after the May 2026 FullAudit fixes.

Commands:

- `FOUNDRY_PROFILE=pr forge test --match-path test/unit/SecurityFixes.t.sol -vv`
- `~/.local/bin/slither . --filter-paths "test/|src/mocks/|lib/" --json /tmp/arbigamefi_slither_after_low.json`

Result summary:

- Security regression tests: 9 passed, 0 failed.
- Slither exit code: non-zero because detectors remain.
- Slither detector count: 86 total.
- Remaining Slither High/Medium buckets:
  - High: `arbitrary-send-erc20` (1), `arbitrary-send-eth` (1), `reentrancy-eth` (2).
  - Medium: `incorrect-equality` (10), `uninitialized-local` (10), `unused-return` (2).
- `reentrancy-no-eth` was removed from the High/Medium set after CEI hardening in `Hub.finalize` and `Hub.refund`.
- No `unused-state` / `constable-states` findings remain for the earlier incomplete `_trackedAssets` approach.

## v1.3 Refresh (2026-05-21)

Current command:

```text
slither . --filter-paths "test/|src/mocks/|lib/" --json /tmp/arbigamefi_slither_current.json
```

Current result summary:

- Slither JSON completed successfully.
- Slither exit code remains non-zero because detectors remain.
- Slither detector count: 110 total.
- Current High buckets: `arbitrary-send-erc20` (1), `arbitrary-send-eth` (1),
  `reentrancy-eth` (2).
- Current Medium buckets: `incorrect-equality` (14), `reentrancy-no-eth` (1),
  `uninitialized-local` (10), `unused-return` (5).

v1.3 disposition:

- `arbitrary-send-erc20` now points at `Bank.holdBet`. This is still suppressed:
  `holdBet` is `onlySettlementRouter`, and `SettlementRouter.openPosition` only accepts registered
  hubs allowed for the target pool. The production asset is a governance-approved pool asset; a
  malicious token/pool requires compromised governance and is outside the threat model.
- `arbitrary-send-eth` and `reentrancy-eth` in `VRFHub` remain suppressed: direct calls are
  self-funded, overpay refund credits are accounted before provider request storage is used for
  fulfillment, and `claimRefund` zeroes credit before the native-token transfer.
- `reentrancy-eth` in `GameHub.placeBet` remains suppressed: `placeBet` is `nonReentrant`; VRF
  callback entry is gated by `msg.sender == vrfHub`, and a callback before `requestToBetId` is bound
  is soft-ignored.
- The new `reentrancy-no-eth` row in `SportsHub.placeTicket` is suppressed: `placeTicket` is
  `nonReentrant`, the external route goes through `SettlementRouter -> Bank.holdBet`, and follow-up
  SportsHub state writes are protected from same-contract reentry. A malicious pool asset again
  requires governance-approved malicious configuration.
- `incorrect-equality` rows are sentinel/state-boundary checks: unset ids, zero/default config
  values, vesting boundaries, expiry/finality state checks, and existence checks.
- `uninitialized-local` rows are Solidity zero-initialized accumulators, memory structs, fixed arrays,
  and cached values that are intentionally filled conditionally before use.
- `unused-return` rows are canonical decode / ECDSA recover patterns where validation happens through
  revert behavior or the checked `RecoverError`.
- `timestamp` rows are Low-impact detector noise for lock time, start time, odds expiry, finality,
  and challenge timeout semantics; those flows are intentionally time-based.

No current High/Medium Slither row is a release-blocking funds-safety finding under the current trust
model. This triage is not a mainnet GO by itself; release readiness still depends on the mainnet
packet, deployment artifacts, keeper/index readiness, and canary evidence.

## Validation Rubric

- Is the detector reachable from an untrusted caller without privileged setup?
- Can the caller move value they do not own, bypass a solvency guard, or brick debt-out liveness?
- Does the reported sink run before state is protected by `nonReentrant`, `onlyHub`, request mapping checks, or trusted-governance wiring?
- Is the Slither finding a Solidity-language default/sentinel pattern rather than a real read-before-write or equality bug?
- Does an immediate code change reduce meaningful exploitability without increasing protocol complexity or changing public semantics?

## Closure Table

| ID | Slither detector | Root location | Disposition | Survives? | Evidence / counterevidence |
| --- | --- | --- | --- | --- | --- |
| SL-H1 | `arbitrary-send-erc20` | `src/core/Bank.sol:480` / `safeTransferFrom(player, ...)` | Suppressed | No | `Bank.holdBet` is `onlyHub nonReentrant`; the only production caller is `Hub.placeBet`, which sets `player = msg.sender` before forwarding to Bank. A user approval alone cannot cause Bank to pull arbitrary third-party funds. Exploit requires compromised trusted Hub/governance, which is already out of scope in `docs/audit/threat-model.md`. |
| SL-H2 | `arbitrary-send-eth` | `src/core/VRFHub.sol:115` / adapter fee forward and overpay refund | Suppressed | No | `VRFHub.requestRandomWords` forwards the caller-provided `msg.value` to a governance-configured adapter and refunds overpay to the supplied payer. Direct public calls are self-funded and do not move protocol-owned funds. Bogus Hub callbacks are soft-ignored by `Hub.onRandomWords` unless `requestToBetId[requestId]` is bound. |
| SL-H3 | `reentrancy-eth` | `src/core/VRFHub.sol:164` / `claimRefund` | Suppressed | No | Credit is set to zero before the native-token transfer. A reentrant `claimRefund` observes zero credit. The only post-call write restores credit and reverts when the transfer failed, so it does not create a double-claim path. |
| SL-H4 | `reentrancy-eth` | `src/core/Hub.sol:280` / `placeBet` | Suppressed | No | `placeBet` is `nonReentrant`. Reentry into `placeBet`, `finalize`, or `refund` is blocked. `onRandomWords` only accepts calls from `vrfHub` and ignores request IDs not present in `requestToBetId`; callbacks during provider request creation are not mapped yet and therefore do not settle bets. |
| SL-M1 | `incorrect-equality` | `src/core/Bank.sol:395`, `src/core/Bank.sol:413`, `src/core/Bank.sol:302`, `src/core/Hub.sol:247` | Suppressed | No | These are sentinel, rounding, and schedule-boundary checks: zero balances, unset vesting timestamps, `shares == 0` rounding protection, active holdback schedule end checks, and `BetState.None` existence checks. They are intentional branch guards, not timestamp randomness or price equality assumptions. |
| SL-M2 | `reentrancy-no-eth` | `src/core/Hub.sol:437`, `src/core/Hub.sol:557` | Fixed / hardened | No | `Hub.finalize` and `Hub.refund` now write terminal bet state before external Bank interactions, and clear `requestToBetId` before best-effort `VRFHub.detach`. Slither no longer reports this detector after the CEI hardening. |
| SL-M3 | `uninitialized-local` | `src/core/Bank.sol:547`, `src/core/Hub.sol:503`, `src/core/Hub.sol:596`, `src/core/VRFHub.sol:195`, `src/modules/*` | Suppressed | No | Solidity zero-initializes local variables and memory structs. The flagged accumulators, memory structs, and cached request locals are intentionally zero-started before accumulation/conditional fill. No read-before-write with attacker-controlled stale memory exists. |
| SL-M4 | `unused-return` | `src/modules/cointoss/CoinTossModule.sol:15`, `src/modules/cointoss/CoinTossModule.sol:22` | Suppressed | No | `CoinTossParams.decode(params)` is called for canonical decoding and revert-on-invalid behavior in `validate` and `maxPayout`. The returned boolean is only needed by `resolve`, where it is consumed. |

## Remaining Work

None of the remaining High/Medium Slither rows is a release-blocking funds-safety finding under the current trust model.

Recommended follow-ups:

- Add a NatSpec note near `VRFHub.requestRandomWords` documenting that direct calls are self-funded and bogus request callbacks are soft-ignored.
- Optionally initialize local accumulator variables explicitly to reduce Slither noise, but this is style-only.
- Keep SEV-03 tracked separately from Slither triage; it is not part of this detector set.
